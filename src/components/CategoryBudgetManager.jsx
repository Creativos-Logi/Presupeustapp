import React from 'react';
import { Tag, DollarSign, Percent, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CategoryBudgetManager({
  categories,
  categoryBudgets,
  setCategoryBudgets,
  totalTargetBudget,
  isCategoryMode,
  setIsCategoryMode,
  categorySummaries = []
}) {
  if (!categories || categories.length === 0) return null;

  // Suma total asignada a categorías actualmente
  const currentAssignedTotal = Object.values(categoryBudgets).reduce(
    (acc, val) => acc + (parseFloat(val) || 0), 0
  );

  const diff = totalTargetBudget - currentAssignedTotal;
  const isBalanced = Math.abs(diff) < 5;

  const handleBudgetChange = (cat, value) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setCategoryBudgets(prev => ({
      ...prev,
      [cat]: num
    }));
  };

  const handlePercentageChange = (cat, pct) => {
    const fraction = Math.max(0, Math.min(100, parseFloat(pct) || 0)) / 100;
    const amount = Math.round(totalTargetBudget * fraction);
    setCategoryBudgets(prev => ({
      ...prev,
      [cat]: amount
    }));
  };

  // Botón para equilibrar el sobrante o faltante automáticamente
  const handleAutoBalance = () => {
    if (categories.length === 0) return;
    const count = categories.length;
    // Si la suma es 0 o muy distinta, repartir proporcional o equitativo
    const equalShare = Math.round(totalTargetBudget / count);
    const newBudgets = {};
    let sum = 0;
    categories.forEach((cat, idx) => {
      if (idx === count - 1) {
        newBudgets[cat] = totalTargetBudget - sum;
      } else {
        newBudgets[cat] = equalShare;
        sum += equalShare;
      }
    });
    setCategoryBudgets(newBudgets);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
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
            </h2>
            <p className="text-xs text-slate-400">
              Divide tu presupuesto total entre categorías (ej. Camisetas vs Conjuntos)
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
                <button
                  onClick={handleAutoBalance}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium border border-slate-700 transition"
                >
                  Equilibrar
                </button>
              </div>
            )}
          </div>

          {/* Tarjetas de cada categoría */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories.map((cat) => {
              const assignedAmount = categoryBudgets[cat] || 0;
              const pct = totalTargetBudget > 0 
                ? Number(((assignedAmount / totalTargetBudget) * 100).toFixed(1)) 
                : 0;
              
              const summary = categorySummaries.find(s => s.category === cat);

              return (
                <div
                  key={cat}
                  className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pink-400"></span>
                      {cat}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {summary ? `${summary.itemCount} líneas` : ''}
                    </span>
                  </div>

                  {/* Input de monto monetario asignado a la categoría */}
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Presupuesto Destinado ($):
                    </label>
                    <div className="relative">
                      <DollarSign className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={assignedAmount}
                        onChange={(e) => handleBudgetChange(cat, e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-12 py-1.5 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-pink-500"
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
                  {summary && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Proy: <strong className="text-sky-400">{summary.projectedMessages.toLocaleString()} msgs</strong></span>
                      <span>Efectividad: <strong className="text-purple-400">{summary.weightedEff}%</strong></span>
                    </div>
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
