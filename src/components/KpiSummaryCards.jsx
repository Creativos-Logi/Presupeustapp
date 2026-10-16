import React from 'react';
import { DollarSign, MessageSquare, Target, Award, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function KpiSummaryCards({ summary }) {
  if (!summary || summary.totalCurrentBudget === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Tarjeta 1: Presupuesto Total */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Presupuesto Total</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">
            ${summary.finalTargetBudget.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            ant: ${summary.totalCurrentBudget.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
          <DeltaBadge deltaPct={summary.budgetDeltaPct} prefix="$" value={summary.budgetDelta} />
          <span className="text-slate-400 text-[11px]">vs actual</span>
        </div>
      </div>

      {/* Tarjeta 2: Mensajes Totales Proyectados */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Mensajes Totales</span>
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-sky-400">
            {summary.newTotalMessages.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            ant: {summary.currentTotalMessages.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
          <DeltaBadge deltaPct={summary.messagesDeltaPct} value={summary.messagesDelta} />
          <span className="text-slate-400 text-[11px]">volumen total</span>
        </div>
      </div>

      {/* Tarjeta 3: Mensajes Efectivos (Conversiones / Cierres) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-purple-800/60 transition bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Mensajes Efectivos</span>
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-purple-300">
            {summary.newTotalEffective.toLocaleString()}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            ant: {summary.currentTotalEffective.toLocaleString()}
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
          <DeltaBadge deltaPct={summary.effectiveDeltaPct} value={summary.effectiveDelta} highlightPositive />
          <span className="text-slate-400 text-[11px]">calidad real (ROI)</span>
        </div>
      </div>

      {/* Tarjeta 4: Efectividad Global Ponderada */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Efectividad Global</span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-amber-300">
            {summary.newWeightedEff}%
          </span>
          <span className="text-xs text-slate-500 font-mono">
            ant: {summary.currentWeightedEff}%
          </span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-mono">
          <DeltaBadge deltaPct={summary.effDelta} isPercentagePoint />
          <span className="text-slate-400 text-[11px]">
            Costo Promedio: ${summary.newBlendedCPM}
          </span>
        </div>
      </div>
    </div>
  );
}

function DeltaBadge({ deltaPct, value, prefix = '', highlightPositive, isPercentagePoint }) {
  if (deltaPct === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        <Minus className="w-3 h-3" /> 0%
      </span>
    );
  }

  const isPositive = deltaPct > 0;
  const colorClass = isPositive
    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80'
    : 'bg-rose-950/60 text-rose-400 border border-rose-800/80';

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-semibold ${colorClass}`}>
      {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {isPositive ? '+' : ''}
      {isPercentagePoint ? `${deltaPct} pp` : `${deltaPct}%`}
      {value !== undefined && !isPercentagePoint && (
        <span className="opacity-80 ml-0.5">
          ({isPositive ? '+' : ''}{prefix}{Math.round(value).toLocaleString()})
        </span>
      )}
    </span>
  );
}
