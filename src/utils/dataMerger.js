import { findInCatalog, enrichItemWithCatalog } from '../data/storeCatalog.js';

/**
 * Fusiona de manera inteligente los datos extraídos de dos capturas distintas
 * (Captura de Costo por Resultado y Captura de Efectividad).
 * 
 * @param {Array} existingItems - Lista actual de tiendas en la app
 * @param {Array} newItems - Nuevos ítems extraídos del OCR
 * @param {'COST'|'EFFECTIVENESS'|'BOTH'} metricType - Tipo de captura cargada
 * @returns {Array} - Lista fusionada sin pérdida de información
 */
export function mergeExtractedMetrics(existingItems = [], newItems = [], metricType = 'BOTH') {
  if (!newItems || newItems.length === 0) return existingItems.map(enrichItemWithCatalog);
  if (!existingItems || existingItems.length === 0) return newItems.map(enrichItemWithCatalog);

  const merged = [...existingItems];

  newItems.forEach(newItem => {
    // Buscar si ya existe la tienda en la lista actual por ID o nombre
    const existingIndex = merged.findIndex(it => {
      if (it.id === newItem.id) return true;
      // Normalizar nombres
      const n1 = it.name.trim().toLowerCase();
      const n2 = newItem.name.trim().toLowerCase();
      if (n1 === n2) return true;
      
      // Cruce mediante catálogo maestro
      const m1 = findInCatalog(it.name);
      const m2 = findInCatalog(newItem.name);
      if (m1 && m2 && m1.name === m2.name) return true;

      return false;
    });

    if (existingIndex !== -1) {
      const current = merged[existingIndex];

      if (metricType === 'COST') {
        // Actualiza Costo, Presupuesto y Mensajes, CONSERVA Efectividad previa
        const cost = newItem.costPerMessage || current.costPerMessage;
        const budget = newItem.currentBudget || current.currentBudget;
        const messages = newItem.currentMessages || (cost > 0 ? Math.round(budget / cost) : current.currentMessages);

        merged[existingIndex] = {
          ...current,
          costPerMessage: cost,
          currentBudget: budget,
          currentMessages: messages,
          // Conservar categoría si la nueva no es genérica
          category: newItem.category && newItem.category !== 'GENERAL' ? newItem.category : current.category
        };
      } else if (metricType === 'EFFECTIVENESS') {
        // Actualiza Efectividad, CONSERVA Costo y Presupuesto previos
        merged[existingIndex] = {
          ...current,
          effectiveness: newItem.effectiveness !== undefined ? newItem.effectiveness : current.effectiveness,
          category: newItem.category && newItem.category !== 'GENERAL' ? newItem.category : current.category
        };
      } else {
        // BOTH: Actualiza todo lo detectado
        merged[existingIndex] = {
          ...current,
          ...newItem,
          // Mantener valores previos si los nuevos son 0 o por defecto
          costPerMessage: newItem.costPerMessage || current.costPerMessage,
          effectiveness: newItem.effectiveness || current.effectiveness,
          currentBudget: newItem.currentBudget || current.currentBudget
        };
      }
    } else {
      // Es una tienda nueva que no estaba en la primera captura
      merged.push({
        ...newItem,
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      });
    }
  });

  return merged.map(enrichItemWithCatalog);
}
