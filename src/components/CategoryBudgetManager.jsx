import React from 'react';
import { Tag, DollarSign, Percent, Sparkles, AlertCircle, CheckCircle2, Lock, Unlock, ArrowDownRight, ArrowUpRight, Calendar, RotateCcw } from 'lucide-react';

export default function CategoryBudgetManager({
  categories = [],
  categoryBudgets = {},
  setCategoryBudgets,
  totalTargetBudget = 0,
  isCategoryMode = true,
  setIsCategoryMode,
  categorySummaries = [],
  lockedCategoryBudgets = {},
  onSetCategoryBudget,
  onClearCategoryLock,
  onClearAllCategoryLocks,
  isReboundMode = false,
  reboundReductionPct = 30,
  reboundPlan = null
}) {
  if (!categories || categories.length === 0) return null;

  // Suma total asignada a categorías actualmente
  const currentAssignedTotal = Object.values(categoryBudgets).reduce(
    (acc, val) => acc + (parseFloat(val) || 0), 0
  );

  const diff = totalTargetBudget - currentAssignedTotal;
  const isBalanced = Math.abs(diff) < 5;

  // Estadísticas de bloqueo
  const lockedKeys = Object.keys(lockedCategoryBudgets || {});
  const lockedCount = lockedKeys.length;
  const lockedSum = lockedKeys.reduce((sum, k) => sum + (Number(lockedCategoryBudgets[k]) || 0), 0);
  const remainingForUnlocked = Math.max(0, totalTargetBudget - lockedSum);

  const handleBudgetChange = (cat, value) => {
    const num = Math.max(0, parseFloat(value) || 0);
    if (onSetCategoryBudget) {
      onSetCategoryBudget(cat, num);
    } else {
      setCategoryBudgets(prev => ({
        ...prev,
        [cat]: num
      }));
    }
  };

  const handleToggleLock = (cat) => {
    const isLocked = lockedCategoryBudgets && lockedCategoryBudgets[cat] !== undefined;
    if (isLocked) {
      if (onClearCategoryLock) onClearCategoryLock(cat);
    } else {
      const currentVal = categoryBudgets[cat] || 0;
      if (onSetCategoryBudget) onSetCategoryBudget(cat, currentVal);
    }
  };

  const handlePercentageChange = (cat, pct) => {
    const fraction = Math.max(0, Math.min(100, parseFloat(pct) || 0)) / 100;
    const amount = Math.floor((totalTargetBudget * fraction) / 1000) * 1000;
    if (onSetCategoryBudget) {
      onSetCategoryBudget(cat, amount);
    } else {
      setCategoryBudgets(prev => ({
        ...prev,
        [cat]: amount
      }));
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Banner de categorías bloqueadas si existen */}
      {lockedCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>{lockedCount} {lockedCount === 1 ? 'categoría tiene' : 'categorías tienen'} presupuesto manual fijado</strong> (${lockedSum.toLocaleString()} COP reservados).
              El remanente (${remainingForUnlocked.toLocaleString()} COP) se redistribuye automáticamente entre las demás categorías sin exceder el presupuesto total.
            </span>
          </div>
          {onClearAllCategoryLocks && (
            <button
              onClick={onClearAllCategoryLocks}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 transition flex items-center gap-1"
            >
              <Unlock className="w-3 h-3" /> Desbloquear todas
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <Tag className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span>Segmentación de Presupuesto por Categorías</span>
              <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                {categories.length} {categories.length === 1 ? 'categoría' : 'categorías'}
              </span>
              {isReboundMode && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Finde ➔ Lunes Activo
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {isReboundMode
                ? 'Divide tu presupuesto entre categorías; calcula automáticamente la reducción del fin de semana y la reactivación del lunes.'
                : 'Fija o divide tu presupuesto entre categorías con redistribución automática instantánea.'}
            </p>
          </div>
        </div>

        {/* Toggle para activar o desactivar la partición por categorías */}
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isCategoryMode}
              onChange={(e) => setIsCategoryMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
            <span className="ml-2 text-xs font-medium text-slate-300">
              {isCategoryMode ? 'Partición Activa' : 'Modo Global'}
            </span>
          </label>
        </div>
      </div>

      {isCategoryMode && (
        <div className="space-y-3 pt-2 border-t border-slate-800">
          {/* Alerta de balance */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-slate-400">Presupuesto Objetivo Total:</span>
              <strong className="text-white">${totalTargetBudget.toLocaleString()}</strong>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Suma Categorías:</span>
              <strong className={isBalanced ? 'text-emerald-400' : 'text-amber-400'}>
                ${currentAssignedTotal.toLocaleString()}
              </strong>
            </div>

            {isBalanced ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Total balanceado (100%)
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-amber-400 font-medium">
                  {diff > 0 ? `Falta asignar $${diff.toLocaleString()}` : `Excede en $${Math.abs(diff).toLocaleString()}`}
                </span>
                {onClearAllCategoryLocks && (
                  <button
                    onClick={onClearAllCategoryLocks}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition"
                  >
                    Equilibrar
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tarjetas de cada categoría */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const assignedAmount = categoryBudgets[cat] || 0;
              const isLocked = lockedCategoryBudgets && lockedCategoryBudgets[cat] !== undefined;
              const pct = totalTargetBudget > 0 
                ? Number(((assignedAmount / totalTargetBudget) * 100).toFixed(1)) 
                : 0;
              
              const summary = categorySummaries.find(s => s.category === cat);
              const reboundCat = reboundPlan?.categoryReboundSummaries?.find(s => s.category === cat);
              const catWeekend = reboundCat ? reboundCat.weekendBudget : Math.floor((assignedAmount * (1 - reboundReductionPct / 100)) / 1000) * 1000;
              const catDelta = assignedAmount - catWeekend;

              return (
                <div
                  key={cat}
                  className={`border rounded-xl p-3.5 flex flex-col gap-2.5 transition ${
                    isLocked 
                      ? 'bg-amber-950/20 border-amber-500/50 shadow-md shadow-amber-950/30' 
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                      <span className="text-xs font-bold text-white truncate max-w-[150px]" title={cat}>{cat}</span>
                      {isLocked ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 whitespace-nowrap">
                          <Lock className="w-2.5 h-2.5" /> Fijada
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700 whitespace-nowrap">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {summary ? `${summary.itemCount} líneas` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleToggleLock(cat)}
                        className={`p-1 rounded transition border ${
                          isLocked
                            ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-rose-950 hover:border-rose-700 hover:text-rose-300'
                            : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-amber-300 hover:border-amber-500/40'
                        }`}
                        title={isLocked ? 'Desbloquear categoría (volver a reparto automático)' : 'Bloquear presupuesto de esta categoría'}
                      >
                        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Input de monto monetario asignado a la categoría */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      {isReboundMode ? 'Presupuesto Lunes / Base ($):' : 'Presupuesto Destinado ($):'}
                    </label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={assignedAmount}
                        onChange={(e) => handleBudgetChange(cat, e.target.value)}
                        className={`w-full rounded-lg pl-7 pr-14 py-1.5 text-xs font-mono font-bold focus:outline-none transition border ${
                          isLocked
                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-300 focus:border-amber-400'
                            : 'bg-slate-900 border-slate-700 text-emerald-400 focus:border-pink-500 hover:border-slate-600'
                        }`}
                        title={isLocked ? 'Presupuesto fijado manualmente. Clic en candado para desbloquear.' : 'Modifica este monto para fijar la categoría y redistribuir el resto.'}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400">
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Slider de porcentaje del total */}
                  <div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={pct}
                      onChange={(e) => handlePercentageChange(cat, e.target.value)}
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
                    />
                  </div>

                  {/* Métricas estimadas de la categoría */}
                  {isReboundMode ? (
                    <div className="pt-2 border-t border-purple-800/40 space-y-1 text-[11px] font-mono">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-rose-300 flex items-center gap-1">
                          <ArrowDownRight className="w-3 h-3" /> Finde (-{reboundReductionPct}%):
                        </span>
                        <strong className="text-rose-300">${catWeekend.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-purple-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Lunes:
                        </span>
                        <strong className="text-purple-300">${assignedAmount.toLocaleString()}</strong>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400 font-bold">
                        <span className="flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> Salto Lunes:
                        </span>
                        <span>+${catDelta.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    summary && (
                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          Proy:{' '}
                          <strong className="text-sky-400">
                            {summary.projectedMessages > 0
                              ? `${summary.projectedMessages.toLocaleString()} msgs`
                              : assignedAmount > 0
                              ? 'Pendiente CPR'
                              : '0 msgs'}
                          </strong>
                        </span>
                        <span>
                          Efectividad:{' '}
                          <strong className="text-purple-400">
                            {!isNaN(summary.weightedEff) ? `${summary.weightedEff}%` : '0%'}
                          </strong>
                        </span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
