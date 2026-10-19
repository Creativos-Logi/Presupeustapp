import * as XLSX from 'xlsx';
import { findInCatalog, enrichItemWithCatalog } from '../data/storeCatalog.js';

/**
 * Normaliza nombres de encabezados para facilitar el matching flexible
 */
function normalizeHeader(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia y convierte cadenas monetarias o porcentuales a números limpios
 * Soporta formatos: "$ 1.250.000", "1,250.000", "15,5%", "15.5%", "1200"
 */
export function cleanNumericValue(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  let str = String(val).trim();
  // Quitar símbolos de moneda, %, letras y espacios
  str = str.replace(/[$%€\sCOP]/gi, '');

  if (!str) return 0;

  // Si tiene coma y punto, determinar cuál es separador de miles y cuál de decimales
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');

  if (hasComma && hasDot) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // Formato latino/europeo: 1.250.000,50 -> 1250000.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato anglosajón: 1,250,000.50 -> 1250000.50
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Si solo tiene coma: "15,5" -> 15.5 o "1,250"
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Es un decimal: ej. 15,5 -> 15.5
      str = str.replace(',', '.');
    } else {
      // Es separador de miles: ej. 1,250,000 -> 1250000
      str = str.replace(/,/g, '');
    }
  } else if (hasDot) {
    // Si solo tiene punto: puede ser 15.5 o 1.250.000
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // Separador de miles: 1.250.000 o 350.000
      str = str.replace(/\./g, '');
    }
    // Si es tipo 15.5, se mantiene como decimal
  }

  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Diccionario de patrones para mapear encabezados a propiedades estándar
 */
const COLUMN_PATTERNS = {
  name: [
    'linea', 'tienda linea', 'tienda', 'nombre', 'nombre de la campana', 'campana',
    'cuenta', 'store', 'producto tienda', 'id tienda', 'pagina', 'cliente'
  ],
  costPerMessage: [
    'costo por resultado', 'costo por mensaje', 'costo x mensaje', 'costo mensaje',
    'cxm', 'cpm', 'cost per result', 'costo promedio', 'c msg', 'costo', 'cpr'
  ],
  effectiveness: [
    'efectividad', 'efectividad total', 'promedio efectividad', 'tasa efectividad',
    'porcentaje efectividad', 'eff', 'ratio', 'conversion', 'tasa conversion'
  ],
  budget: [
    'presupuesto', 'presupuesto actual', 'budget', 'importe gastado', 'gasto',
    'spend', 'inversion', 'presupuesto diario'
  ],
  messages: [
    'mensajes', 'mensajes actuales', 'mensajes generados', 'conversaciones',
    'resultados', 'results', 'messages', 'leads', 'inbox'
  ],
  cantadas: [
    'cantadas', 'ventas', 'pedidos', 'compras', 'conversiones', 'concreciones', 'cierres'
  ],
  product: ['producto', 'product', 'articulo', 'item'],
  category: ['categoria', 'category', 'nicho', 'linea de producto'],
  trafiker: ['trafiker', 'trafficker', 'media buyer', 'encargado'],
  coordinator: ['coordinador', 'coordinator', 'lider'],
  bpo: ['bpo', 'agencia', 'empresa'],
  status: ['estado', 'status', 'activo']
};

/**
 * Identifica la correspondencia entre los encabezados del archivo y las propiedades
 */
export function identifyColumns(headers) {
  const mapping = {};

  headers.forEach((header, colIdx) => {
    const cleanHeader = normalizeHeader(header);
    if (!cleanHeader) return;

    for (const [prop, patterns] of Object.entries(COLUMN_PATTERNS)) {
      if (mapping[prop] !== undefined) continue; // Ya fue mapeada

      const matched = patterns.some(pattern => {
        return cleanHeader === pattern || cleanHeader.includes(pattern) || pattern.includes(cleanHeader);
      });

      if (matched) {
        mapping[prop] = colIdx;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Agrupa y consolida filas por tienda (ideal para reportes horarios de WhatsApp o exportes de campañas)
 * Suma mensajes y cantadas, calcula efectividad real = (cantadas / mensajes * 100) y extrae metadatos.
 */
export function aggregateRowsByStore(rawRows, colMap) {
  const storeMap = new Map();

  for (let r = 0; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    const rawName = String(row[colMap.name] || '').trim();
    if (!rawName || rawName.toUpperCase() === 'TOTAL' || rawName.toUpperCase() === 'PROMEDIO') continue;

    const storeKey = rawName.toLowerCase();
    const catalogMatch = findInCatalog(rawName);
    // Usar la tipografía oficial del catálogo solo si coincide con el nombre del archivo
    const canonicalName = (catalogMatch && catalogMatch.name.toLowerCase() === storeKey) ? catalogMatch.name : rawName;

    // Extraer valores numéricos
    const hasBudget = colMap.budget !== undefined;
    const hasCost = colMap.costPerMessage !== undefined;
    const hasMsgs = colMap.messages !== undefined;
    const hasCantadas = colMap.cantadas !== undefined;
    const hasEff = colMap.effectiveness !== undefined;

    const rowBudget = hasBudget ? cleanNumericValue(row[colMap.budget]) : 0;
    const rowCost = hasCost ? cleanNumericValue(row[colMap.costPerMessage]) : 0;
    const rowMsgs = hasMsgs ? cleanNumericValue(row[colMap.messages]) : 0;
    const rowCantadas = hasCantadas ? cleanNumericValue(row[colMap.cantadas]) : 0;
    const rowEff = hasEff ? cleanNumericValue(row[colMap.effectiveness]) : undefined;

    // Metadatos
    const rowProduct = colMap.product !== undefined ? String(row[colMap.product] || '').trim() : '';
    const rowCategory = colMap.category !== undefined ? String(row[colMap.category] || '').trim() : '';
    const rowCoordinator = colMap.coordinator !== undefined ? String(row[colMap.coordinator] || '').trim() : '';
    const rowTrafiker = colMap.trafiker !== undefined ? String(row[colMap.trafiker] || '').trim() : '';
    const rowBpo = colMap.bpo !== undefined ? String(row[colMap.bpo] || '').trim() : '';
    const rowStatus = colMap.status !== undefined ? String(row[colMap.status] || '').trim() : '';

    if (!storeMap.has(storeKey)) {
      storeMap.set(storeKey, {
        name: canonicalName,
        totalBudget: 0,
        hasBudget,
        costSum: 0,
        costCount: 0,
        hasCost,
        totalMessages: 0,
        hasMsgs,
        totalCantadas: 0,
        hasCantadas,
        effSum: 0,
        effCount: 0,
        hasEff,
        product: rowProduct || (catalogMatch ? catalogMatch.product : 'GENERAL'),
        category: rowCategory || rowProduct || (catalogMatch ? catalogMatch.category : 'GENERAL'),
        coordinator: rowCoordinator || (catalogMatch ? catalogMatch.coordinator : 'SIN ASIGNAR'),
        trafiker: rowTrafiker || (catalogMatch ? catalogMatch.trafiker : 'SIN ASIGNAR'),
        bpo: rowBpo || (catalogMatch ? catalogMatch.group : ''),
        status: rowStatus || (catalogMatch ? catalogMatch.status : 'ACTIVA'),
        rowCount: 0
      });
    }

    const s = storeMap.get(storeKey);
    s.rowCount++;
    if (hasBudget) s.totalBudget += rowBudget;
    if (hasCost && rowCost > 0) {
      s.costSum += rowCost;
      s.costCount++;
    }
    if (hasMsgs) s.totalMessages += rowMsgs;
    if (hasCantadas) s.totalCantadas += rowCantadas;
    if (hasEff && rowEff !== undefined && !isNaN(rowEff)) {
      s.effSum += rowEff;
      s.effCount++;
    }

    if (rowProduct && (!s.product || s.product === 'GENERAL')) s.product = rowProduct;
    if (rowCoordinator && (!s.coordinator || s.coordinator === 'SIN ASIGNAR')) s.coordinator = rowCoordinator;
    if (rowTrafiker && (!s.trafiker || s.trafiker === 'SIN ASIGNAR')) s.trafiker = rowTrafiker;
    if (rowBpo && !s.bpo) s.bpo = rowBpo;
  }

  const parsedItems = [];
  let itemIndex = 1;

  for (const [_, s] of storeMap.entries()) {
    let effectiveness = undefined;
    if (s.hasCantadas && s.hasMsgs) {
      effectiveness = s.totalMessages > 0 ? Number(((s.totalCantadas / s.totalMessages) * 100).toFixed(2)) : 0;
    } else if (s.hasEff && s.effCount > 0) {
      effectiveness = Number((s.effSum / s.effCount).toFixed(2));
    }

    let costPerMessage = undefined;
    if (s.hasCost && s.costCount > 0) {
      costPerMessage = Number((s.costSum / s.costCount).toFixed(2));
    } else if (s.hasBudget && s.hasMsgs && s.totalMessages > 0 && s.totalBudget > 0) {
      costPerMessage = Number((s.totalBudget / s.totalMessages).toFixed(2));
    } else if (s.hasCost) {
      costPerMessage = 0;
    }

    const budget = s.hasBudget ? Number(s.totalBudget.toFixed(2)) : undefined;
    const messages = s.hasMsgs ? Math.round(s.totalMessages) : undefined;
    const cantadas = s.hasCantadas ? Math.round(s.totalCantadas) : undefined;

    const catalogMatch = findInCatalog(s.name);
    const item = {
      id: `file-${itemIndex++}-${Math.random().toString(36).substr(2, 5)}`,
      name: s.name,
      currentBudget: budget,
      costPerMessage: costPerMessage,
      effectiveness: effectiveness,
      currentMessages: messages !== undefined ? messages : (costPerMessage && budget ? Math.round(budget / costPerMessage) : undefined),
      currentEffectiveMessages: cantadas !== undefined ? cantadas : (messages && effectiveness ? Math.round(messages * (effectiveness / 100)) : undefined),
      cantadas,
      category: s.category || (catalogMatch?.category || 'GENERAL'),
      product: s.product || (catalogMatch?.product || 'GENERAL'),
      trafiker: s.trafiker || (catalogMatch?.trafiker || 'SIN ASIGNAR'),
      coordinator: s.coordinator || (catalogMatch?.coordinator || 'SIN ASIGNAR'),
      bpo: s.bpo || (catalogMatch?.group || ''),
      status: s.status || (catalogMatch?.status || 'ACTIVA'),
      isDynamic: !catalogMatch
    };

    parsedItems.push(enrichItemWithCatalog(item));
  }

  return parsedItems;
}

/**
 * Parsea un archivo de tipo CSV o texto delimitado
 */
export function parseDelimitedText(text) {
  if (!text || !text.trim()) return [];

  const rawLines = text.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
  if (rawLines.length === 0) return [];

  // 1. Detectar delimitador inspeccionando las primeras líneas
  const sampleLines = rawLines.slice(0, Math.min(5, rawLines.length));
  const delimiters = [';', '\t', ',', '|'];
  let bestDelimiter = ';';
  let maxCount = -1;

  delimiters.forEach(delim => {
    const count = sampleLines.reduce((acc, line) => acc + (line.split(delim).length - 1), 0);
    if (count > maxCount) {
      maxCount = count;
      bestDelimiter = delim;
    }
  });

  // 2. Separar filas respetando comillas
  const rows = rawLines.map(line => parseDelimitedLine(line, bestDelimiter));
  if (rows.length < 2) return [];

  // Encabezados
  const headers = rows[0].map(h => String(h).trim());
  const colMap = identifyColumns(headers);

  // Si no se detectó columna 'name', usar la primera columna que tenga texto
  if (colMap.name === undefined) {
    colMap.name = 0;
  }

  const rawDataRows = rows.slice(1);
  const parsedItems = aggregateRowsByStore(rawDataRows, colMap);

  // Detectar automáticamente el tipo de métricas presentes en el archivo
  const hasCost = colMap.costPerMessage !== undefined || colMap.budget !== undefined;
  const hasEff = colMap.effectiveness !== undefined || (colMap.cantadas !== undefined && colMap.messages !== undefined);

  let detectedType = 'BOTH';
  if (hasCost && !hasEff) detectedType = 'COST';
  else if (!hasCost && hasEff) detectedType = 'EFFECTIVENESS';

  return {
    parsedItems,
    detectedType,
    columnsFound: Object.keys(colMap),
    headers
  };
}

/**
 * Parsea un ArrayBuffer de un libro Excel (.xlsx / .xls)
 */
export function parseExcelWorkbook(dataBuffer) {
  const workbook = XLSX.read(dataBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convertir a matriz 2D de celdas
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) {
    return { parsedItems: [], detectedType: 'BOTH', columnsFound: [], headers: [] };
  }

  // Buscar fila de encabezados (primera fila no vacía)
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row && row.some(cell => String(cell).trim().length > 0)) {
      headerRowIdx = i;
      break;
    }
  }

  const headers = rows[headerRowIdx].map(c => String(c).trim());
  const colMap = identifyColumns(headers);

  if (colMap.name === undefined) {
    colMap.name = 0;
  }

  const rawDataRows = rows.slice(headerRowIdx + 1);
  const parsedItems = aggregateRowsByStore(rawDataRows, colMap);

  const hasCost = colMap.costPerMessage !== undefined || colMap.budget !== undefined;
  const hasEff = colMap.effectiveness !== undefined || (colMap.cantadas !== undefined && colMap.messages !== undefined);

  let detectedType = 'BOTH';
  if (hasCost && !hasEff) detectedType = 'COST';
  else if (!hasCost && hasEff) detectedType = 'EFFECTIVENESS';

  return {
    parsedItems,
    detectedType,
    columnsFound: Object.keys(colMap),
    headers,
    sheetName: firstSheetName
  };
}

/**
 * Función maestra para leer cualquier archivo (File) subido por el usuario
 */
export async function parseUploadedTabularFile(file) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    return parseExcelWorkbook(buffer);
  }

  if (fileName.endsWith('.csv') || fileName.endsWith('.tsv') || fileName.endsWith('.txt')) {
    const text = await file.text();
    return parseDelimitedText(text);
  }

  throw new Error(`Formato de archivo no soportado: ${file.name}. Usa .xlsx, .xls, .csv, o imágenes.`);
}

/**
 * Función auxiliar para parsear una línea CSV respetando comillas
 */
function parseDelimitedLine(line, delimiter) {
  const values = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  values.push(currentValue.trim());
  return values;
}
