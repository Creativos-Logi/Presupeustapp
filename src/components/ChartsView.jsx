import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, ReferenceLine
} from 'recharts';
import { BarChart3, ScatterChart as ScatterIcon, Layers } from 'lucide-react';

export default function ChartsView({ optimizedItems, displayItems, minEffectivenessThreshold }) {
  const [activeTab, setActiveTab] = useState('budget'); // 'budget', 'messages', 'quadrant'

  const itemsToRender = displayItems !== undefined ? displayItems : optimizedItems;
  if (!itemsToRender || itemsToRender.length === 0) return null;

  // Datos preparados para gráficos de barras
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

  // Datos para gráfico de dispersión / cuadrantes
  const scatterData = itemsToRender.map(it => ({
    name: it.name,
    x: it.costPerMessage, // Costo
    y: it.effectiveness,  // Efectividad
    z: it.newBudget,      // Tamaño según nuevo presupuesto
    currentBudget: it.currentBudget,
    isBelowThreshold: it.isBelowThreshold,
    statusLabel: it.statusLabel
  }));

  const avgCost = itemsToRender.reduce((acc, it) => acc + it.costPerMessage, 0) / itemsToRender.length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Análisis Visual Comparativo</h2>
            <p className="text-xs text-slate-400">Visualiza la redistribución y el posicionamiento de cada tienda</p>
          </div>
        </div>

        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab('budget')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
              activeTab === 'budget'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Presupuesto ($)
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
              activeTab === 'messages'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mensajes Proyectados
          </button>
          <button
            onClick={() => setActiveTab('quadrant')}
            className={`px-3 py-1 text-xs font-medium rounded-lg transition flex items-center gap-1 ${
              activeTab === 'quadrant'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ScatterIcon className="w-3.5 h-3.5" />
            Cuadrante Rendimiento
          </button>
        </div>
      </div>

      <div className="h-72 w-full pt-2">
        {activeTab === 'budget' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} interval={0} angle={-15} textAnchor="end" />
              <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(val) => `$${val}`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: 10, fontSize: 12 }} />
              <Bar dataKey="Presupuesto Actual" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Nuevo Presupuesto" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

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
                <ZAxis type="number" dataKey="z" range={[100, 500]} name="Nuevo Presupuesto" />
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
              {entry.name.includes('$') || entry.name.includes('Presupuesto') ? `$${entry.value.toLocaleString()}` : entry.value.toLocaleString()}
            </span>
          </p>
        ))}
        <p className="text-[11px] text-emerald-400 pt-1 border-t border-slate-800">
          {data.statusLabel}
        </p>
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
        <p className="text-[11px] text-amber-400 font-medium pt-1 border-t border-slate-800">
          {data.statusLabel}
        </p>
      </div>
    );
  }
  return null;
}
