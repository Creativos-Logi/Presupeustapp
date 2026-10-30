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

/**
 * Detecta si un conjunto de filas corresponde a un reporte semanal o multidía en formato tabla dinámica (pivot)
 * donde la primera fila contiene fechas y "Total", la segunda fila métricas (Gasto, CPM, Mensajes, Cantadas, Efectividad),
 * y la columna 0 contiene la jerarquía BPO > Categoría > Tienda.
 */
export function isWeeklyPivotReport(rows) {
  if (!rows || rows.length < 3) return false;

  // 1. Revisar si la fila 0 contiene fechas (DD/MM/YYYY) o "Total"
  const row0 = rows[0] || [];
  let dateCount = 0;
  let hasTotal = false;
  for (let c = 0; c < row0.length; c++) {
    const val = String(row0[c] || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val)) dateCount++;
    if (val.toLowerCase() === 'total') hasTotal = true;
  }

  // 2. Revisar si la fila 1 contiene columnas de métricas pivot (Gasto, CPM, CPA, Efectividad)
  const row1 = rows[1] || [];
  let pivotMetricCount = 0;
  for (let c = 0; c < row1.length; c++) {
    const val = String(row1[c] || '').trim().toLowerCase();
    if (/^(gasto|cpm|cpa|mensajes?|cantadas?|cargadas?|efectividad)/i.test(val)) {
      pivotMetricCount++;
    }
  }

  const col0_0 = String(rows[0]?.[0] || '').trim().toLowerCase();
  const col0_1 = String(rows[1]?.[0] || '').trim().toLowerCase();
  const hasRowLabels = col0_0.includes('etiquetas de fila') || col0_1.includes('etiquetas de fila');

  return (dateCount >= 1 && pivotMetricCount >= 4) || (hasRowLabels && pivotMetricCount >= 4) || (hasTotal && pivotMetricCount >= 4);
}

/**
 * Parsea un reporte semanal o multidía en formato tabla dinámica (pivot)
 * Extrayendo la jerarquía BPO > Categoría > Tienda y consolidando las métricas completas
 * (Gasto, CPM/CPR, Mensajes, Cantadas, Efectividad %) desde el bloque Total o acumulando días.
 */
export function parseWeeklyPivotReport(rows) {
  if (!rows || rows.length < 3) {
    return { parsedItems: [], detectedType: 'BOTH', columnsFound: [], headers: [] };
  }

  const headerDatesRow = rows[0] || [];
  const headerMetricsRow = rows[1] || [];
  const dataStartRow = 2;

  // 1. Ubicar el inicio del bloque "Total" en la fila 0
  let totalColStart = -1;
  for (let c = 0; c < headerDatesRow.length; c++) {
    if (String(headerDatesRow[c] || '').trim().toLowerCase() === 'total') {
      totalColStart = c;
      break;
    }
  }

  // 2. Mapear las columnas de métricas dentro del bloque Total
  const totalCols = {};
  if (totalColStart !== -1) {
    for (let c = totalColStart; c < headerMetricsRow.length; c++) {
      const h = String(headerMetricsRow[c] || '').trim().toLowerCase();
      if (/^gasto|^presupuesto|^inversion|^spend/i.test(h) && totalCols.budget === undefined) totalCols.budget = c;
      else if (/^cpm|^cpr|^costo.*(msg|mens|res)/i.test(h) && totalCols.costPerMessage === undefined) totalCols.costPerMessage = c;
      else if (/^mensajes?|^msg|^resultados/i.test(h) && totalCols.messages === undefined) totalCols.messages = c;
      else if (/^cantadas?|^ventas?|^pedidos/i.test(h) && totalCols.cantadas === undefined) totalCols.cantadas = c;
      else if (/^efectividad|^conversion/i.test(h) && totalCols.effectiveness === undefined) totalCols.effectiveness = c;
    }
  }

  // Fallback a posiciones estándar si alguna métrica no vino explícitamente etiquetada
  if (totalColStart !== -1) {
    if (totalCols.budget === undefined) totalCols.budget = totalColStart + 0;
    if (totalCols.costPerMessage === undefined) totalCols.costPerMessage = totalColStart + 1;
    if (totalCols.messages === undefined) totalCols.messages = totalColStart + 2;
    if (totalCols.effectiveness === undefined) totalCols.effectiveness = totalColStart + 4;
    if (totalCols.cantadas === undefined) totalCols.cantadas = totalColStart + 5;
  }

  let currentBpo = '';
  let currentCategory = '';
  const storeMap = new Map();
  let itemIndex = 1;

  for (let r = dataStartRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const col0 = String(row[0] || '');
    const trimmed = col0.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase() === 'undefined' || trimmed.toLowerCase().startsWith('total general')) continue;

    const spaces = (col0.match(/^(\s*)/) || [''])[0].length;
    const isStore = spaces >= 3 || /\(\+?\d+\)/.test(col0) || (findInCatalog(trimmed) !== null);

    if (!isStore) {
      const upper = trimmed.toUpperCase();
      if (spaces === 0 || ['BTK', 'ELT', 'BTK GR', 'E-HUK MEDELLIN', 'WAICHAT', '(SIN BPO)'].includes(upper)) {
        currentBpo = trimmed;
      } else {
        currentCategory = trimmed;
      }
      continue;
    }

    // Tienda
    const rawStoreName = trimmed;
    const cleanName = rawStoreName.replace(/\s*\(\+?\d+\)\s*$/, '').trim();
    const cleanWithoutPhone = cleanName.replace(/^\+?\d{7,15}\s*([·\-\|:]\s*)?/, '').trim();

    // Cruce con catálogo maestro
    const catalogMatch = findInCatalog(cleanWithoutPhone) || findInCatalog(cleanName) || findInCatalog(rawStoreName);
    const canonicalName = catalogMatch ? catalogMatch.name : (cleanWithoutPhone || cleanName || rawStoreName);
    const storeKey = canonicalName.toLowerCase();

    // Extraer métricas
    let budget = 0;
    let rawCpm = 0;
    let messages = 0;
    let cantadas = 0;
    let rawEff = 0;

    if (totalColStart !== -1) {
      budget = cleanNumericValue(row[totalCols.budget]);
      rawCpm = cleanNumericValue(row[totalCols.costPerMessage]);
      messages = Math.round(cleanNumericValue(row[totalCols.messages]));
      cantadas = Math.round(cleanNumericValue(row[totalCols.cantadas]));
      rawEff = cleanNumericValue(row[totalCols.effectiveness]);
    } else {
      // Si no hay bloque Total, sumar columnas de fechas individuales
      for (let c = 1; c < row.length; c += 8) {
        budget += cleanNumericValue(row[c]);
        messages += Math.round(cleanNumericValue(row[c + 2]));
        cantadas += Math.round(cleanNumericValue(row[c + 5]));
      }
    }

    if (storeMap.has(storeKey)) {
      // Consolidar entradas duplicadas (ej. campaña de pago + canal orgánico sin bpo)
      const existing = storeMap.get(storeKey);
      existing.currentBudget += budget;
      existing.currentMessages += messages;
      existing.cantadas += cantadas;
      existing.currentEffectiveMessages = existing.cantadas;
      if (existing.currentMessages > 0) {
        existing.effectiveness = Number(((existing.cantadas / existing.currentMessages) * 100).toFixed(2));
        existing.costPerMessage = Number((existing.currentBudget / existing.currentMessages).toFixed(2));
      }
      if (currentCategory && currentCategory !== '(Sin producto)' && existing.category === '(Sin producto)') {
        existing.category = currentCategory;
        existing.product = currentCategory;
      }
      if (currentBpo && currentBpo !== '(Sin BPO)' && existing.bpo === '(Sin BPO)') {
        existing.bpo = currentBpo;
      }
    } else {
      let effectiveness = 0;
      if (messages === 0 && cantadas > 0) {
        effectiveness = 100.0;
      } else if (messages > 0 && cantadas > messages) {
        effectiveness = 100.0;
      } else if (messages > 0) {
        effectiveness = Number(((cantadas / messages) * 100).toFixed(2));
      } else {
        effectiveness = rawEff;
      }

      let costPerMessage = 0;
      if (rawCpm > 0) {
        costPerMessage = Number(rawCpm.toFixed(2));
      } else if (budget > 0 && messages > 0) {
        costPerMessage = Number((budget / messages).toFixed(2));
      }

      const itemCategory = (catalogMatch?.category && catalogMatch.category !== 'GENERAL')
        ? catalogMatch.category
        : (currentCategory && currentCategory !== '(Sin producto)' ? currentCategory : 'GENERAL');

      const itemProduct = (catalogMatch?.product && catalogMatch.product !== 'GENERAL')
        ? catalogMatch.product
        : (currentCategory && currentCategory !== '(Sin producto)' ? currentCategory : 'GENERAL');

      const itemBpo = catalogMatch?.group || (currentBpo && currentBpo !== '(Sin BPO)' ? currentBpo : '');

      const item = {
        id: `pivot-${itemIndex++}-${Math.random().toString(36).substr(2, 5)}`,
        name: canonicalName,
        rawName: rawStoreName,
        currentBudget: budget,
        costPerMessage,
        effectiveness,
        currentMessages: messages,
        currentEffectiveMessages: cantadas,
        cantadas,
        category: itemCategory,
        product: itemProduct,
        coordinator: catalogMatch?.coordinator || 'SIN ASIGNAR',
        trafiker: catalogMatch?.trafiker || 'SIN ASIGNAR',
        bpo: itemBpo,
        status: catalogMatch?.status || 'ACTIVA',
        isDynamic: !catalogMatch
      };

      storeMap.set(storeKey, enrichItemWithCatalog(item));
    }
  }

  const parsedItems = Array.from(storeMap.values());

  return {
    parsedItems,
    detectedType: 'BOTH',
    columnsFound: ['name', 'budget', 'costPerMessage', 'messages', 'cantadas', 'effectiveness'],
    headers: headerMetricsRow
  };
}

/**
 * Detecta si un conjunto de filas corresponde a un reporte matricial / tabla dinámica
 * (donde las tiendas están en columnas horizontales con métricas repetidas como Msg, Vent, Ef).
 */
export function isMatrixReport(rows) {
  if (!rows || rows.length < 2) return false;

  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    let matchCount = 0;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim().toLowerCase();
      if (/^(msg|mensajes?|vent|ventas?|cantadas?|ef\.?|efectividad)(\s*\(%\))?$/i.test(val)) {
        matchCount++;
      }
    }
    if (matchCount >= 6) {
      return true;
    }
  }
  return false;
}

/**
 * Parsea un reporte matricial donde las tiendas están ubicadas a lo largo de las columnas
 * con métricas de Mensajes, Ventas/Cantadas y Efectividad %.
 */
export function parseMatrixReport(rows) {
  if (!rows || rows.length < 2) {
    return { parsedItems: [], detectedType: 'EFFECTIVENESS', columnsFound: [], headers: [] };
  }

  // 1. Identificar la fila que contiene las sub-métricas (Msg, Vent, Ef) y la de tiendas
  let storeRowIdx = 0;
  let metricRowIdx = 1;

  for (let r = 0; r < Math.min(4, rows.length); r++) {
    const row = rows[r];
    if (!row) continue;
    let metricCount = 0;
    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim().toLowerCase();
      if (/^(msg|mensajes?|vent|ventas?|cantadas?|ef\.?|efectividad)(\s*\(%\))?$/i.test(val)) {
        metricCount++;
      }
    }
    if (metricCount >= 6) {
      metricRowIdx = r;
      storeRowIdx = Math.max(0, r - 1);
      break;
    }
  }

  const storeRow = rows[storeRowIdx] || [];
  const metricRow = rows[metricRowIdx] || [];
  const dataStartRow = metricRowIdx + 1;

  // 2. Buscar la fila consolidada "Total General Hoy" o "Total Hoy"
  let totalRow = null;
  for (let r = dataStartRow; r < rows.length; r++) {
    const firstCell = String(rows[r]?.[0] || '').trim().toLowerCase();
    if (firstCell.includes('total general hoy') || firstCell === 'total hoy') {
      totalRow = rows[r];
      break;
    }
  }

  // Si no se encuentra "Total General Hoy", buscar "Total General" (que no sea de ayer)
  if (!totalRow) {
    for (let r = dataStartRow; r < rows.length; r++) {
      const firstCell = String(rows[r]?.[0] || '').trim().toLowerCase();
      if (firstCell.includes('total general') && !firstCell.includes('ayer')) {
        totalRow = rows[r];
        break;
      }
    }
  }

  // 3. Extraer las tiendas recorriendo las columnas de la fila de encabezados
  const parsedItems = [];
  let itemIndex = 1;
  const seenStores = new Set();

  for (let c = 1; c < storeRow.length; c++) {
    const rawHeader = String(storeRow[c] || '').trim();
    if (!rawHeader || rawHeader.toLowerCase() === 'total general' || rawHeader.toLowerCase() === 'total') continue;

    // Detectar columnas correspondientes a Msg, Vent, Ef
    let colMsg = c;
    let colVent = c + 1;
    let colEf = c + 2;

    const sub0 = String(metricRow[c] || '').trim().toLowerCase();
    if (/vent|cantadas/i.test(sub0)) {
      colVent = c;
      colMsg = c - 1;
    }

    let msgs = 0;
    let vent = 0;
    let reportedEf = 0;

    if (totalRow) {
      msgs = cleanNumericValue(totalRow[colMsg]);
      vent = cleanNumericValue(totalRow[colVent]);
      reportedEf = cleanNumericValue(totalRow[colEf]);
    } else {
      // Sumar filas horarias si no existe fila consolidada
      for (let r = dataStartRow; r < rows.length; r++) {
        const rowLabel = String(rows[r]?.[0] || '').trim().toLowerCase();
        if (rowLabel.startsWith('total') || rowLabel.startsWith('promedio')) continue;
        msgs += cleanNumericValue(rows[r]?.[colMsg]);
        vent += cleanNumericValue(rows[r]?.[colVent]);
      }
    }

    // Normalizar nombre de tienda removiendo prefijo telefónico si está presente
    const cleanName = rawHeader.replace(/^\+?\d{7,15}\s*([·\-\|:]\s*)?/, '').trim();
    
    // Buscar coincidencia en catálogo maestro
    let catalogMatch = findInCatalog(cleanName);
    if (!catalogMatch) {
      catalogMatch = findInCatalog(cleanName.replace(/\s*\(\d+\)$/, '').trim());
    }

    const canonicalName = catalogMatch ? catalogMatch.name : cleanName;
    const storeKey = canonicalName.toLowerCase();

    if (seenStores.has(storeKey)) continue;
    seenStores.add(storeKey);

    // TRATAMIENTO DE ANOMALÍAS MATEMÁTICAS:
    let finalMsgs = Math.round(msgs);
    let finalVent = Math.round(vent);
    let effectiveness = 0;

    if (finalMsgs === 0 && finalVent > 0) {
      // Anomalía: Ventas con 0 mensajes entrantes (ej. DISMERCA COLOMBIA 6 ventas)
      // Se imputa 1 conversación por venta concretada para proteger la tienda y evitar división por cero
      finalMsgs = finalVent;
      effectiveness = 100.0;
    } else if (finalMsgs > 0 && finalVent > finalMsgs) {
      // Anomalía: Ventas > Mensajes (ej. STYLE TRENDS 1: 1 msg, 2 ventas -> 200%)
      // Se limita la efectividad computable al 100% para evitar distorsiones por muestra pequeña
      effectiveness = 100.0;
    } else if (finalMsgs > 0) {
      effectiveness = Number(((finalVent / finalMsgs) * 100).toFixed(2));
    } else {
      effectiveness = 0.0;
    }

    const item = {
      id: `matrix-${itemIndex++}-${Math.random().toString(36).substr(2, 5)}`,
      name: canonicalName,
      rawName: rawHeader,
      currentBudget: 0,
      costPerMessage: 0,
      effectiveness,
      currentMessages: finalMsgs,
      currentEffectiveMessages: finalVent,
      cantadas: finalVent,
      category: catalogMatch?.category || 'GENERAL',
      product: catalogMatch?.product || 'GENERAL',
      trafiker: catalogMatch?.trafiker || 'Sin asignar',
      coordinator: catalogMatch?.coordinator || 'Sin asignar',
      bpo: catalogMatch?.group || '',
      status: catalogMatch?.status || 'ACTIVA',
      isDynamic: !catalogMatch
    };

    parsedItems.push(enrichItemWithCatalog(item));
  }

  return {
    parsedItems,
    detectedType: 'EFFECTIVENESS',
    columnsFound: ['name', 'messages', 'cantadas', 'effectiveness'],
    headers: storeRow
  };
}

/**
 * Detecta si un conjunto de filas corresponde a una planilla maestra de tiendas o asignación de presupuestos diarios
 * (ejemplo: Columna 0 teléfono, Columna 1 nombre de tienda, última columna con presupuesto diario como "$250.000",
 * o filas sin encabezados donde se asocian tiendas y montos presupuestarios).
 */
export function isDailyBudgetRoster(rows) {
  if (!rows || rows.length < 1) return false;

  // Si tiene palabras clave de métricas operativas (mensajes, cantadas, cpm, costo por resultado), NO es planilla de presupuestos
  const row0Str = (rows[0] || []).join(" ").toLowerCase();
  if (/mensajes?|cantadas?|cpm|cpa|costo por|efectividad|conversiones/i.test(row0Str)) {
    return false;
  }

  let matches = 0;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    const col0Trimmed = String(row[0] || "").trim();
    const isPhone = /^\+?3\d{9}$/.test(col0Trimmed);

    const lastCell = String(row[row.length - 1] || "").trim();
    const hasBudget = /\$?\s*\d{1,3}(\.\d{3})+/.test(lastCell) || 
      (Number(lastCell.replace(/[^0-9]/g, "")) >= 10000 && Number(lastCell.replace(/[^0-9]/g, "")) <= 50000000);

    if (isPhone && hasBudget) {
      matches++;
    }
  }

  return matches >= 1;
}

/**
 * Parsea una planilla maestra o tabla pegada de tiendas y presupuestos diarios.
 * Extrae: nombre de tienda, teléfono, presupuesto diario ($), categoría, coordinador, trafiker, y estado.
 */
export function parseDailyBudgetRoster(rows) {
  const parsedItems = [];
  let itemIdx = 1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;

    // Saltar fila de encabezado si existe
    const rowStr = row.join(" ").toLowerCase();
    if ((rowStr.includes("telefono") || rowStr.includes("phone")) && 
        (rowStr.includes("tienda") || rowStr.includes("linea") || rowStr.includes("nombre")) && 
        (rowStr.includes("presupuesto") || rowStr.includes("budget") || rowStr.includes("gasto"))) {
      continue;
    }

    const col0 = String(row[0] || "").trim();
    const isPhoneCol0 = /^\+?3\d{9}$/.test(col0);

    let storeName = "";
    let phone = "";
    if (isPhoneCol0) {
      phone = col0;
      storeName = String(row[1] || "").trim();
    } else {
      // Buscar si alguna columna es el nombre de la tienda en el catálogo
      for (let c = 0; c < Math.min(3, row.length); c++) {
        const val = String(row[c] || "").trim();
        if (findInCatalog(val)) {
          storeName = val;
          break;
        }
      }
      if (!storeName) storeName = col0;
    }

    if (!storeName || /^(telefono|tienda|nombre|presupuesto)$/i.test(storeName)) continue;

    // Buscar presupuesto diario desde la derecha
    let dailyBudget = 0;
    for (let c = row.length - 1; c >= 1; c--) {
      const val = String(row[c] || "").trim();
      if (val && (val.includes("$") || /\b\d{1,3}(\.\d{3})+\b/.test(val) || Number(val.replace(/[^0-9]/g, "")) >= 10000)) {
        dailyBudget = cleanNumericValue(val);
        break;
      }
    }

    // Extraer metadatos
    let coordinator = "";
    let category = "";
    let product = "";
    let trafiker = "";
    let group = "";
    let status = "ACTIVA";

    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || "").trim();
      if (/^(ACTIVA|INACTIVA|PAUSADA)$/i.test(cell)) status = cell.toUpperCase();
      if (/^(GOMEZ|ALEJANDRA|ANDREA|JORGE|ERIKA|PABLO|WILL)$/i.test(cell)) coordinator = cell.toUpperCase();
      if (/^(Oscar|Julio)$/i.test(cell)) trafiker = cell;
      if (/^(BTK|BTK GR|ELT|E-HUK MEDELLIN|WAICHAT)$/i.test(cell)) group = cell.toUpperCase();
      if (/^(CAMISETAS|CONJUNTOS|CARPAS|BODY|SHORCITO|PIJAMAS|SMARTWATCH|BOXERS|LEGGINS|HOGAR)/i.test(cell)) {
        category = cell.toUpperCase();
        product = cell.toUpperCase();
      }
    }

    const catalogMatch = findInCatalog(storeName) || (phone ? findInCatalog(phone) : null);

    parsedItems.push(enrichItemWithCatalog({
      id: "roster-" + (itemIdx++),
      name: catalogMatch ? catalogMatch.name : storeName,
      phone: phone || (catalogMatch ? catalogMatch.phone : ""),
      currentBudget: dailyBudget,
      dailyBudget,
      category: category || (catalogMatch ? catalogMatch.category : "GENERAL"),
      product: product || (catalogMatch ? catalogMatch.product : "GENERAL"),
      coordinator: coordinator || (catalogMatch ? catalogMatch.coordinator : "SIN ASIGNAR"),
      trafiker: trafiker || (catalogMatch ? catalogMatch.trafiker : "SIN ASIGNAR"),
      group: group || (catalogMatch ? catalogMatch.group : "BTK"),
      status: status || (catalogMatch ? catalogMatch.status : "ACTIVA"),
      isDynamic: !catalogMatch
    }));
  }

  return {
    parsedItems,
    detectedType: "COST",
    columnsFound: ["name", "budget", "phone", "category", "coordinator", "trafiker"],
    headers: []
  };
}

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

  // 2.1 Detectar si es un reporte pivot semanal/multidía (jerarquía BPO > Categoría > Tienda)
  if (isWeeklyPivotReport(rows)) {
    return parseWeeklyPivotReport(rows);
  }

  // 2.2 Detectar si es un reporte matricial horizontal (tiendas en columnas, horas en filas)
  if (isMatrixReport(rows)) {
    return parseMatrixReport(rows);
  }

  // 2.3 Detectar si es una planilla maestra de tiendas con presupuestos diarios
  if (isDailyBudgetRoster(rows)) {
    return parseDailyBudgetRoster(rows);
  }

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

  // Detectar si es un reporte pivot semanal/multidía en Excel
  if (isWeeklyPivotReport(rows)) {
    return parseWeeklyPivotReport(rows);
  }

  // Detectar si es un reporte matricial horizontal en Excel
  if (isMatrixReport(rows)) {
    return parseMatrixReport(rows);
  }

  // Detectar si es una planilla maestra de tiendas con presupuestos diarios en Excel
  if (isDailyBudgetRoster(rows)) {
    return parseDailyBudgetRoster(rows);
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
export function parseDelimitedLine(line, delimiter) {
  const values = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === delimiter && !insideQuotes) {
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }

  values.push(currentValue);
  return values;
}
