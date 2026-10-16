/**
 * Motor de Optimización y Redistribución de Presupuesto Publicitario
 * 
 * Basado en:
 * 1. Maximización de mensajes efectivos (Efectividad * Mensajes)
 * 2. Penalización estricta para líneas con bajo costo pero baja efectividad
 * 3. Proyección flexible de nuevo presupuesto (aumento, reducción o valor fijo)
 * 4. Guardrails configurables (variación máxima % y presupuesto mínimo)
 */

/**
 * Calcula el análisis y la redistribución de presupuesto.
 * 
 * @param {Array} items - Lista de tiendas/líneas:
 *   [{ id, name, currentBudget, costPerMessage, effectiveness, currentMessages }]
 * @param {Object} options - Opciones de configuración:
 *   - targetBudget: Presupuesto total objetivo (número)
 *   - minEffectivenessThreshold: Umbral de efectividad (%) bajo el cual NO se incrementa presupuesto (default: 8)
 *   - maxVariationPct: Límite de cambio porcentual por línea (+/- %) (default: 50, o null si libre)
 *   - minLineBudget: Presupuesto mínimo por línea (default: 10)
 *   - alpha: Ponderación de efectividad en IRC (default: 1.2)
 *   - beta: Ponderación de costo en IRC (default: 1.0)
 *   - allowDeactivation: Si se permite reducir a 0 tiendas pésimas (default: false)
 */
export function optimizeBudget(items, options = {}) {
  if (!items || items.length === 0) {
    return {
      optimizedItems: [],
      summary: getEmptySummary()
    };
  }

  const {
    targetBudget = null,
    targetBudgetPctDelta = 0,
    minEffectivenessThreshold = 8.0, // %
    maxVariationPct = 50, // +/- 50%
    minLineBudget = 5,
    roundingStep = 5000, // Redondeo por defecto a múltiplos de $5,000 COP (terminados en 0 o 5)
    alpha = 1.3, // Sensibilidad a la efectividad (mayor = premia más calidad)
    beta = 1.0,  // Sensibilidad al costo por mensaje
  } = options;

  // 1. Limpieza y preparación de datos base
  const cleanItems = items.map((item, idx) => {
    const currentBudget = Math.max(0, Number(item.currentBudget) || 0);
    const costPerMessage = Math.max(0.01, Number(item.costPerMessage) || 1.0);
    const effectiveness = Math.max(0, Number(item.effectiveness) || 0); // en % (ej. 15%)
    const category = item.category || 'General';
    
    // Si no se proporcionaron mensajes actuales, se derivan de presupuesto / costo
    const currentMessages = item.currentMessages && item.currentMessages > 0
      ? Number(item.currentMessages)
      : (costPerMessage > 0 ? currentBudget / costPerMessage : 0);

    const currentEffectiveMessages = currentMessages * (effectiveness / 100);

    return {
      ...item,
      id: item.id || `line-${idx + 1}`,
      name: item.name || `Línea ${idx + 1}`,
      category,
      currentBudget,
      costPerMessage,
      effectiveness,
      currentMessages: Math.round(currentMessages),
      currentEffectiveMessages: Number(currentEffectiveMessages.toFixed(1))
    };
  });

  const totalCurrentBudget = cleanItems.reduce((acc, it) => acc + it.currentBudget, 0);

  // Determinar el presupuesto total final a repartir
  let finalTargetBudget = totalCurrentBudget;
  if (targetBudget !== null && !isNaN(targetBudget) && targetBudget > 0) {
    finalTargetBudget = Number(targetBudget);
  } else if (targetBudgetPctDelta !== 0) {
    finalTargetBudget = totalCurrentBudget * (1 + targetBudgetPctDelta / 100);
  }

  const effectiveRoundingStep = (roundingStep > 0 && finalTargetBudget >= roundingStep) ? roundingStep : 0;
  if (effectiveRoundingStep > 0) {
    finalTargetBudget = Math.round(finalTargetBudget / effectiveRoundingStep) * effectiveRoundingStep;
  }

  // 2. Cálculo del Índice de Rendimiento Compuesto (IRC) y Gatekeeper
  const evaluatedItems = cleanItems.map(item => {
    const effRate = item.effectiveness / 100;
    const baseIRC = (Math.pow(effRate, alpha) / Math.pow(item.costPerMessage, beta)) * 100;
    const isBelowThreshold = item.effectiveness < minEffectivenessThreshold;
    const penaltyMultiplier = isBelowThreshold ? 0.35 : 1.0;
    const adjustedIRC = Math.max(0.0001, baseIRC * penaltyMultiplier);

    return {
      ...item,
      baseIRC,
      adjustedIRC,
      isBelowThreshold
    };
  });

  // 3. Algoritmo de Asignación con Guardrails y Restricciones
  // Verificamos si hay partición explícita de presupuesto por categoría
  const { categoryBudgets = null } = options;
  let optimized = [];

  const categories = Array.from(new Set(evaluatedItems.map(it => it.category)));

  if (categoryBudgets && Object.keys(categoryBudgets).length > 0) {
    // Calculamos la suma total configurada en categoryBudgets para las categorías evaluadas
    let totalConfiguredCategoryBudget = 0;
    categories.forEach(cat => {
      const val = categoryBudgets[cat];
      if (val !== undefined && val !== null && !isNaN(val) && Number(val) > 0) {
        totalConfiguredCategoryBudget += Number(val);
      }
    });

    // Si la suma de categoryBudgets difiere de finalTargetBudget, escalamos proporcionalmente
    // para garantizar que la suma total asignada coincida exactamente con lo solicitado por el usuario
    const needsScaling = totalConfiguredCategoryBudget > 0 && Math.abs(totalConfiguredCategoryBudget - finalTargetBudget) > 1;
    const catScaleFactor = needsScaling ? (finalTargetBudget / totalConfiguredCategoryBudget) : 1;

    // Optimización particionada por categoría
    categories.forEach((cat) => {
      const catItems = evaluatedItems.filter(it => it.category === cat);
      const catCurrentBudget = catItems.reduce((acc, it) => acc + it.currentBudget, 0);
      
      // Presupuesto objetivo para esta categoría
      let catTargetBudget;
      if (categoryBudgets[cat] !== undefined && categoryBudgets[cat] !== null && !isNaN(categoryBudgets[cat])) {
        catTargetBudget = Number(categoryBudgets[cat]) * catScaleFactor;
      } else {
        const catRatio = totalCurrentBudget > 0 ? (catCurrentBudget / totalCurrentBudget) : (1 / categories.length);
        catTargetBudget = finalTargetBudget * catRatio;
      }

      if (effectiveRoundingStep > 0) {
        catTargetBudget = Math.round(catTargetBudget / effectiveRoundingStep) * effectiveRoundingStep;
      }

      const catOptimized = allocateBudgetWithConstraints({
        items: catItems,
        totalTargetBudget: Number(catTargetBudget),
        totalCurrentBudget: catCurrentBudget,
        maxVariationPct,
        minLineBudget,
        roundingStep: effectiveRoundingStep
      });

      optimized.push(...catOptimized);
    });

    // Cuadre final de residuos para que la suma total sea idéntica a finalTargetBudget
    const currentTotalAllocated = optimized.reduce((acc, it) => acc + it.newBudget, 0);
    const residualDiff = finalTargetBudget - currentTotalAllocated;

    if (effectiveRoundingStep > 0 && Math.abs(residualDiff) >= effectiveRoundingStep) {
      let steps = Math.round(residualDiff / effectiveRoundingStep);
      const sorted = [...optimized].sort((a, b) => b.adjustedIRC - a.adjustedIRC);
      let s = 0;
      while (steps > 0 && s < sorted.length * 4) {
        const it = sorted[s % sorted.length];
        if (!it.isBelowThreshold || sorted.every(x => x.isBelowThreshold)) {
          it.newBudget += effectiveRoundingStep;
          steps--;
        }
        s++;
      }
      while (steps < 0 && s < sorted.length * 4) {
        const it = sorted[sorted.length - 1 - (s % sorted.length)];
        if (it.newBudget >= effectiveRoundingStep) {
          it.newBudget -= effectiveRoundingStep;
          steps++;
        }
        s++;
      }
    } else if (effectiveRoundingStep === 0 && Math.abs(residualDiff) > 0.05 && optimized.length > 0) {
      const bestIndex = optimized.findIndex(it => !it.isBelowThreshold) !== -1
        ? optimized.findIndex(it => !it.isBelowThreshold)
        : 0;
      optimized[bestIndex].newBudget = Number((optimized[bestIndex].newBudget + residualDiff).toFixed(2));
    }
  } else {
    // Optimización global
    optimized = allocateBudgetWithConstraints({
      items: evaluatedItems,
      totalTargetBudget: finalTargetBudget,
      totalCurrentBudget,
      maxVariationPct,
      minLineBudget,
      roundingStep: effectiveRoundingStep
    });
  }

  // 4. Calcular métricas finales proyectadas
  const optimizedItems = optimized.map(item => {
    const newBudget = item.newBudget;
    const budgetDelta = newBudget - item.currentBudget;
    const budgetDeltaPct = item.currentBudget > 0 
      ? ((budgetDelta / item.currentBudget) * 100) 
      : 0;

    const projectedMessages = Math.round(newBudget / item.costPerMessage);
    const projectedEffectiveMessages = Number((projectedMessages * (item.effectiveness / 100)).toFixed(1));

    const messagesDelta = projectedMessages - item.currentMessages;
    const effectiveMessagesDelta = projectedEffectiveMessages - item.currentEffectiveMessages;

    // Estado / Recomendación de acción
    let status = 'MAINTAIN';
    let statusLabel = 'Mantener';
    let statusBadgeColor = 'bg-slate-700 text-slate-200 border-slate-600';

    if (item.isBelowThreshold && budgetDelta <= 0) {
      status = 'BLOCKED_LOW_EFF';
      statusLabel = 'Protegido / No Inyectar (Baja Efectividad)';
      statusBadgeColor = 'bg-amber-950/60 text-amber-300 border-amber-800/80';
    } else if (budgetDelta > (item.currentBudget * 0.05)) {
      status = 'INCREASE';
      statusLabel = 'Inyectar Presupuesto';
      statusBadgeColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
    } else if (budgetDelta < -(item.currentBudget * 0.05)) {
      status = 'DECREASE';
      statusLabel = 'Reducir Presupuesto';
      statusBadgeColor = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
    }

    return {
      ...item,
      newBudget: Number(newBudget.toFixed(2)),
      budgetDelta: Number(budgetDelta.toFixed(2)),
      budgetDeltaPct: Number(budgetDeltaPct.toFixed(1)),
      projectedMessages,
      projectedEffectiveMessages,
      messagesDelta,
      effectiveMessagesDelta,
      status,
      statusLabel,
      statusBadgeColor
    };
  });

  // 5. Métricas Globales y Resumen Ejecutivo
  const summary = calculateSummary(cleanItems, optimizedItems, totalCurrentBudget, finalTargetBudget);

  // 6. Resumen por Categorías
  const categorySummaries = categories.map(cat => {
    const currentCatItems = cleanItems.filter(it => it.category === cat);
    const optCatItems = optimizedItems.filter(it => it.category === cat);
    const catCurrentBudget = currentCatItems.reduce((acc, it) => acc + it.currentBudget, 0);
    const catNewBudget = optCatItems.reduce((acc, it) => acc + it.newBudget, 0);
    const catCurrentMsgs = currentCatItems.reduce((acc, it) => acc + it.currentMessages, 0);
    const catNewMsgs = optCatItems.reduce((acc, it) => acc + it.projectedMessages, 0);
    const catCurrentEff = currentCatItems.reduce((acc, it) => acc + it.currentEffectiveMessages, 0);
    const catNewEff = optCatItems.reduce((acc, it) => acc + it.projectedEffectiveMessages, 0);

    const deltaBudget = catNewBudget - catCurrentBudget;
    const deltaBudgetPct = catCurrentBudget > 0 ? (deltaBudget / catCurrentBudget) * 100 : 0;
    const deltaMsgs = catNewMsgs - catCurrentMsgs;
    const deltaEff = catNewEff - catCurrentEff;
    const deltaEffPct = catCurrentEff > 0 ? (deltaEff / catCurrentEff) * 100 : 0;

    return {
      category: cat,
      itemCount: optCatItems.length,
      currentBudget: Number(catCurrentBudget.toFixed(2)),
      newBudget: Number(catNewBudget.toFixed(2)),
      deltaBudget: Number(deltaBudget.toFixed(2)),
      deltaBudgetPct: Number(deltaBudgetPct.toFixed(1)),
      currentMessages: catCurrentMsgs,
      projectedMessages: catNewMsgs,
      deltaMessages: deltaMsgs,
      currentEffectiveMessages: Number(catCurrentEff.toFixed(1)),
      projectedEffectiveMessages: Number(catNewEff.toFixed(1)),
      deltaEffective: Number(deltaEff.toFixed(1)),
      deltaEffectivePct: Number(deltaEffPct.toFixed(1)),
      weightedEff: catNewMsgs > 0 ? Number(((catNewEff / catNewMsgs) * 100).toFixed(1)) : 0
    };
  });

  return {
    optimizedItems,
    summary,
    categorySummaries
  };
}

/**
 * Distribución proporcional con restricciones (Bounded Iterative Allocation)
 */
function allocateBudgetWithConstraints({
  items,
  totalTargetBudget,
  totalCurrentBudget,
  maxVariationPct,
  minLineBudget = 5000,
  roundingStep = 5000
}) {
  if (totalTargetBudget <= 0) {
    return items.map(it => ({ ...it, newBudget: 0 }));
  }

  // Si se pide redondeo, normalizar totalTargetBudget como múltiplo
  const targetBudgetNormalized = roundingStep > 0
    ? Math.round(totalTargetBudget / roundingStep) * roundingStep
    : totalTargetBudget;

  const n = items.length;
  // Factor de escala global si el presupuesto total cambia
  const globalScale = totalCurrentBudget > 0 ? (targetBudgetNormalized / totalCurrentBudget) : 1;

  // Definir cotas [minBound, maxBound] para cada tienda
  const bounds = items.map(item => {
    let minBound = Math.min(item.currentBudget, minLineBudget);
    let maxBound = item.currentBudget;

    if (maxVariationPct && maxVariationPct > 0) {
      const varFrac = maxVariationPct / 100;
      minBound = Math.max(minLineBudget, item.currentBudget * (1 - varFrac));
      maxBound = item.currentBudget * (1 + varFrac * Math.max(1, globalScale));
    } else {
      minBound = minLineBudget;
      maxBound = targetBudgetNormalized;
    }

    // Regla crucial: Si baja efectividad, no puede superar su presupuesto actual
    // (a menos que el presupuesto global se reduzca y deba bajar)
    if (item.isBelowThreshold) {
      maxBound = Math.min(maxBound, item.currentBudget);
    }

    // Asegurar coherencia
    if (minBound > maxBound) minBound = maxBound;

    return { minBound, maxBound };
  });

  // Pesos basados en IRC y presupuesto actual
  const weights = items.map(item => {
    return Math.max(0.001, item.adjustedIRC * Math.sqrt(Math.max(1, item.currentBudget)));
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  // Asignación inicial proporcional a pesos
  let currentAllocations = items.map((item, i) => {
    const rawAlloc = (weights[i] / totalWeight) * targetBudgetNormalized;
    return Math.min(bounds[i].maxBound, Math.max(bounds[i].minBound, rawAlloc));
  });

  // Ajuste iterativo para cuadrar exactamente con targetBudgetNormalized respetando cotas
  for (let iter = 0; iter < 20; iter++) {
    const currentSum = currentAllocations.reduce((acc, val) => acc + val, 0);
    const diff = targetBudgetNormalized - currentSum;
    
    if (Math.abs(diff) < 0.05) break;

    let adjustableWeightSum = 0;
    const canAdjust = items.map((_, i) => {
      if (diff > 0 && currentAllocations[i] < bounds[i].maxBound) {
        adjustableWeightSum += weights[i];
        return true;
      }
      if (diff < 0 && currentAllocations[i] > bounds[i].minBound) {
        adjustableWeightSum += weights[i];
        return true;
      }
      return false;
    });

    if (adjustableWeightSum === 0) break;

    for (let i = 0; i < n; i++) {
      if (canAdjust[i]) {
        const delta = (weights[i] / adjustableWeightSum) * diff;
        currentAllocations[i] = Math.min(
          bounds[i].maxBound,
          Math.max(bounds[i].minBound, currentAllocations[i] + delta)
        );
      }
    }
  }

  // APLICACIÓN DE REDONDEO COMERCIAL LIMPIO (Múltiplos de $5,000 terminados en 0 o 5)
  if (roundingStep > 0) {
    // 1. Redondear cada asignación individualmente
    currentAllocations = currentAllocations.map(val => Math.max(0, Math.round(val / roundingStep) * roundingStep));

    // 2. Cuadrar la diferencia exacta por residuos en pasos de roundingStep
    let roundedSum = currentAllocations.reduce((acc, val) => acc + val, 0);
    let diff = targetBudgetNormalized - roundedSum;
    let stepCount = Math.round(diff / roundingStep);

    // Índices ordenados por rendimiento IRC descendente
    const sortedIndices = items.map((it, idx) => ({ idx, irc: it.adjustedIRC, isBelow: it.isBelowThreshold }))
      .sort((a, b) => b.irc - a.irc);

    if (stepCount > 0) {
      // Sumar +roundingStep a las mejores tiendas no bloqueadas
      let loop = 0;
      while (stepCount > 0 && loop < sortedIndices.length * 5) {
        const targetIdx = sortedIndices[loop % sortedIndices.length].idx;
        if (!items[targetIdx].isBelowThreshold || sortedIndices.every(x => items[x.idx].isBelowThreshold)) {
          currentAllocations[targetIdx] += roundingStep;
          stepCount--;
        }
        loop++;
      }
    } else if (stepCount < 0) {
      // Restar roundingStep empezando por las de menor rendimiento
      const reversedIndices = [...sortedIndices].reverse();
      let loop = 0;
      while (stepCount < 0 && loop < reversedIndices.length * 5) {
        const targetIdx = reversedIndices[loop % reversedIndices.length].idx;
        if (currentAllocations[targetIdx] >= roundingStep) {
          currentAllocations[targetIdx] -= roundingStep;
          stepCount++;
        }
        loop++;
      }
    }
  } else {
    // Cuadre final de centavos en la tienda de mejor rendimiento que no esté bloqueada
    const finalSum = currentAllocations.reduce((acc, val) => acc + val, 0);
    const finalDiff = targetBudgetNormalized - finalSum;
    if (Math.abs(finalDiff) > 0.01) {
      const bestIndex = items.findIndex(it => !it.isBelowThreshold) !== -1 
        ? items.findIndex(it => !it.isBelowThreshold) 
        : 0;
      currentAllocations[bestIndex] += finalDiff;
    }
  }

  return items.map((item, i) => ({
    ...item,
    newBudget: currentAllocations[i]
  }));
}

/**
 * Planificador de Re-escalada en Dos Fases (Fin de Semana ➔ Lunes)
 * 
 * Proyecta simultáneamente:
 * Fase 1: Reducción temporal de fin de semana (ej. -30%)
 * Fase 2: Re-escalada óptima para el lunes (ej. retorno a $1,250,000 base)
 * 
 * Calcula el "Salto de Reactivación" por tienda:
 * deltaReactivacion = mondayBudget - weekendBudget
 */
export function planTwoPhaseRedistribution(items, options = {}) {
  const {
    baseBudget = null,
    reductionPct = 30, // % de reducción para fin de semana
    reboundTargetBudget = null, // Presupuesto objetivo para el lunes
    roundingStep = 5000,
    minEffectivenessThreshold = 8.0,
    maxVariationPct = 50,
    alpha = 1.3,
    categoryBudgets = null
  } = options;

  const totalCurrentBudget = items.reduce((acc, it) => acc + (Number(it.currentBudget) || 0), 0);
  const activeBase = (baseBudget !== null && !isNaN(baseBudget) && baseBudget > 0)
    ? Number(baseBudget)
    : totalCurrentBudget;

  const effectiveRoundingStep = (roundingStep > 0 && activeBase >= roundingStep) ? roundingStep : 0;

  // Fase 1: Presupuesto objetivo fin de semana (bajada de reductionPct%)
  const rawWeekendTarget = activeBase * (1 - Math.abs(reductionPct) / 100);
  const weekendTargetBudget = effectiveRoundingStep > 0
    ? Math.round(rawWeekendTarget / effectiveRoundingStep) * effectiveRoundingStep
    : rawWeekendTarget;

  // Fase 2: Presupuesto objetivo lunes (vuelta a reboundTargetBudget o activeBase)
  const rawMondayTarget = (reboundTargetBudget !== null && !isNaN(reboundTargetBudget) && reboundTargetBudget > 0)
    ? Number(reboundTargetBudget)
    : activeBase;
  const mondayTargetBudget = effectiveRoundingStep > 0
    ? Math.round(rawMondayTarget / effectiveRoundingStep) * effectiveRoundingStep
    : rawMondayTarget;

  // Optimización Fase 1: Fin de semana
  const weekendResult = optimizeBudget(items, {
    targetBudget: weekendTargetBudget,
    roundingStep: effectiveRoundingStep,
    minEffectivenessThreshold,
    maxVariationPct,
    alpha,
    categoryBudgets
  });

  // Optimización Fase 2: Lunes
  const mondayResult = optimizeBudget(items, {
    targetBudget: mondayTargetBudget,
    roundingStep: effectiveRoundingStep,
    minEffectivenessThreshold,
    maxVariationPct,
    alpha,
    categoryBudgets
  });

  // Mapas por tienda para combinar fases
  const weekendMap = new Map(weekendResult.optimizedItems.map(it => [it.id, it]));
  const mondayMap = new Map(mondayResult.optimizedItems.map(it => [it.id, it]));

  const combinedItems = items.map(item => {
    const w = weekendMap.get(item.id) || item;
    const m = mondayMap.get(item.id) || item;

    const weekendBudget = w.newBudget;
    const mondayBudget = m.newBudget;

    // Salto de reactivación requerido para pasar de fin de semana a lunes
    const reactivationDelta = mondayBudget - weekendBudget;
    const reactivationDeltaPct = weekendBudget > 0
      ? Number(((reactivationDelta / weekendBudget) * 100).toFixed(1))
      : 0;

    let reactivationAction = 'Mantener';
    let reactivationColor = 'bg-slate-700 text-slate-200 border-slate-600';

    if (reactivationDelta > 0) {
      reactivationAction = `Subir +$${reactivationDelta.toLocaleString()}`;
      reactivationColor = 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';
    } else if (reactivationDelta < 0) {
      reactivationAction = `Ajustar -$${Math.abs(reactivationDelta).toLocaleString()}`;
      reactivationColor = 'bg-rose-950/60 text-rose-300 border-rose-800/80';
    }

    return {
      ...item,
      currentBudget: item.currentBudget,
      costPerMessage: item.costPerMessage,
      effectiveness: item.effectiveness,
      category: item.category,
      product: item.product,
      trafiker: item.trafiker,
      coordinator: item.coordinator,
      // Fase 1: Finde
      weekendBudget,
      weekendDelta: w.budgetDelta,
      weekendDeltaPct: w.budgetDeltaPct,
      weekendMessages: w.projectedMessages,
      weekendEffective: w.projectedEffectiveMessages,
      weekendStatus: w.statusLabel,
      // Fase 2: Lunes
      mondayBudget,
      mondayDelta: m.budgetDelta,
      mondayDeltaPct: m.budgetDeltaPct,
      mondayMessages: m.projectedMessages,
      mondayEffective: m.projectedEffectiveMessages,
      mondayStatus: m.statusLabel,
      // Salto de Reactivación (Finde ➔ Lunes)
      reactivationDelta,
      reactivationDeltaPct,
      reactivationAction,
      reactivationColor,
      isBelowThreshold: w.isBelowThreshold
    };
  });

  const totalWeekendAllocated = combinedItems.reduce((acc, it) => acc + it.weekendBudget, 0);
  const totalMondayAllocated = combinedItems.reduce((acc, it) => acc + it.mondayBudget, 0);
  const totalReactivationDelta = totalMondayAllocated - totalWeekendAllocated;

  return {
    combinedItems,
    weekendResult,
    mondayResult,
    reboundSummary: {
      activeBase,
      reductionPct,
      weekendTargetBudget: totalWeekendAllocated,
      mondayTargetBudget: totalMondayAllocated,
      totalReactivationDelta,
      weekendSummary: weekendResult.summary,
      mondaySummary: mondayResult.summary
    }
  };
}

/**
 * Calcula resumen ejecutivo consolidado
 */
function calculateSummary(currentItems, optimizedItems, totalCurrentBudget, finalTargetBudget) {
  const currentTotalMessages = currentItems.reduce((acc, it) => acc + it.currentMessages, 0);
  const newTotalMessages = optimizedItems.reduce((acc, it) => acc + it.projectedMessages, 0);

  const currentTotalEffective = currentItems.reduce((acc, it) => acc + it.currentEffectiveMessages, 0);
  const newTotalEffective = optimizedItems.reduce((acc, it) => acc + it.projectedEffectiveMessages, 0);

  const currentBlendedCPM = currentTotalMessages > 0 ? (totalCurrentBudget / currentTotalMessages) : 0;
  const newBlendedCPM = newTotalMessages > 0 ? (finalTargetBudget / newTotalMessages) : 0;

  // Efectividad ponderada por mensajes
  const currentWeightedEff = currentTotalMessages > 0
    ? (currentTotalEffective / currentTotalMessages) * 100
    : 0;

  const newWeightedEff = newTotalMessages > 0
    ? (newTotalEffective / newTotalMessages) * 100
    : 0;

  const budgetDelta = finalTargetBudget - totalCurrentBudget;
  const budgetDeltaPct = totalCurrentBudget > 0 ? (budgetDelta / totalCurrentBudget) * 100 : 0;

  const messagesDelta = newTotalMessages - currentTotalMessages;
  const messagesDeltaPct = currentTotalMessages > 0 ? (messagesDelta / currentTotalMessages) * 100 : 0;

  const effectiveDelta = newTotalEffective - currentTotalEffective;
  const effectiveDeltaPct = currentTotalEffective > 0 ? (effectiveDelta / currentTotalEffective) * 100 : 0;

  return {
    totalCurrentBudget: Number(totalCurrentBudget.toFixed(2)),
    finalTargetBudget: Number(finalTargetBudget.toFixed(2)),
    budgetDelta: Number(budgetDelta.toFixed(2)),
    budgetDeltaPct: Number(budgetDeltaPct.toFixed(1)),

    currentTotalMessages,
    newTotalMessages,
    messagesDelta,
    messagesDeltaPct: Number(messagesDeltaPct.toFixed(1)),

    currentTotalEffective: Number(currentTotalEffective.toFixed(1)),
    newTotalEffective: Number(newTotalEffective.toFixed(1)),
    effectiveDelta: Number(effectiveDelta.toFixed(1)),
    effectiveDeltaPct: Number(effectiveDeltaPct.toFixed(1)),

    currentBlendedCPM: Number(currentBlendedCPM.toFixed(2)),
    newBlendedCPM: Number(newBlendedCPM.toFixed(2)),
    cpmDelta: Number((newBlendedCPM - currentBlendedCPM).toFixed(2)),

    currentWeightedEff: Number(currentWeightedEff.toFixed(2)),
    newWeightedEff: Number(newWeightedEff.toFixed(2)),
    effDelta: Number((newWeightedEff - currentWeightedEff).toFixed(2))
  };
}

function getEmptySummary() {
  return {
    totalCurrentBudget: 0,
    finalTargetBudget: 0,
    budgetDelta: 0,
    budgetDeltaPct: 0,
    currentTotalMessages: 0,
    newTotalMessages: 0,
    messagesDelta: 0,
    messagesDeltaPct: 0,
    currentTotalEffective: 0,
    newTotalEffective: 0,
    effectiveDelta: 0,
    effectiveDeltaPct: 0,
    currentBlendedCPM: 0,
    newBlendedCPM: 0,
    cpmDelta: 0,
    currentWeightedEff: 0,
    newWeightedEff: 0,
    effDelta: 0
  };
}
