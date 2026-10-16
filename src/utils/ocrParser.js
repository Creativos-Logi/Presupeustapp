import { createWorker } from 'tesseract.js';
import { findInCatalog, STORE_CATALOG, enrichItemWithCatalog } from '../data/storeCatalog.js';
import { REAL_TRACKING_DATASET } from '../data/realTrackingDataset.js';

/**
 * Procesa una imagen (File, Blob o Base64 Data URL) y extrae líneas de datos tabulares.
 * 
 * @param {File|Blob|string} imageSource
 * @param {Function} onProgress - Callback para reportar % de avance (0 a 100)
 * @returns {Promise<{ rawText: string, parsedItems: Array }>}
 */
export async function extractDataFromImage(imageSource, onProgress = () => {}) {
  let worker = null;
  try {
    onProgress({ status: 'Iniciando motor OCR...', progress: 0.1 });
    worker = await createWorker('spa+eng');
    
    onProgress({ status: 'Analizando texto en la captura...', progress: 0.4 });
    const ret = await worker.recognize(imageSource);
    const rawText = ret.data.text || '';
    
    onProgress({ status: 'Estructurando métricas y cruzando con Catálogo Maestro...', progress: 0.9 });
    const parsedItems = parseTableText(rawText);
    
    await worker.terminate();
    onProgress({ status: '¡Listo!', progress: 1.0 });

    return { rawText, parsedItems };
  } catch (error) {
    if (worker) {
      try { await worker.terminate(); } catch (e) {}
    }
    console.error('Error en OCR:', error);
    throw new Error('No se pudo procesar la imagen: ' + (error.message || error));
  }
}

/**
 * Analiza texto en bruto de OCR o pegado manual y detecta filas y columnas.
 */
export function parseTableText(text) {
  if (!text || typeof text !== 'string') return [];

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return [];

  // Si es un CSV de tracking publicitario (ej. con campos como fecha, linea, cantadas, mensajes)
  const firstLine = lines[0].toLowerCase();
  if (firstLine.includes('linea') && (firstLine.includes('cantadas') || firstLine.includes('mensajes') || firstLine.includes('cxm'))) {
    return parseTrackingCsv(lines);
  }

  const items = [];
  const headerKeywords = ['tienda', 'linea', 'línea', 'campaña', 'presupuesto', 'gasto', 'costo', 'mensaje', 'cpm', 'efectividad', 'tasa', 'total', 'promedio'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Saltar si es claramente una línea de encabezado de tabla
    const isHeader = headerKeywords.filter(k => lowerLine.includes(k)).length >= 2;
    if (isHeader) continue;

    let tokens = [];
    if (line.includes('\t')) {
      tokens = line.split('\t').map(t => t.trim()).filter(Boolean);
    } else if (line.includes('|')) {
      tokens = line.split('|').map(t => t.trim()).filter(Boolean);
    } else if (line.includes(';') || (line.includes(',') && !line.match(/\d+,\d+/))) {
      tokens = line.split(/[;,]/).map(t => t.trim()).filter(Boolean);
    } else {
      tokens = line.split(/\s{2,}/).map(t => t.trim()).filter(Boolean);
      if (tokens.length < 2) {
        tokens = splitLineSmart(line);
      }
    }

    const parsed = parseLineTokens(tokens, items.length + 1);
    if (parsed) {
      items.push(parsed);
    }
  }

  return items;
}

/**
 * Procesa un reporte CSV/TSV de tracking multilínea y calcula la Efectividad Total
 */
function parseTrackingCsv(lines) {
  const delimiter = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
  const headers = lines[0].toLowerCase().split(delimiter).map(h => h.trim());

  const idxLinea = headers.findIndex(h => h === 'linea' || h === 'tienda' || h === 'linea_display');
  const idxGasto = headers.findIndex(h => h === 'gasto' || h === 'inversion' || h === 'spend');
  const idxPresupuesto = headers.findIndex(h => h === 'presupuesto' || h === 'budget');
  const idxMensajes = headers.findIndex(h => h === 'mensajes' || h === 'mensajes_recibidos' || h === 'conversaciones');
  const idxCxm = headers.findIndex(h => h === 'cxm' || h === 'cpm' || h === 'costo_x_mensaje');
  const idxCantadas = headers.findIndex(h => h === 'cantadas' || h === 'ventas' || h === 'cierres');
  const idxProducto = headers.findIndex(h => h === 'producto' || h === 'categoria');

  const storeMap = {};

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(delimiter).map(r => r.trim());
    if (row.length < 3) continue;

    const name = idxLinea !== -1 ? row[idxLinea] : row[0];
    if (!name) continue;

    const spend = idxGasto !== -1 ? cleanNumber(row[idxGasto]) || 0 : 0;
    const budget = idxPresupuesto !== -1 ? cleanNumber(row[idxPresupuesto]) || 0 : 0;
    const msgs = idxMensajes !== -1 ? cleanNumber(row[idxMensajes]) || 0 : 0;
    const cantadas = idxCantadas !== -1 ? cleanNumber(row[idxCantadas]) || 0 : 0;
    const rawCategory = idxProducto !== -1 ? row[idxProducto] : null;

    if (!storeMap[name]) {
      storeMap[name] = {
        name,
        rawCategory,
        totalSpend: 0,
        totalBudget: 0,
        totalMsgs: 0,
        totalCantadas: 0,
        budgetDays: 0
      };
    }

    storeMap[name].totalSpend += spend;
    if (budget > 0) {
      storeMap[name].totalBudget += budget;
      storeMap[name].budgetDays++;
    }
    storeMap[name].totalMsgs += msgs;
    storeMap[name].totalCantadas += cantadas;
  }

  return Object.values(storeMap)
    .filter(s => s.totalMsgs > 0 || s.totalSpend > 0)
    .map((s, idx) => {
      const catalogMatch = findInCatalog(s.name);
      const category = catalogMatch ? catalogMatch.category : detectCategory(s.rawCategory || s.name);
      const costPerMessage = s.totalMsgs > 0 ? (s.totalSpend / s.totalMsgs) : 1000;
      
      // Efectividad Total = (Total Ventas Cantadas / Total Mensajes) * 100%
      const effectiveness = s.totalMsgs > 0 ? ((s.totalCantadas / s.totalMsgs) * 100) : 10.0;
      const dailyBudget = s.budgetDays > 0 ? Math.round(s.totalBudget / s.budgetDays) : Math.round(s.totalSpend / 3);

      const baseItem = {
        id: `tracking-${idx + 1}-${Date.now()}`,
        name: catalogMatch ? catalogMatch.name : s.name,
        category,
        currentBudget: dailyBudget,
        costPerMessage: Number(costPerMessage.toFixed(2)),
        effectiveness: Number(effectiveness.toFixed(2)),
        currentMessages: s.totalMsgs
      };

      return enrichItemWithCatalog(baseItem);
    });
}

/**
 * Divide inteligentemente una línea en texto y números
 */
function splitLineSmart(line) {
  // Regex para encontrar números (incluyendo decimales, % o signos de moneda)
  const parts = line.split(/\s+/);
  if (parts.length < 2) return [line];

  // Identificar el bloque de texto inicial (nombre de tienda) y los números al final
  const textParts = [];
  const numParts = [];
  let foundFirstNumber = false;

  for (const part of parts) {
    const isNum = /[\d%$,.]/.test(part) && /\d/.test(part);
    if (isNum) {
      foundFirstNumber = true;
      numParts.push(part);
    } else if (!foundFirstNumber) {
      textParts.push(part);
    } else {
      // Palabra después de números
      numParts.push(part);
    }
  }

  const name = textParts.join(' ') || `Línea ${Math.floor(Math.random() * 100)}`;
  return [name, ...numParts];
}

/**
 * Detecta la categoría de producto basada en el nombre de la línea o campaña
 */
export function detectCategory(name) {
  if (!name || typeof name !== 'string') return 'GENERAL';
  const lower = name.toLowerCase();

  if (/camiset|polo|playera|remera|franela|t-shirt|top|blusa/i.test(lower)) {
    return 'CAMISETAS';
  }
  if (/conjunto|set|combo|coordinado|dos piezas|buzo|chandal/i.test(lower)) {
    return 'CONJUNTOS';
  }
  if (/pijama|dormir|sleepwear/i.test(lower)) {
    return 'PIJAMAS';
  }
  if (/shorcito|short|bermuda/i.test(lower)) {
    return 'SHORCITO';
  }
  if (/body|bodies/i.test(lower)) {
    return 'BODY';
  }
  if (/carpa|camping/i.test(lower)) {
    return 'CARPAS';
  }
  if (/smartwatch|reloj|tecnologia|tecnología/i.test(lower)) {
    return 'SMARTWATCH';
  }
  if (/boxer|boxers|cachetero|ropa interior/i.test(lower)) {
    return 'BOXERS';
  }
  if (/hogar|olla|parlante|manteca/i.test(lower)) {
    return 'HOGAR';
  }
  if (/pantalon|pantalón|jean|jeans|denim|legging/i.test(lower)) {
    return 'LEGGINS';
  }
  return 'GENERAL';
}

/**
 * Interpreta una lista de tokens para asignar: Nombre, Presupuesto, Costo por Mensaje, Efectividad, Categoría
 */
function parseLineTokens(tokens, index) {
  if (!tokens || tokens.length < 2) return null;

  // El primer token suele ser el nombre de la tienda/línea
  let name = tokens[0].trim();
  const remainingTokens = tokens.slice(1);

  // Extraer números limpios de los tokens restantes
  const numbers = [];
  let explicitEffectiveness = null;

  for (const tok of remainingTokens) {
    const cleanTok = tok.replace(/[$€£S\/\s]/gi, '').trim();
    
    // Si tiene símbolo de porcentaje (%) es claramente la efectividad
    if (cleanTok.includes('%')) {
      const val = parseFloat(cleanTok.replace('%', '').replace(',', '.'));
      if (!isNaN(val)) {
        explicitEffectiveness = val;
        continue;
      }
    }

    // Normalizar números con coma o punto
    const num = cleanNumber(cleanTok);
    if (num !== null && !isNaN(num)) {
      numbers.push(num);
    }
  }

  if (numbers.length === 0 && explicitEffectiveness === null) {
    return null;
  }

  let currentBudget = 500;
  let costPerMessage = 1.5;
  let effectiveness = explicitEffectiveness !== null ? explicitEffectiveness : 12;

  // Heurística de asignación según el rango de valores
  if (numbers.length === 1) {
    if (explicitEffectiveness !== null) {
      if (numbers[0] < 30) {
        costPerMessage = numbers[0];
      } else {
        currentBudget = numbers[0];
      }
    } else {
      costPerMessage = numbers[0];
    }
  } else if (numbers.length === 2) {
    if (explicitEffectiveness !== null) {
      const sorted = [...numbers].sort((a, b) => b - a);
      currentBudget = sorted[0];
      costPerMessage = sorted[1];
    } else {
      if (numbers[0] > 50 && numbers[1] < 50) {
        currentBudget = numbers[0];
        costPerMessage = numbers[1];
      } else {
        costPerMessage = Math.min(numbers[0], numbers[1]);
        effectiveness = Math.max(numbers[0], numbers[1]);
      }
    }
  } else if (numbers.length >= 3) {
    const sorted = [...numbers].sort((a, b) => b - a);
    currentBudget = sorted[0];
    
    const lowVals = numbers.filter(n => n < 30);
    if (lowVals.length > 0) {
      costPerMessage = lowVals[0];
    }

    if (explicitEffectiveness === null) {
      const midVals = numbers.filter(n => n >= 1 && n <= 100 && n !== costPerMessage);
      if (midVals.length > 0) {
        effectiveness = midVals[midVals.length - 1];
      }
    }
  }

  if (!name || /^\d+$/.test(name)) {
    name = `Línea ${index}`;
  }

  // Búsqueda y cruce con el Catálogo Maestro Oficial
  const catalogMatch = findInCatalog(name);
  const finalName = catalogMatch ? catalogMatch.name : name;
  const category = catalogMatch ? catalogMatch.category : detectCategory(name);

  return enrichItemWithCatalog({
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    name: finalName,
    category,
    currentBudget: Math.round(currentBudget),
    costPerMessage: Number(costPerMessage.toFixed(2)),
    effectiveness: Number(effectiveness.toFixed(1)),
    currentMessages: costPerMessage > 0 ? Math.round(currentBudget / costPerMessage) : 0
  });
}

/**
 * Genera una lista de tiendas a partir del Catálogo Maestro Oficial
 */
export function getStoresFromCatalog(filterCategory = null) {
  let list = STORE_CATALOG;
  if (filterCategory) {
    list = list.filter(it => it.category === filterCategory);
  }

  return list.map((it, idx) => enrichItemWithCatalog({
    id: `cat-${idx + 1}`,
    name: it.name,
    category: it.category,
    currentBudget: 150000,
    costPerMessage: 1200,
    effectiveness: 15.0,
    currentMessages: 125
  }));
}

function cleanNumber(str) {
  if (!str) return null;
  let s = str.trim();
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Datos de demostración listos para probar basados en el catálogo real y métricas de octubre
 */
export const SAMPLE_DATASETS = {
  defaultCase: REAL_TRACKING_DATASET,
  realTracking: REAL_TRACKING_DATASET,
  camisetasAndConjuntos: [
    { id: '1', name: 'DRISTRI PRO 1', category: 'CAMISETAS', currentBudget: 800000, costPerMessage: 719.51, effectiveness: 7.38, currentMessages: 786 },
    { id: '2', name: 'CLOTHES NEW 4', category: 'CAMISETAS', currentBudget: 700000, costPerMessage: 500.49, effectiveness: 3.07, currentMessages: 848 },
    { id: '3', name: 'AURA Y HOME 2', category: 'CAMISETAS', currentBudget: 900000, costPerMessage: 756.89, effectiveness: 9.83, currentMessages: 875 },
    { id: '4', name: 'CLOTHESNEW', category: 'CONJUNTOS', currentBudget: 1000000, costPerMessage: 697.47, effectiveness: 12.92, currentMessages: 720 },
    { id: '5', name: 'STYLE TRENDS 1', category: 'CONJUNTOS', currentBudget: 1000000, costPerMessage: 452.45, effectiveness: 10.72, currentMessages: 1306 },
    { id: '6', name: 'COMPRA MAS 4', category: 'PIJAMAS', currentBudget: 600000, costPerMessage: 378.32, effectiveness: 4.55, currentMessages: 1408 }
  ].map(enrichItemWithCatalog)
};

