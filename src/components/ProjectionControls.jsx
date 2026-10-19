import React from 'react';
import { Sliders, ShieldCheck, DollarSign, Percent, ArrowUpRight, ArrowDownRight, Zap, RotateCcw, Calendar, TrendingUp, Sparkles } from 'lucide-react';

export default function ProjectionControls({
  totalCurrentBudget,
  targetBudget,
  setTargetBudget,
  pctDelta,
  setPctDelta,
  minEffectivenessThreshold,
  setMinEffectivenessThreshold,
  maxVariationPct,
  setMaxVariationPct,
  alpha,
  setAlpha,
  beta = 1.0,
  setBeta = () => {},
  filterBadgeInfo,
  isReboundMode = false,
  setIsReboundMode = () => {},
  reboundReductionPct = 30,
  setReboundReductionPct = () => {},
  reboundMondayBudget = null,
  setReboundMondayBudget = () => {},
  roundingStep = 5000,
  setRoundingStep = () => {}
}) {
  const PRESETS = [-30, -20, -10, 0, 10, 20, 30, 50];

  // Presupuesto base activo sobre el que se calculan los porcentajes
  const activeBaseBudget = (targetBudget !== null && targetBudget > 0) ? targetBudget : totalCurrentBudget;

  const handlePresetClick = (pct) => {
    setPctDelta(pct);

    if (pct === 0) {
      // 0% significa exactamente 0% de variación sobre el presupuesto fijado
      if (targetBudget !== null && targetBudget > 0) {
        return;
      }
      setTargetBudget(totalCurrentBudget);
      return;
    }

    // Escalar sobre el presupuesto activo ingresado por el usuario
    const calculatedBudget = Math.round(activeBaseBudget * (1 + pct / 100));
    setTargetBudget(calculatedBudget);
  };

  const handleCustomBudgetChange = (val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setTargetBudget(num);
    if (totalCurrentBudget > 0) {
      const delta = ((num - totalCurrentBudget) / totalCurrentBudget) * 100;
      setPctDelta(Math.round(delta));
    }
  };

  const handleResetToCurrentBudget = () => {
    setTargetBudget(null);
    setPctDelta(0);
  };

  const formatShortMoney = (val) => {
    if (!val || isNaN(val)) return '$0';
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2).replace(/\.?0+$/, '')}M`;
    }
    if (val >= 1000) {
      return `$${Math.round(val / 1000)}k`;
    }
    return `$${val}`;
  };

  const currentDisplayBudget = targetBudget !== null && !isNaN(targetBudget) ? targetBudget : totalCurrentBudget;
  const currentDeltaFromActual = totalCurrentBudget > 0 
    ? Math.round(((currentDisplayBudget - totalCurrentBudget) / totalCurrentBudget) * 100)
    : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Banner de Aislamiento de Filtro */}
      {filterBadgeInfo?.isActive && (
        <div className="bg-pink-950/40 border border-pink-500/30 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-pink-200">
            <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
            <span>
              <strong>Filtro Activo ({filterBadgeInfo.label}):</strong> Distribuyendo presupuesto exclusivamente entre <strong>{filterBadgeInfo.storesCount} tiendas</strong>.
            </span>
          </div>
          <span className="text-[11px] text-pink-300/90 bg-pink-900/50 px-2.5 py-0.5 rounded-lg border border-pink-700/50">
            {filterBadgeInfo.unfilteredCount} tiendas restantes mantienen su presupuesto intacto
          </span>
        </div>
      )}

      {/* Pestañas de Modo: Estándar vs Plan de Re-escalada */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setIsReboundMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              !isReboundMode
                ? 'bg-sky-600 text-white shadow-sm shadow-sky-900/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Simulador Estándar
          </button>
          <button
            onClick={() => setIsReboundMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              isReboundMode
                ? 'bg-purple-600 text-white shadow-sm shadow-purple-900/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-purple-200" />
            Plan Re-escalada (Finde ➔ Lunes)
            <span className="bg-purple-400/20 text-purple-300 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
              2 Fases
            </span>
          </button>
        </div>

        {/* Indicador de Redondeo Comercial en múltiplos de $5,000 COP */}
        <div className="flex items-center gap-1.5 text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-400 font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Redondeo comercial: <strong>$5,000 COP</strong> (terminados en 0 o 5)</span>
        </div>
      </div>

      {isReboundMode ? (
        /* Panel del Modo Re-escalada (Finde ➔ Lunes) */
        <div className="bg-purple-950/20 border border-purple-500/30 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-400" />
                Planificador Simultáneo de 2 Fases
              </h3>
              <p className="text-xs text-purple-200/70">
                Calcula la bajada temporal para el fin de semana y prepara la subida optimizada para el lunes.
              </p>
            </div>
            <div className="bg-purple-900/40 border border-purple-500/40 px-3 py-1.5 rounded-xl text-right">
              <span className="text-[10px] uppercase tracking-wider text-purple-300 block">Salto Total Lunes</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                +${Math.max(0, (reboundMondayBudget || activeBaseBudget) - Math.round(activeBaseBudget * (1 - reboundReductionPct / 100))).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fase 1: Reducción Fin de Semana */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-rose-300 flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4" />
                  Fase 1: Bajada Fin de Semana
                </span>
                <span className="font-mono font-bold text-rose-400">-{reboundReductionPct}%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                <span>Presupuesto Finde:</span>
                <strong className="text-white text-sm">
                  ${(Math.round((activeBaseBudget * (1 - reboundReductionPct / 100)) / 5000) * 5000).toLocaleString()}
                </strong>
              </div>
              <div className="flex gap-1.5 pt-1">
                {[-15, -20, -30, -40].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setReboundReductionPct(Math.abs(pct))}
                    className={`flex-1 py-1 rounded text-xs font-semibold transition border ${
                      reboundReductionPct === Math.abs(pct)
                        ? 'bg-rose-600 text-white border-rose-500'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            {/* Fase 2: Retorno Re-escalada Lunes */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-300 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  Fase 2: Retorno Óptimo Lunes
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Base: ${activeBaseBudget.toLocaleString()}
                </span>
              </div>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  step="5000"
                  value={reboundMondayBudget !== null ? reboundMondayBudget : activeBaseBudget}
                  onChange={(e) => setReboundMondayBudget(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Presupuesto a recuperar el lunes"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Vuelve a presupuesto completo:</span>
                <button
                  onClick={() => setReboundMondayBudget(activeBaseBudget)}
                  className="text-xs text-sky-400 hover:underline font-mono"
                >
                  Restablecer a ${activeBaseBudget.toLocaleString()}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              {filterBadgeInfo?.isActive ? `Simulador Focalizado (${filterBadgeInfo.label})` : 'Simulador y Proyección de Presupuesto'}
            </h2>
            <p className="text-xs text-slate-400">
              {filterBadgeInfo?.isActive 
                ? `Ajusta el presupuesto sólo para las ${filterBadgeInfo.storesCount} tiendas filtradas`
                : 'Ajusta el presupuesto de la cartera a la baja o al alza'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs text-slate-400">
              {filterBadgeInfo?.isActive ? 'Presupuesto Objetivo:' : 'Nuevo Presupuesto:'}
            </span>
            <span className="text-sm font-bold text-emerald-400 font-mono">
              ${currentDisplayBudget.toLocaleString()}
            </span>
            <span className={`text-xs font-semibold font-mono flex items-center ${
              currentDeltaFromActual > 0 ? 'text-emerald-400' : currentDeltaFromActual < 0 ? 'text-rose-400' : 'text-slate-400'
            }`}>
              {currentDeltaFromActual > 0 ? <ArrowUpRight className="w-3 h-3" /> : currentDeltaFromActual < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
              {currentDeltaFromActual > 0 ? `+${currentDeltaFromActual}%` : `${currentDeltaFromActual}%`}
            </span>
          </div>

          {targetBudget !== null && targetBudget !== totalCurrentBudget && (
            <button
              onClick={handleResetToCurrentBudget}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Restablecer al gasto histórico actual de las tiendas"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Input numérico directo de presupuesto */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-slate-800/80">
        <div>
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <strong>Presupuesto Total Objetivo ($):</strong>
            </span>
            <span className="text-slate-400 text-[11px]">
              Actual de tiendas: <strong className="text-slate-300 font-mono">${totalCurrentBudget.toLocaleString()}</strong>
            </span>
          </label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min="0"
              step="1000"
              value={targetBudget !== null && !isNaN(targetBudget) ? targetBudget : totalCurrentBudget}
              onChange={(e) => handleCustomBudgetChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-emerald-400 font-mono font-bold focus:outline-none focus:border-emerald-500"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Escribe el valor exacto que deseas repartir (ej. $1,250,000). El algoritmo distribuirá exactamente esta cifra.
          </p>
        </div>

        {/* Umbral de Efectividad Mínima (La Regla Principal del Usuario) */}
        <div>
          <label className="text-xs font-medium text-amber-300 flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Umbral Mínimo de Efectividad:
            </span>
            <span className="font-mono font-bold text-amber-400">{minEffectivenessThreshold}%</span>
          </label>
          <input
            type="range"
            min="2"
            max="25"
            step="0.5"
            value={minEffectivenessThreshold}
            onChange={(e) => setMinEffectivenessThreshold(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Líneas con efectividad menor a <strong className="text-amber-300">{minEffectivenessThreshold}%</strong> <u>no recibirán inyecciones</u> de presupuesto adicional aunque su costo por mensaje sea bajo.
          </p>
        </div>
      </div>

      {/* Botones de Acceso Rápido (% Presets con Monto Explícito) */}
      <div className="pt-2 border-t border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
            <span>Escalar Presupuesto Activo ({formatShortMoney(activeBaseBudget)}):</span>
          </label>
          <span className="text-[11px] text-slate-500">
            Cada botón muestra el nuevo presupuesto exacto calculado
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {PRESETS.map((pct) => {
            const calculatedAmount = Math.round(activeBaseBudget * (1 + pct / 100));
            const isSelected = pctDelta === pct;
            return (
              <button
                key={pct}
                onClick={() => handlePresetClick(pct)}
                className={`py-1.5 px-1.5 rounded-lg text-xs font-semibold transition border flex flex-col items-center justify-center ${
                  isSelected
                    ? pct > 0
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/40'
                      : pct < 0
                      ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-900/40'
                      : 'bg-slate-700 text-white border-slate-600'
                    : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border-slate-800'
                }`}
                title={`Ajustar presupuesto a ${formatShortMoney(calculatedAmount)} (${pct > 0 ? '+' : ''}${pct}%)`}
              >
                <span>{pct === 0 ? '0%' : `${pct > 0 ? '+' : ''}${pct}%`}</span>
                <span className="text-[10px] opacity-75 font-mono font-normal">
                  {formatShortMoney(calculatedAmount)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Ajustes avanzados: Variación máxima y Barras de Factores (Efectividad y CPR) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800/80 text-xs">
        {/* Barra 1: Guardrail de Variación Máxima */}
        <div>
          <div className="flex items-center justify-between mb-1 text-slate-300">
            <span>Variación Máxima (Guardrail):</span>
            <span className="font-mono font-semibold text-sky-400">±{maxVariationPct}%</span>
          </div>
          <input
            type="range"
            min="15"
            max="100"
            step="5"
            value={maxVariationPct}
            onChange={(e) => setMaxVariationPct(parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Protege el aprendizaje en Meta Ads limitando variaciones bruscas.
          </p>
        </div>

        {/* Barra 2: Factor de Efectividad (Alpha) */}
        <div>
          <div className="flex items-center justify-between mb-1 text-slate-300">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-purple-400" />
              Factor Efectividad (α):
            </span>
            <span className="font-mono font-semibold text-purple-400">
              {alpha.toFixed(1)}x ({alpha <= 1.1 ? 'Equilibrado' : alpha <= 1.4 ? 'Fuerte' : 'Agresivo'})
            </span>
          </div>
          <input
            type="range"
            min="1.0"
            max="2.0"
            step="0.1"
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Premia más intensamente la efectividad por encima del volumen de mensajes.
          </p>
        </div>

        {/* Barra 3: Factor de Costo por Resultado / CPR (Beta) */}
        <div>
          <div className="flex items-center justify-between mb-1 text-slate-300">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              Factor CPR / Costo (β):
            </span>
            <span className="font-mono font-semibold text-emerald-400">
              {beta.toFixed(1)}x ({beta <= 0.8 ? 'Tolerante' : beta <= 1.2 ? 'Equilibrado' : beta <= 1.6 ? 'Exigente' : 'Muy Severo'})
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={beta}
            onChange={(e) => setBeta(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Penaliza costos por mensaje elevados y premia tiendas con CPR más económico.
          </p>
        </div>
      </div>
    </div>
  );
}
