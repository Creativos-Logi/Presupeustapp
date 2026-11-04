import { findInCatalog, enrichItemWithCatalog } from '../data/storeCatalog.js';

/**
 * Fusiona de manera inteligente los datos extraídos de un archivo subido (Excel, CSV o Captura)
 * PRIORIZANDO SIEMPRE los datos recién cargados sobre los datos que ya estaban guardados.
 * Soporta concordancia por ID, Nombre limpio y Número Telefónico de 10 dígitos.
 * 
 * @param {Array} existingItems - Lista actual de tiendas guardadas en la app
 * @param {Array} newItems - Nuevos ítems extraídos del archivo recién subido
 * @param {'COST'|'EFFECTIVENESS'|'BOTH'} metricType - Tipo de métrica importada
 * @returns {Array} - Lista fusionada con prioridad absoluta a los datos nuevos
 */
export function mergeExtractedMetrics(existingItems = [], newItems = [], metricType = 'BOTH') {
  if (!newItems || newItems.length === 0) return existingItems.map(enrichItemWithCatalog);
  if (!existingItems || existingItems.length === 0) return newItems.map(enrichItemWithCatalog);

  const merged = [...existingItems];

  const extractPhoneDigits = (str) => {
    const d = String(str || '').replace(/[^0-9]/g, '');
    return d.length >= 10 ? d.slice(-10) : '';
  };

  const isPureDigits = (s) => /^\+?[\d\s\-\.\(\)]+$/.test(String(s || '').trim());

  newItems.forEach(newItem => {
    // Buscar si ya existe la tienda en la lista actual por ID, Nombre o Teléfono
    const existingIndex = merged.findIndex(it => {
      if (it.id && newItem.id && it.id === newItem.id) return true;

      // 1. Normalizar nombres limpiando prefijos/sufijos telefónicos si existen
      const cleanPhone = (s) => String(s || '')
        .replace(/^\+?\d{7,15}\s*([·\-\|:]\s*)?/, '')
        .replace(/\s*\(\+?\d+\)\s*$/, '')
        .trim().toLowerCase();
      const n1 = cleanPhone(it.name);
      const n2 = cleanPhone(newItem.name);
      if (n1 && n2 && n1 === n2) return true;
      
      // 2. Cruce mediante catálogo maestro de 79 tiendas (por nombre o teléfono)
      const m1 = findInCatalog(it.name) || (it.phone ? findInCatalog(it.phone) : null);
      const m2 = findInCatalog(newItem.name) || (newItem.phone ? findInCatalog(newItem.phone) : null);
      if (m1 && m2 && m1.name === m2.name) return true;

      // 3. Cruce directo por número telefónico (ej: en CSV venía solo el teléfono y en texto viene 'PEPE 3' con teléfono)
      const p1 = extractPhoneDigits(it.phone) || extractPhoneDigits(it.name);
      const p2 = extractPhoneDigits(newItem.phone) || extractPhoneDigits(newItem.name);
      if (p1 && p2 && p1 === p2) return true;

      return false;
    });

    if (existingIndex !== -1) {
      const current = merged[existingIndex];

      // Si la tienda previa tenía solo el número de teléfono como nombre y el nuevo ítem trae un nombre real legible, adoptarlo
      const resolvedName = (isPureDigits(current.name) && newItem.name && !isPureDigits(newItem.name))
        ? newItem.name
        : current.name;
      const resolvedPhone = current.phone || newItem.phone || '';

      // Verificamos qué valores vienen explícitamente en el archivo subido
      const hasNewCost = typeof newItem.costPerMessage === 'number' && !isNaN(newItem.costPerMessage) && newItem.costPerMessage >= 0;
      const hasNewBudget = typeof newItem.currentBudget === 'number' && !isNaN(newItem.currentBudget) && newItem.currentBudget >= 0;
      const hasNewEff = typeof newItem.effectiveness === 'number' && !isNaN(newItem.effectiveness) && newItem.effectiveness >= 0;
      const hasNewMsgs = typeof newItem.currentMessages === 'number' && !isNaN(newItem.currentMessages) && newItem.currentMessages >= 0;
      const cantadas = typeof newItem.cantadas === 'number' ? newItem.cantadas : current.cantadas;

      // Metadatos de catálogo (producto, categoria, trafiker, coordinador)
      const category = newItem.category && newItem.category !== 'GENERAL' ? newItem.category : current.category;
      const product = newItem.product && newItem.product !== 'GENERAL' ? newItem.product : current.product;
      const trafiker = newItem.trafiker && newItem.trafiker !== 'Sin asignar' ? newItem.trafiker : current.trafiker;
      const coordinator = newItem.coordinator && newItem.coordinator !== 'Sin asignar' ? newItem.coordinator : current.coordinator;

      if (metricType === 'COST') {
        // PRIORIDAD AL ARCHIVO SUBIDO: actualiza Costo, Presupuesto y Mensajes
        const cost = hasNewCost ? newItem.costPerMessage : current.costPerMessage;
        const budget = hasNewBudget ? newItem.currentBudget : current.currentBudget;
        const messages = hasNewMsgs ? newItem.currentMessages : (cost > 0 && budget > 0 ? Math.round(budget / cost) : current.currentMessages);
        const effectiveness = hasNewEff ? newItem.effectiveness : (current.effectiveness || 0);

        merged[existingIndex] = {
          ...current,
          name: resolvedName,
          phone: resolvedPhone,
          currentBudget: budget,
          costPerMessage: cost,
          currentMessages: messages,
          currentEffectiveMessages: typeof cantadas === 'number' ? cantadas : Math.round(messages * (effectiveness / 100)),
          effectiveness,
          cantadas,
          category,
          product,
          trafiker,
          coordinator
        };
      } else if (metricType === 'EFFECTIVENESS') {
        // PRIORIDAD AL ARCHIVO SUBIDO: actualiza Efectividad
        const effectiveness = hasNewEff ? newItem.effectiveness : current.effectiveness;
        const cost = current.costPerMessage;
        const budget = current.currentBudget;
        const messages = hasNewMsgs ? newItem.currentMessages : (cost > 0 && budget > 0 ? Math.round(budget / cost) : current.currentMessages);

        merged[existingIndex] = {
          ...current,
          name: resolvedName,
          phone: resolvedPhone,
          effectiveness,
          currentMessages: messages,
          currentEffectiveMessages: typeof cantadas === 'number' ? cantadas : Math.round(messages * ((effectiveness || 0) / 100)),
          cantadas,
          category,
          product,
          trafiker,
          coordinator
        };
      } else {
        // BOTH: Los datos del archivo subido tienen prioridad total sobre los datos guardados
        const cost = hasNewCost ? newItem.costPerMessage : current.costPerMessage;
        const budget = hasNewBudget ? newItem.currentBudget : current.currentBudget;
        const effectiveness = hasNewEff ? newItem.effectiveness : current.effectiveness;
        const messages = hasNewMsgs ? newItem.currentMessages : (cost > 0 && budget > 0 ? Math.round(budget / cost) : current.currentMessages);

        merged[existingIndex] = {
          ...current,
          name: resolvedName,
          phone: resolvedPhone,
          currentBudget: budget,
          costPerMessage: cost,
          effectiveness,
          currentMessages: messages,
          currentEffectiveMessages: typeof cantadas === 'number' ? cantadas : Math.round(messages * ((effectiveness || 0) / 100)),
          cantadas,
          category,
          product,
          trafiker,
          coordinator
        };
      }
    } else {
      // Tienda nueva presente en el archivo subido que no existía antes
      merged.push({
        ...newItem,
        currentBudget: newItem.currentBudget !== undefined ? newItem.currentBudget : 0,
        costPerMessage: newItem.costPerMessage !== undefined ? newItem.costPerMessage : 0,
        effectiveness: newItem.effectiveness !== undefined ? newItem.effectiveness : 0,
        currentMessages: newItem.currentMessages !== undefined ? newItem.currentMessages : 0,
        currentEffectiveMessages: newItem.cantadas !== undefined ? newItem.cantadas : (newItem.currentEffectiveMessages !== undefined ? newItem.currentEffectiveMessages : 0),
        cantadas: newItem.cantadas,
        id: newItem.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      });
    }
  });

  return merged.map(enrichItemWithCatalog);
}
