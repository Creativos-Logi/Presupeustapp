import React from 'react';
import { X, ShieldAlert, CheckCircle, Calculator, Info } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">¿Cómo Funciona la Optimización y Redistribución?</h2>
            <p className="text-xs text-slate-400">Lógica algorítmica y protección contra trampas de bajo costo</p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
          {/* Trampa de bajo costo */}
          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-300 mb-1">
                La Regla de Oro: Evitar la "Trampa del Mensaje Barato pero Inútil"
              </h3>
              <p>
                Si una tienda tiene un costo por mensaje muy bajo (ej. \$0.60) pero su efectividad de cierre es de apenas 2%, 
                cada conversión real te cuesta \$30.00. En cambio, una tienda con costo de \$1.80 pero efectividad del 20% 
                produce una conversión por solo \$9.00.
              </p>
              <p className="mt-1 text-amber-200/90 font-medium">
                👉 El algoritmo bloquea el incremento de presupuesto a toda tienda cuya efectividad esté por debajo del umbral mínimo seleccionado, protegiendo tu inversión.
              </p>
            </div>
          </div>

          {/* Fórmula IRC */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <h3 className="font-semibold text-white mb-1.5 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              Índice de Rendimiento Compuesto (IRC)
            </h3>
            <p className="mb-2">
              El motor evalúa cada línea utilizando la relación ponderada entre efectividad y costo:
            </p>
            <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80 font-mono text-center text-emerald-300 text-xs">
              IRC = (Efectividad ^ α) / (Costo_por_Mensaje ^ β)
            </div>
            <p className="mt-2 text-slate-400">
              Donde α premia exponencialmente la calidad de conversión, dirigiendo los dólares liberados hacia las líneas que realmente convierten más.
            </p>
          </div>

          {/* Proyecciones de Presupuesto */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
            <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-sky-400" />
              Proyecciones al Alza o a la Baja
            </h3>
            <p>
              Puedes simular reducciones (-10%, -20%, etc.) o incrementos (+10%, +30%, etc.). El sistema calcula exactamente 
              cuántos mensajes totales y mensajes efectivos ganarás o perderás en cada escenario, respetando guardrails de seguridad 
              para no desestabilizar la fase de aprendizaje de tus campañas publicitarias.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
