import React, { useState } from 'react';
import { Download, Clipboard, Check, Sparkles, AlertTriangle, ArrowUpRight, ArrowDownRight, User, Briefcase, Tag, Eye, Filter, Calendar, Zap } from 'lucide-react';
import { exportToExcel, copyBudgetToClipboard, exportReboundToExcel, copyReboundToClipboard } from '../utils/export';

export default function ResultsTable({
  optimizedItems,
  summary,
  displayItems,
  allOptimizedItems,
  isFilterActive = false,
  filterLabel = '',
  isReboundMode = false,
  reboundPlan = null
}) {
  const [copied, setCopied] = useState(false);
  const [copiedMode, setCopiedMode] = useState('');
  const [showAllInTable, setShowAllInTable] = useState(false);

  if ((!optimizedItems || optimizedItems.length === 0) && (!reboundPlan?.combinedItems || reboundPlan.combinedItems.length === 0)) return null;

  // Si hay filtro activo y el usuario no eligió ver toda la cartera, mostrar sólo las filtradas
  const itemsToRender = (isFilterActive && !showAllInTable && displayItems) ? displayItems : (allOptimizedItems || optimizedItems);
  const reboundItemsToRender = reboundPlan?.combinedItems || [];

  const handleCopy = async (mode = 'standard') => {
    try {
      if (isReboundMode && reboundPlan) {
        await copyReboundToClipboard(reboundItemsToRender, mode);
        setCopiedMode(mode);
      } else {
        await copyBudgetToClipboard(itemsToRender);
        setCopiedMode('standard');
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setCopiedMode('');
      }, 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadExcel = () => {
    if (isReboundMode && reboundPlan) {
      exportReboundToExcel(reboundItemsToRender, reboundPlan.reboundSummary);
    } else {
      exportToExcel(itemsToRender, summary);
    }
  };

  const totalFilteredCurrent = itemsToRender.reduce((acc, it) => acc + (it.currentBudget || 0), 0);
  const totalFilteredNew = itemsToRender.reduce((acc, it) => acc + (it.newBudget || 0), 0);
  const totalFilteredDelta = totalFilteredNew - totalFilteredCurrent;
  const totalFilteredDeltaPct = totalFilteredCurrent > 0 ? ((totalFilteredDelta / totalFilteredCurrent) * 100).toFixed(1) : 0;
  const totalFilteredProjMsgs = itemsToRender.reduce((acc, it) => acc + (it.projectedMessages || 0), 0);
  const totalFilteredEffMsgs = itemsToRender.reduce((acc, it) => acc + (it.projectedEffectiveMessages || 0), 0);

  // Totales para modo Re-escalada
  const reboundTotalActual = reboundItemsToRender.reduce((acc, it) => acc + (it.currentBudget || 0), 0);
  const reboundTotalWeekend = reboundItemsToRender.reduce((acc, it) => acc + (it.weekendBudget || 0), 0);
  const reboundTotalMonday = reboundItemsToRender.reduce((acc, it) => acc + (it.mondayBudget || 0), 0);
  const reboundTotalDelta = reboundTotalMonday - reboundTotalWeekend;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            {isReboundMode ? (
              <>
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>Plan de Re-escalada: Fin de Semana ➔ Retorno Lunes</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-bold">
                  2 Fases Simultáneas
                </span>
              </>
            ) : (
              <>
                <span>Redistribución Recomendada por Línea</span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {itemsToRender.length} {itemsToRender.length === 1 ? 'tienda' : 'tiendas'}
                </span>
              </>
            )}
            {isFilterActive && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 font-medium flex items-center gap-1">
                <Filter className="w-3 h-3" />
                {showAllInTable ? 'Cartera Completa (No filtradas intactas)' : 'Sólo Selección Filtrada'}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400">
            {isReboundMode
              ? 'Calcula cuánto recortar el fin de semana y prepara cuánto inyectar el lunes para volver al presupuesto óptimo sin pérdidas.'
              : isFilterActive 
              ? `El presupuesto se distribuye únicamente entre lo filtrado (${filterLabel || 'selección'}); lo demás mantiene su presupuesto intacto.`
              : 'Asignación calculada protegiendo la rentabilidad de las líneas de baja efectividad con redondeo a $5,000 COP.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isFilterActive && allOptimizedItems && !isReboundMode && (
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 mr-2 text-xs">
              <button
                onClick={() => setShowAllInTable(false)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  !showAllInTable
                    ? 'bg-pink-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎯 Filtradas ({displayItems?.length || 0})
              </button>
              <button
                onClick={() => setShowAllInTable(true)}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  showAllInTable
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌐 Ver Todas ({allOptimizedItems.length})
              </button>
            </div>
          )}

          {isReboundMode ? (
            <>
              <button
                onClick={() => handleCopy('reactivation')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-700 hover:bg-purple-600 text-white border border-purple-600 transition shadow-sm"
                title="Copiar saltos que debes inyectar el lunes por tienda"
              >
                {copied && copiedMode === 'reactivation' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Zap className="w-3.5 h-3.5" />}
                {copied && copiedMode === 'reactivation' ? '¡Saltos Copiados!' : 'Copiar Saltos Lunes'}
              </button>
              <button
                onClick={() => handleCopy('weekend')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                title="Copiar presupuestos reducidos de fin de semana"
              >
                {copied && copiedMode === 'weekend' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
                {copied && copiedMode === 'weekend' ? '¡Finde Copiado!' : 'Copiar Finde'}
              </button>
            </>
          ) : (
            <button
              onClick={() => handleCopy('standard')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Copiar datos tabulares para pegar en Excel o Meta Ads"
            >
              {copied && copiedMode === 'standard' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
              {copied && copiedMode === 'standard' ? '¡Copiado!' : 'Copiar Portapapeles'}
            </button>
          )}

          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            {isReboundMode ? 'Descargar Plan Excel (.xlsx)' : 'Descargar Excel (.xlsx)'}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        {isReboundMode ? (
          /* TABLA DE RE-ESCALADA: 2 FASES (FINDE ➔ LUNES) */
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Tienda / Línea</th>
                <th className="py-3 px-3">Producto</th>
                <th className="py-3 px-3">Trafiker</th>
                <th className="py-3 px-3 text-right">Presupuesto Actual</th>
                <th className="py-3 px-3 text-right text-sky-400">CPR ($)</th>
                <th className="py-3 px-3 text-right text-rose-300">Presupuesto Finde</th>
                <th className="py-3 px-3 text-right text-purple-300">Presupuesto Lunes</th>
                <th className="py-3 px-3 text-right text-emerald-400">Salto Reactivación</th>
                <th className="py-3 px-3 text-right">Efectividad</th>
                <th className="py-3 px-3 text-center">Acción Recomendada Lunes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {reboundItemsToRender.map((item) => {
                const isPositiveReactivation = item.reactivationDelta > 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Tienda */}
                    <td className="py-2.5 px-3 font-sans font-medium text-white">
                      {item.name}
                    </td>

                    {/* Producto */}
                    <td className="py-2.5 px-3 font-sans">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-500/10 text-pink-300 border border-pink-500/20 whitespace-nowrap">
                        {item.product || item.category || 'CAMISETAS'}
                      </span>
                    </td>

                    {/* Trafiker */}
                    <td className="py-2.5 px-3 font-sans">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${
                        item.trafiker === 'Oscar'
                          ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      }`}>
                        <User className="w-2.5 h-2.5" /> {item.trafiker || 'Sin asignar'}
                      </span>
                    </td>

                    {/* Presupuesto Actual */}
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      ${item.currentBudget.toLocaleString()}
                    </td>

                    {/* CPR (Costo x Mensaje) */}
                    <td className="py-2.5 px-3 text-right text-sky-400 font-bold">
                      ${Number(item.costPerMessage || 0).toFixed(0)}
                    </td>

                    {/* Presupuesto Finde */}
                    <td className="py-2.5 px-3 text-right font-bold text-rose-300">
                      ${item.weekendBudget.toLocaleString()}
                      <span className="text-[10px] block opacity-75 font-normal text-rose-400">
                        {item.weekendDeltaPct > 0 ? '+' : ''}{item.weekendDeltaPct}%
                      </span>
                    </td>

                    {/* Presupuesto Lunes */}
                    <td className="py-2.5 px-3 text-right font-bold text-purple-300">
                      ${item.mondayBudget.toLocaleString()}
                    </td>

                    {/* Salto de Reactivación (Lunes - Finde) */}
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                      <span className="inline-flex items-center gap-0.5">
                        {isPositiveReactivation ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> : null}
                        +${item.reactivationDelta.toLocaleString()}
                      </span>
                      <span className="text-[10px] block text-emerald-400/80 font-normal">
                        (+{item.reactivationDeltaPct}%)
                      </span>
                    </td>

                    {/* Efectividad */}
                    <td className="py-2.5 px-3 text-right">
                      <span className={item.isBelowThreshold ? 'text-amber-400 font-bold' : 'text-purple-300'}>
                        {item.effectiveness}%
                      </span>
                    </td>

                    {/* Acción Lunes */}
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap ${item.reactivationColor}`}>
                        {item.reactivationAction}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-950/90 font-bold text-xs border-t-2 border-slate-700 text-slate-200 font-mono">
              <tr>
                <td colSpan="3" className="py-3 px-3 font-sans">TOTALES CONSOLIDADOS (FINDE ➔ LUNES)</td>
                <td className="py-3 px-3 text-right">${reboundTotalActual.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-sky-400">${summary?.newBlendedCPM || 0}</td>
                <td className="py-3 px-3 text-right text-rose-400">${reboundTotalWeekend.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-purple-300">${reboundTotalMonday.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-emerald-400">+${reboundTotalDelta.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-purple-300">
                  {reboundPlan?.reboundSummary?.mondaySummary?.newWeightedEff || 0}% pond.
                </td>
                <td className="py-3 px-3 text-center text-emerald-400 font-sans">
                  Retorno Óptimo Garantizado
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          /* TABLA ESTÁNDAR */
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Tienda / Línea</th>
                <th className="py-3 px-3">Producto</th>
                <th className="py-3 px-3">Trafiker</th>
                <th className="py-3 px-3">Coordinador</th>
                <th className="py-3 px-3 text-right">Presupuesto Actual</th>
                <th className="py-3 px-3 text-right">Nuevo Presupuesto</th>
                <th className="py-3 px-3 text-right">Variación ($)</th>
                <th className="py-3 px-3 text-right">Costo x Msg</th>
                <th className="py-3 px-3 text-right">Efectividad</th>
                <th className="py-3 px-3 text-right">Msg. Proyectados</th>
                <th className="py-3 px-3 text-right">Msg. Efectivos</th>
                <th className="py-3 px-3 text-center">Acción Recomendada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {itemsToRender.length === 0 ? (
                <tr>
                  <td colSpan="12" className="py-8 text-center text-slate-500 font-sans">
                    No hay tiendas que coincidan con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                itemsToRender.map((item) => {
                  const isPositive = item.budgetDelta > 0;
                  const isNegative = item.budgetDelta < 0;
                  const isUntouched = item.statusLabel && item.statusLabel.includes('Fuera de Filtro');

                  return (
                    <tr key={item.id} className={`transition-colors ${isUntouched ? 'opacity-65 hover:opacity-100 bg-slate-950/40' : 'hover:bg-slate-800/30'}`}>
                      {/* Tienda */}
                      <td className="py-2.5 px-3 font-sans font-medium text-white">
                        {item.name}
                      </td>

                      {/* Producto */}
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-500/10 text-pink-300 border border-pink-500/20 whitespace-nowrap">
                          {item.product || item.category || 'CAMISETAS'}
                        </span>
                      </td>

                      {/* Trafiker */}
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ${
                          item.trafiker === 'Oscar'
                            ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                            : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}>
                          <User className="w-2.5 h-2.5" /> {item.trafiker || 'Sin asignar'}
                        </span>
                      </td>

                      {/* Coordinador */}
                      <td className="py-2.5 px-3 font-sans">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20 whitespace-nowrap">
                          <Briefcase className="w-2.5 h-2.5" /> {item.coordinator || 'Sin asignar'}
                        </span>
                      </td>

                      {/* Presupuesto Actual */}
                      <td className="py-2.5 px-3 text-right text-slate-400">
                        ${item.currentBudget.toLocaleString()}
                      </td>

                      {/* Nuevo Presupuesto */}
                      <td className={`py-2.5 px-3 text-right font-bold ${isUntouched ? 'text-slate-300' : 'text-emerald-400'}`}>
                        ${item.newBudget.toLocaleString()}
                      </td>

                      {/* Variación */}
                      <td className="py-2.5 px-3 text-right">
                        {isUntouched ? (
                          <span className="text-slate-500 text-[11px] font-sans">
                            $0 (0%)
                          </span>
                        ) : (
                          <span className={`inline-flex items-center gap-0.5 font-semibold ${
                            isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
                          }`}>
                            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : isNegative ? <ArrowDownRight className="w-3 h-3" /> : null}
                            {isPositive ? '+' : ''}${item.budgetDelta.toLocaleString()}
                            <span className="text-[10px] ml-0.5 opacity-80">
                              ({isPositive ? '+' : ''}{item.budgetDeltaPct}%)
                            </span>
                          </span>
                        )}
                      </td>

                      {/* Costo x Msg */}
                      <td className="py-2.5 px-3 text-right text-sky-400">
                        ${Number(item.costPerMessage || 0).toFixed(0)}
                      </td>

                      {/* Efectividad */}
                      <td className="py-2.5 px-3 text-right">
                        <span className={item.isBelowThreshold ? 'text-amber-400 font-bold' : 'text-purple-300'}>
                          {item.effectiveness}%
                        </span>
                      </td>

                      {/* Msg Proyectados */}
                      <td className="py-2.5 px-3 text-right text-slate-200">
                        {item.projectedMessages?.toLocaleString()}
                        {!isUntouched && (
                          <span className={`text-[10px] ml-1 ${item.messagesDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            ({item.messagesDelta >= 0 ? '+' : ''}{item.messagesDelta})
                          </span>
                        )}
                      </td>

                      {/* Msg Efectivos */}
                      <td className="py-2.5 px-3 text-right text-purple-300 font-bold">
                        {item.projectedEffectiveMessages?.toLocaleString()}
                      </td>

                      {/* Acción Recomendada */}
                      <td className="py-2.5 px-3 text-center font-sans">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border whitespace-nowrap ${item.statusBadgeColor}`}>
                          {item.statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot className="bg-slate-950/90 font-bold text-xs border-t-2 border-slate-700 text-slate-200 font-mono">
              <tr>
                <td colSpan="4" className="py-3 px-3 font-sans">TOTALES CONSOLIDADOS</td>
                <td className="py-3 px-3 text-right">${totalFilteredCurrent.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-emerald-400">${totalFilteredNew.toLocaleString()}</td>
                <td className="py-3 px-3 text-right text-emerald-400">
                  {totalFilteredDelta > 0 ? '+' : ''}${totalFilteredDelta.toLocaleString()} ({totalFilteredDeltaPct}%)
                </td>
                <td className="py-3 px-3 text-right text-sky-400">${summary.newBlendedCPM} (prom.)</td>
                <td className="py-3 px-3 text-right text-purple-300">{summary.newWeightedEff}% (pond.)</td>
                <td className="py-3 px-3 text-right text-sky-300">
                  {totalFilteredProjMsgs.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-right text-purple-300">
                  {totalFilteredEffMsgs.toLocaleString()}
                </td>
                <td className="py-3 px-3 text-center text-emerald-400 font-sans">
                  +{summary.effectiveDeltaPct}% Efectividad Total
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}
