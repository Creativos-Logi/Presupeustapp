import React from 'react';
import { Sparkles, TrendingUp, HelpCircle, RefreshCw, Database } from 'lucide-react';

export default function Header({ onReset, onLoadSample, onOpenHelp, onOpenCatalog }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <TrendingUp className="w-5 h-5 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-tight">
                Optimizador de Presupuesto Publicitario
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Multi-Línea & ROI
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Redistribución inteligente por Efectividad y Costo x Mensaje
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onLoadSample('realTracking')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40 transition"
            title="Cargar las 34 tiendas reales con efectividad calculada del 12 al 15 de octubre"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Cargar Datos Reales (34 Tiendas Octubre)
          </button>

          <button
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-pink-950/40 hover:bg-pink-900/50 text-pink-300 border border-pink-800/80 transition"
            title="Ver catálogo oficial de 79 tiendas y cargarlas"
          >
            <Database className="w-3.5 h-3.5 text-pink-400" />
            Catálogo Maestro (79 Tiendas)
          </button>

          <button
            onClick={onOpenHelp}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          >
            <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
            Lógica Algorítmica
          </button>

          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-900 transition"
            title="Limpiar datos"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reiniciar
          </button>
        </div>
      </div>
    </header>
  );
}
