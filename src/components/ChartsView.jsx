import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine, Cell
} from 'recharts';
import { BarChart3, ScatterChart as ScatterIcon, Layers, TrendingUp, Target, Calendar, ArrowUpRight } from 'lucide-react';

export default function ChartsView({
  optimizedItems,
  displayItems,
  minEffectivenessThreshold,
  isReboundMode = false,
  reboundPlan = null
}) {
  const [activeTab, setActiveTab] = useState(isReboundMode ? 'rebound' : 'budget');

  const itemsToRender = displayItems !== undefined ? displayItems : optimizedItems;
  if (!itemsToRender || itemsToRender.length === 0) return null;

  // Datos estándar de presupuesto y mensajes
  const barData = itemsToRender.map(it => ({
    name: it.name.length > 14 ? it.name.substring(0, 12) + '...' : it.name,
    fullName: it.name,
    'Presupuesto Actual': it.currentBudget,
    'Nuevo Presupuesto': it.newBudget,
    'Mensajes Actuales': it.currentMessages,
    'Mensajes Proyectados': it.projectedMessages,
    costPerMessage: it.costPerMessage,
    effectiveness: it.effectiveness,
    statusLabel: it.statusLabel
  }));

  // Datos de Factor CPR (Costo por Mensaje / Resultado)
  const cprData = itemsToRender.map(it => ({
    name: it.name.length > 14 ? it.name.substring(0, 12) + '...' : it.name,
    fullName: it.name,
    'Costo x Mensaje': Number(it.costPerMessage) || 0,
    costPerMessage: it.costPerMessage,
    effectiveness: it.effectiveness,
    statusLabel: it.statusLabel,
    isHighCost: (Number(it.costPerMessage) || 0) > 1200
  }));

  // Datos de Factor Efectividad (%)
  const effData = itemsToRender.map(it => ({
    name: it.name.length > 14 ? it.name.substring(0, 12) + '...' : it.name,
    fullName: it.name,
    'Efectividad (%)': Number(it.effectiveness) || 0,
    costPerMessage: it.costPerMessage,
    effectiveness: it.effectiveness,
    statusLabel: it.statusLabel,
    isBelowThreshold: it.isBelowThreshold
  }));

  // Datos para gráfico de dispersión / cuadrantes
  const scatterData = itemsToRender.map(it => ({
    name: it.name,
    x: it.costPerMessage, // Costo
    y: it.effectiveness,  // Efectividad
    z: it.newBudget || it.currentBudget, // Tamaño
    currentBudget: it.currentBudget,
    isBelowThreshold: it.isBelowThreshold,
    statusLabel: it.statusLabel
  }));

  // Datos para modo Re-escalada (Finde vs Lunes)
  const reboundItems = reboundPlan?.combinedItems || [];
  const reboundBarData = reboundItems.map(it => ({
    name: it.name.length > 14 ? it.name.substring(0, 12) + '...' : it.name,
    fullName: it.name,
    'Presupuesto Actual': it.currentBudget,
    'Presupuesto Finde': it.weekendBudget,
    'Presupuesto Lunes': it.mondayBudget,
    'Salto Lunes': it.reactivationDelta,
    costPerMessage: it.costPerMessage,
    effectiveness: it.effectiveness,
    statusLabel: it.reactivationAction
  }));

  const avgCost = itemsToRender.reduce((acc, it) => acc + (Number(it.costPerMessage) || 0), 0) / (itemsToRender.length || 1);
  const avgEff = itemsToRender.reduce((acc, it) => acc + (Number(it.effectiveness) || 0), 0) / (itemsToRender.length || 1);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Análisis Visual de Barras y Factores</h2>
            <p className="text-xs text-slate-400">
              {isReboundMode 
                ? 'Compara la reducción de fin de semana con el retorno del lunes y los factores de cada tienda'
                : 'Monitorea la redistribución de presupuesto, CPR y efectividad por tienda'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
          {isReboundMode && (
            <button
              onClick={() => setActiveTab('rebound')}
              className={`px-3 py-1 font-medium rounded-lg transition flex items-center gap-1 ${
                activeTab === 'rebound'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Finde ➔ Lunes
            </button>
          )}

          <button
            onClick={() => setActiveTab('budget')}
            className={`px-3 py-1 font-medium rounded-lg transition ${
              activeTab === 'budget'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Presupuesto ($)
          </button>

          <button
            onClick={() => setActiveTab('cpr')}
            className={`px-3 py-1 font-medium rounded-lg transition flex items-center gap-1 ${
              activeTab === 'cpr'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Comparativa de Costo por Resultado de cada tienda frente al promedio"
          >
            <TrendingUp className="w-3.5 h-3.5 text-sky-300" />
            Factor CPR ($)
          </button>

          <button
            onClick={() => setActiveTab('effectiveness')}
            className={`px-3 py-1 font-medium rounded-lg transition flex items-center gap-1 ${
              activeTab === 'effectiveness'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Comparativa de Efectividad frente al umbral de corte"
          >
            <Target className="w-3.5 h-3.5 text-amber-300" />
            Factor Efectividad (%)
          </button>

          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1 font-medium rounded-lg transition ${
              activeTab === 'messages'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mensajes
          </button>

          <button
            onClick={() => setActiveTab('quadrant')}
            className={`px-3 py-1 font-medium rounded-lg transition flex items-center gap-1 ${
              activeTab === 'quadrant'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScatterIcon className="w-3.5 h-3.5" />
            Cuadrante
          </button>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        {/* PESTAÑA: RE-ESCALADA (FINDE VS LUNES) */}
        {activeTab === 'rebound' && isReboundMode && reboundBarData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reboundBarData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Presupuesto Finde" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Presupuesto Lunes" fill="#a855f7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* PESTAÑA: PRESUPUESTO ESTÁNDAR */}
        {activeTab === 'budget' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${Math.round(val / 1000)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Presupuesto Actual" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Nuevo Presupuesto" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* PESTAÑA: BARRAS DE FACTOR CPR */}
        {activeTab === 'cpr' && (
          <div className="relative h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cprData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={avgCost}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{ value: `Promedio CPR: $${Math.round(avgCost)}`, fill: '#38bdf8', fontSize: 11, position: 'top' }}
                />
                <Bar dataKey="Costo x Mensaje" radius={[4, 4, 0, 0]}>
                  {cprData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.costPerMessage <= avgCost ? '#10b981' : entry.costPerMessage > avgCost * 1.3 ? '#f43f5e' : '#0ea5e9'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 mt-1">
              <span className="text-emerald-400 font-semibold">Verde: CPR Económico (&lt; Promedio)</span>
              <span className="text-sky-400 font-semibold">Azul: CPR Cercano al Promedio</span>
              <span className="text-rose-400 font-semibold">Rojo: CPR Muy Alto (Penalizado por Factor β)</span>
            </div>
          </div>
        )}

        {/* PESTAÑA: BARRAS DE FACTOR EFECTIVIDAD */}
        {activeTab === 'effectiveness' && (
          <div className="relative h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={effData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `${val}%`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={minEffectivenessThreshold}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{ value: `Umbral Corte: ${minEffectivenessThreshold}%`, fill: '#f59e0b', fontSize: 11, position: 'top' }}
                />
                <Bar dataKey="Efectividad (%)" radius={[4, 4, 0, 0]}>
                  {effData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isBelowThreshold ? '#f59e0b' : '#a855f7'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-2 mt-1">
              <span className="text-purple-400 font-semibold">Morado: Efectividad Óptima (Priorizada por Factor α)</span>
              <span className="text-amber-400 font-semibold">Ámbar: Bajo Umbral ({minEffectivenessThreshold}%) - Protegido sin inyecciones</span>
            </div>
          </div>
        )}

        {/* PESTAÑA: MENSAJES */}
        {activeTab === 'messages' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Mensajes Actuales" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Mensajes Proyectados" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* PESTAÑA: CUADRANTE RENDIMIENTO */}
        {activeTab === 'quadrant' && (
          <div className="relative h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Costo x Mensaje" 
                  unit="$" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  label={{ value: 'Costo por Mensaje ($) →', position: 'bottom', fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Efectividad" 
                  unit="%" 
                  stroke="#94a3b8" 
                  fontSize={11} 
                  label={{ value: '↑ Efectividad (%)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[100, 500]} name="Presupuesto" />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<ScatterCustomTooltip />} />
                
                {/* Línea de corte de Efectividad Mínima */}
                <ReferenceLine 
                  y={minEffectivenessThreshold} 
                  stroke="#f59e0b" 
                  strokeDasharray="4 4" 
                  label={{ value: `Umbral Corte: ${minEffectivenessThreshold}%`, fill: '#f59e0b', fontSize: 11, position: 'right' }} 
                />
                <ReferenceLine 
                  x={avgCost} 
                  stroke="#475569" 
                  strokeDasharray="4 4" 
                  label={{ value: `Prom. CPR: $${Math.round(avgCost)}`, fill: '#94a3b8', fontSize: 10, position: 'top' }}
                />

                <Scatter name="Tiendas" data={scatterData} fill="#8b5cf6" />
              </ScatterChart>
            </ResponsiveContainer>

            <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 mt-1">
              <span className="text-emerald-400 font-semibold">↖ Cuadrante Oro: Bajo Costo & Alta Efectividad</span>
              <span className="text-amber-400 font-semibold">↙ Cuadrante Trampa: Bajo Costo & Baja Efectividad (No inyectar)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 z-50">
        <p className="font-bold text-white mb-1">{data.fullName}</p>
        <p className="text-slate-400">
          Costo x Mensaje: <span className="font-mono text-sky-400">${data.costPerMessage}</span> | Efectividad: <span className="font-mono text-purple-400">{data.effectiveness}%</span>
        </p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.fill }} className="font-mono flex justify-between gap-4">
            <span>{entry.name}:</span>
            <span className="font-bold">
              {entry.name.includes('$') || entry.name.includes('Presupuesto') || entry.name.includes('Costo')
                ? `$${entry.value.toLocaleString()}`
                : entry.name.includes('%')
                ? `${entry.value}%`
                : entry.value.toLocaleString()}
            </span>
          </p>
        ))}
        {data.statusLabel && (
          <p className="text-[11px] text-emerald-400 pt-1 border-t border-slate-800">
            {data.statusLabel}
          </p>
        )}
      </div>
    );
  }
  return null;
}

function ScatterCustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl shadow-xl text-xs space-y-1 z-50">
        <p className="font-bold text-white">{data.name}</p>
        <p className="text-slate-300">
          Costo x Mensaje: <strong className="text-sky-400 font-mono">${data.x}</strong>
        </p>
        <p className="text-slate-300">
          Efectividad: <strong className="text-purple-400 font-mono">{data.y}%</strong>
        </p>
        <p className="text-slate-300">
          Presupuesto Proyectado: <strong className="text-emerald-400 font-mono">${data.z?.toLocaleString()}</strong>
        </p>
        {data.statusLabel && (
          <p className="text-[11px] text-amber-400 font-medium pt-1 border-t border-slate-800">
            {data.statusLabel}
          </p>
        )}
      </div>
    );
  }
  return null;
}
