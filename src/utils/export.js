import * as XLSX from 'xlsx';

/**
 * Exporta el análisis de redistribución a un archivo Excel (.xlsx)
 */
export function exportToExcel(optimizedItems, summary, filename = 'redistribucion_presupuesto.xlsx') {
  // Hoja 1: Detalle por Tienda / Línea
  const detailRows = optimizedItems.map(item => ({
    'Tienda / Línea': item.name,
    'Categoría': item.category || 'General',
    'Producto': item.product || item.category || 'General',
    'Trafiker': item.trafiker || 'Sin asignar',
    'Coordinador': item.coordinator || 'Sin asignar',
    'Presupuesto Actual ($)': item.currentBudget,
    'Nuevo Presupuesto ($)': item.newBudget,
    'Variación Presupuesto ($)': item.budgetDelta,
    'Variación Presupuesto (%)': `${item.budgetDeltaPct > 0 ? '+' : ''}${item.budgetDeltaPct}%`,
    'Costo x Mensaje ($)': item.costPerMessage,
    'Efectividad (%)': `${item.effectiveness}%`,
    'Mensajes Actuales': item.currentMessages,
    'Mensajes Proyectados': item.projectedMessages,
    'Variación Mensajes': `${item.messagesDelta > 0 ? '+' : ''}${item.messagesDelta}`,
    'Mensajes Efectivos Act.': item.currentEffectiveMessages,
    'Mensajes Efectivos Proy.': item.projectedEffectiveMessages,
    'Acción Recomendada': item.statusLabel
  }));

  // Hoja 2: Resumen Ejecutivo
  const summaryRows = [
    { 'Métrica Global': 'Presupuesto Total Anterior ($)', 'Valor': summary.totalCurrentBudget },
    { 'Métrica Global': 'Nuevo Presupuesto Objetivo ($)', 'Valor': summary.finalTargetBudget },
    { 'Métrica Global': 'Variación Presupuestaria Total ($)', 'Valor': summary.budgetDelta },
    { 'Métrica Global': 'Variación Presupuestaria (%)', 'Valor': `${summary.budgetDeltaPct}%` },
    { 'Métrica Global': 'Mensajes Totales Anteriores', 'Valor': summary.currentTotalMessages },
    { 'Métrica Global': 'Mensajes Totales Proyectados', 'Valor': summary.newTotalMessages },
    { 'Métrica Global': 'Crecimiento de Mensajes', 'Valor': `${summary.messagesDelta > 0 ? '+' : ''}${summary.messagesDelta} (${summary.messagesDeltaPct}%)` },
    { 'Métrica Global': 'Mensajes Efectivos Anteriores', 'Valor': summary.currentTotalEffective },
    { 'Métrica Global': 'Mensajes Efectivos Proyectados', 'Valor': summary.newTotalEffective },
    { 'Métrica Global': 'Crecimiento en Mensajes Efectivos', 'Valor': `${summary.effectiveDelta > 0 ? '+' : ''}${summary.effectiveDelta} (${summary.effectiveDeltaPct}%)` },
    { 'Métrica Global': 'Costo Promedio Ponderado Anterior ($)', 'Valor': summary.currentBlendedCPM },
    { 'Métrica Global': 'Costo Promedio Ponderado Nuevo ($)', 'Valor': summary.newBlendedCPM },
    { 'Métrica Global': 'Efectividad Ponderada Anterior (%)', 'Valor': `${summary.currentWeightedEff}%` },
    { 'Métrica Global': 'Efectividad Ponderada Proyectada (%)', 'Valor': `${summary.newWeightedEff}%` }
  ];

  const wb = XLSX.utils.book_new();
  const wsDetail = XLSX.utils.json_to_sheet(detailRows);
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);

  // Autoajuste de ancho de columnas básico
  wsDetail['!cols'] = [
    { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 22 },
    { wch: 18 }, { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 18 },
    { wch: 22 }, { wch: 22 }, { wch: 32 }
  ];
  wsSummary['!cols'] = [{ wch: 35 }, { wch: 20 }];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Redistribución por Línea');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo');

  XLSX.writeFile(wb, filename);
}

/**
 * Copia el nuevo presupuesto formateado al portapapeles
 */
export async function copyBudgetToClipboard(optimizedItems) {
  const text = optimizedItems
    .map(it => `${it.name}\t${it.product || it.category || ''}\t${it.trafiker || ''}\t${it.coordinator || ''}\t${it.newBudget}\t${it.statusLabel}`)
    .join('\n');
  
  const header = "Línea / Tienda\tProducto\tTrafiker\tCoordinador\tNuevo Presupuesto\tRecomendación\n";
  await navigator.clipboard.writeText(header + text);
}

/**
 * Exporta el plan completo de Re-escalada en 2 fases (Finde ➔ Lunes) a un Excel multi-hoja
 */
export function exportReboundToExcel(combinedItems, reboundSummary, filename = 'plan_reescalada_finde_lunes.xlsx') {
  // Hoja 1: Comparativa y Salto de Reactivación
  const rowsComparative = combinedItems.map(item => ({
    'Tienda / Línea': item.name,
    'Producto': item.product || item.category || 'General',
    'Trafiker': item.trafiker || 'Sin asignar',
    'Coordinador': item.coordinator || 'Sin asignar',
    'Presupuesto Actual ($)': item.currentBudget,
    'Presupuesto Finde ($)': item.weekendBudget,
    'Presupuesto Lunes ($)': item.mondayBudget,
    'Salto Reactivación ($)': item.reactivationDelta,
    'Salto Reactivación (%)': `${item.reactivationDeltaPct > 0 ? '+' : ''}${item.reactivationDeltaPct}%`,
    'Acción Lunes': item.reactivationAction,
    'Costo x Mensaje ($)': item.costPerMessage,
    'Efectividad (%)': `${item.effectiveness}%`
  }));

  // Hoja 2: Plan Fin de Semana Detallado
  const rowsWeekend = combinedItems.map(item => ({
    'Tienda / Línea': item.name,
    'Producto': item.product || item.category || 'General',
    'Trafiker': item.trafiker || 'Sin asignar',
    'Presupuesto Actual ($)': item.currentBudget,
    'Presupuesto Finde ($)': item.weekendBudget,
    'Variación Finde ($)': item.weekendDelta,
    'Variación Finde (%)': `${item.weekendDeltaPct > 0 ? '+' : ''}${item.weekendDeltaPct}%`,
    'Msg Proyectados Finde': item.weekendMessages,
    'Msg Efectivos Finde': item.weekendEffective,
    'Estado Finde': item.weekendStatus
  }));

  // Hoja 3: Plan Lunes Detallado
  const rowsMonday = combinedItems.map(item => ({
    'Tienda / Línea': item.name,
    'Producto': item.product || item.category || 'General',
    'Trafiker': item.trafiker || 'Sin asignar',
    'Presupuesto Finde ($)': item.weekendBudget,
    'Nuevo Presupuesto Lunes ($)': item.mondayBudget,
    'Salto a Inyectar el Lunes ($)': item.reactivationDelta,
    'Msg Proyectados Lunes': item.mondayMessages,
    'Msg Efectivos Lunes': item.mondayEffective,
    'Estado Lunes': item.mondayStatus
  }));

  // Hoja 4: Resumen Ejecutivo Re-escalada
  const summaryRows = [
    { 'Métrica': 'Presupuesto Base Activo ($)', 'Valor': reboundSummary.activeBase },
    { 'Métrica': 'Porcentaje de Bajada Fin de Semana', 'Valor': `-${Math.abs(reboundSummary.reductionPct)}%` },
    { 'Métrica': 'Presupuesto Total Fin de Semana ($)', 'Valor': reboundSummary.weekendTargetBudget },
    { 'Métrica': 'Presupuesto Total Retorno Lunes ($)', 'Valor': reboundSummary.mondayTargetBudget },
    { 'Métrica': 'Inyección / Salto Total de Reactivación ($)', 'Valor': `+$${reboundSummary.totalReactivationDelta.toLocaleString()}` },
    { 'Métrica': 'Efectividad Ponderada Proyectada Lunes (%)', 'Valor': `${reboundSummary.mondaySummary.newWeightedEff}%` },
    { 'Métrica': 'Mensajes Efectivos Proyectados Lunes', 'Valor': reboundSummary.mondaySummary.newTotalEffective }
  ];

  const wb = XLSX.utils.book_new();
  const wsComp = XLSX.utils.json_to_sheet(rowsComparative);
  const wsWk = XLSX.utils.json_to_sheet(rowsWeekend);
  const wsMo = XLSX.utils.json_to_sheet(rowsMonday);
  const wsSum = XLSX.utils.json_to_sheet(summaryRows);

  XLSX.utils.book_append_sheet(wb, wsComp, 'Comparativa y Saltos');
  XLSX.utils.book_append_sheet(wb, wsWk, 'Plan Fin de Semana');
  XLSX.utils.book_append_sheet(wb, wsMo, 'Re-escalada Lunes');
  XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen Re-escalada');

  XLSX.writeFile(wb, filename);
}

/**
 * Copia el plan de re-escalada al portapapeles
 */
export async function copyReboundToClipboard(combinedItems, mode = 'reactivation') {
  let header = '';
  let text = '';

  if (mode === 'reactivation') {
    header = "Tienda\tProducto\tTrafiker\tPresupuesto Finde\tPresupuesto Lunes\tSalto a Inyectar ($)\tAcción Lunes\n";
    text = combinedItems
      .map(it => `${it.name}\t${it.product || ''}\t${it.trafiker || ''}\t${it.weekendBudget}\t${it.mondayBudget}\t${it.reactivationDelta}\t${it.reactivationAction}`)
      .join('\n');
  } else if (mode === 'weekend') {
    header = "Tienda\tProducto\tTrafiker\tPresupuesto Actual\tPresupuesto Finde\tVariación Finde\n";
    text = combinedItems
      .map(it => `${it.name}\t${it.product || ''}\t${it.trafiker || ''}\t${it.currentBudget}\t${it.weekendBudget}\t${it.weekendDelta}`)
      .join('\n');
  } else {
    header = "Tienda\tProducto\tTrafiker\tPresupuesto Lunes\tSalto Reactivación\n";
    text = combinedItems
      .map(it => `${it.name}\t${it.product || ''}\t${it.trafiker || ''}\t${it.mondayBudget}\t${it.reactivationDelta}`)
      .join('\n');
  }

  await navigator.clipboard.writeText(header + text);
}
