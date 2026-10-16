import { findInCatalog, enrichItemWithCatalog } from '../data/storeCatalog.js';

/**
 * Fusiona de manera inteligente los datos extraídos de un archivo subido (Excel, CSV o Captura)
 * PRIORIZANDO SIEMPRE los datos recién cargados sobre los datos que ya estaban guardados.
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

  newItems.forEach(newItem => {
    // Buscar si ya existe la tienda en la lista actual por ID o nombre
    const existingIndex = merged.findIndex(it => {
      if (it.id && newItem.id && it.id === newItem.id) return true;
      // Normalizar nombres para coincidencia directa
      const n1 = it.name.trim().toLowerCase();
      const n2 = newItem.name.trim().toLowerCase();
      if (n1 === n2) return true;
      
      // Cruce mediante catálogo maestro de 79 tiendas
      const m1 = findInCatalog(it.name);
      const m2 = findInCatalog(newItem.name);
      if (m1 && m2 && m1.name === m2.name) return true;

      return false;
    });

    if (existingIndex !== -1) {
      const current = merged[existingIndex];

      // Verificamos qué valores vienen explícitamente en el archivo subido
      const hasNewCost = newItem.costPerMessage !== undefined && newItem.costPerMessage !== null && newItem.costPerMessage > 0;
      const hasNewBudget = newItem.currentBudget !== undefined && newItem.currentBudget !== null && newItem.currentBudget > 0;
      const hasNewEff = newItem.effectiveness !== undefined && newItem.effectiveness !== null && !isNaN(newItem.effectiveness);
      const hasNewMsgs = newItem.currentMessages !== undefined && newItem.currentMessages !== null && newItem.currentMessages > 0;

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

        merged[existingIndex] = {
          ...current,
          ...newItem,
          currentBudget: budget,
          costPerMessage: cost,
          currentMessages: messages,
          // Conserva la efectividad previa guardada si el archivo no la trae
          effectiveness: current.effectiveness,
          category,
          product,
          trafiker,
          coordinator
        };
      } else if (metricType === 'EFFECTIVENESS') {
        // PRIORIDAD AL ARCHIVO SUBIDO: actualiza Efectividad
        merged[existingIndex] = {
          ...current,
          // La nueva efectividad sobreescribe 100% la anterior
          effectiveness: hasNewEff ? newItem.effectiveness : current.effectiveness,
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
          ...newItem,
          currentBudget: budget,
          costPerMessage: cost,
          effectiveness,
          currentMessages: messages,
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
        id: newItem.id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      });
    }
  });

  return merged.map(enrichItemWithCatalog);
}
