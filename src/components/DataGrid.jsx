import React from 'react';
import { Plus, Trash2, AlertCircle, Edit2, Layers, User, Briefcase, Tag } from 'lucide-react';
import { getCatalogCategories, getCatalogProducts, getCatalogCoordinators, getCatalogTrafikers, findInCatalog, enrichItemWithCatalog } from '../data/storeCatalog';

export default function DataGrid({ items, setItems, displayItems, minEffectivenessThreshold, portfolioAvgCost = 800 }) {
  const CATEGORY_OPTIONS = getCatalogCategories();
  const PRODUCT_OPTIONS = getCatalogProducts();
  const COORDINATOR_OPTIONS = getCatalogCoordinators();
  const TRAFIKER_OPTIONS = getCatalogTrafikers();

  const renderedItems = displayItems !== undefined ? displayItems : items;

  const handleItemChange = (id, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        
        // Si cambia el nombre, buscar en el catálogo oficial para auto-completar metadatos
        if (field === 'name') {
          const match = findInCatalog(value);
          if (match) {
            updated.category = match.category;
            updated.product = match.product;
            updated.coordinator = match.coordinator;
            updated.trafiker = match.trafiker;
            updated.group = match.group;
          }
        }

        // Recalcular mensajes actuales si cambia presupuesto o costo
        if (field === 'currentBudget' || field === 'costPerMessage') {
          const budget = field === 'currentBudget' ? parseFloat(value) || 0 : item.currentBudget;
          const cost = field === 'costPerMessage' ? (parseFloat(value) >= 0 ? parseFloat(value) : 0) : item.costPerMessage;
          updated.currentMessages = cost > 0 ? Math.round(budget / cost) : (item.currentMessages || 0);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleAddItem = () => {
    const newItem = enrichItemWithCatalog({
      id: `item-${Date.now()}`,
      name: `Nueva Línea ${items.length + 1}`,
      category: 'CAMISETAS',
      product: 'CAMISETAS',
      coordinator: 'GOMEZ',
      trafiker: 'Oscar',
      currentBudget: 150000,
      costPerMessage: 800,
      effectiveness: 8.0,
      currentMessages: 188
    });
    setItems(prev => [...prev, newItem]);
  };

  const handleDeleteItem = (id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  if (!items || items.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center">
        <Layers className="w-10 h-10 text-slate-600 mx-auto mb-2" />
        <h3 className="text-sm font-semibold text-slate-300">No hay tiendas o líneas cargadas</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Carga una captura de pantalla arriba, pega datos de Excel o usa el botón "Cargar Ejemplo" para empezar.
        </p>
      </div>
    );
  }

  const totalCurrentBudget = renderedItems.reduce((acc, it) => acc + (Number(it.currentBudget) || 0), 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">
            Datos y Métricas de Tiendas
          </h2>
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
            {renderedItems.length} {renderedItems.length === 1 ? 'línea' : 'líneas'}
            {displayItems && displayItems.length !== items.length && (
              <span className="text-pink-400 ml-1">(de {items.length} total)</span>
            )}
          </span>
          <span className="text-xs text-slate-400">
            | Presupuesto Actual: <strong className="text-emerald-400">${totalCurrentBudget.toLocaleString()}</strong>
          </span>
        </div>

        <button
          onClick={handleAddItem}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Añadir Tienda
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">Tienda / Línea</th>
              <th className="py-2.5 px-3">Producto</th>
              <th className="py-2.5 px-3">Trafiker</th>
              <th className="py-2.5 px-3">Coordinador</th>
              <th className="py-2.5 px-3 text-right">Presupuesto Actual ($)</th>
              <th className="py-2.5 px-3 text-right">Costo x Mensaje ($)</th>
              <th className="py-2.5 px-3 text-right">Efectividad (%)</th>
              <th className="py-2.5 px-3 text-right">Mensajes</th>
              <th className="py-2.5 px-3 text-center">Diagnóstico</th>
              <th className="py-2.5 px-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {renderedItems.length === 0 ? (
              <tr>
                <td colSpan="10" className="py-8 text-center text-slate-500 font-sans">
                  No se encontraron tiendas que coincidan con los filtros aplicados.
                </td>
              </tr>
            ) : (
              renderedItems.map((item) => {
                const isLowEff = Number(item.effectiveness) < minEffectivenessThreshold;
                const isCheapAndLowEff = isLowEff && Number(item.costPerMessage) < 600;

                return (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Nombre */}
                    <td className="py-2 px-3 font-sans font-medium text-white min-w-[140px]">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                        className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-emerald-500 focus:outline-none w-full text-xs font-sans text-slate-100"
                      />
                    </td>

                    {/* Producto */}
                    <td className="py-2 px-3 font-sans">
                      <select
                        value={item.product || item.category || 'CAMISETAS'}
                        onChange={(e) => {
                          handleItemChange(item.id, 'product', e.target.value);
                          // Sincronizar category también si corresponde
                          const matchCat = findInCatalog(item.name);
                          if (!matchCat) handleItemChange(item.id, 'category', e.target.value);
                        }}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-pink-400 font-medium focus:outline-none focus:border-pink-500 max-w-[130px]"
                      >
                        {PRODUCT_OPTIONS.map(opt => (
                          <option key={opt} value={opt} className="bg-slate-900 text-white">{opt}</option>
                        ))}
                        {!PRODUCT_OPTIONS.includes(item.product) && item.product && (
                          <option value={item.product} className="bg-slate-900 text-white">{item.product}</option>
                        )}
                      </select>
                    </td>

                    {/* Trafiker */}
                    <td className="py-2 px-3 font-sans">
                      <select
                        value={item.trafiker || 'Oscar'}
                        onChange={(e) => handleItemChange(item.id, 'trafiker', e.target.value)}
                        className={`border rounded-lg px-2 py-1 text-[11px] font-semibold focus:outline-none ${
                          item.trafiker === 'Oscar'
                            ? 'bg-sky-950/60 border-sky-700/50 text-sky-300 focus:border-sky-500'
                            : 'bg-emerald-950/60 border-emerald-700/50 text-emerald-300 focus:border-emerald-500'
                        }`}
                      >
                        {TRAFIKER_OPTIONS.map(t => (
                          <option key={t} value={t} className="bg-slate-900 text-white">{t}</option>
                        ))}
                      </select>
                    </td>

                    {/* Coordinador */}
                    <td className="py-2 px-3 font-sans">
                      <select
                        value={item.coordinator || 'GOMEZ'}
                        onChange={(e) => handleItemChange(item.id, 'coordinator', e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-amber-300 font-medium focus:outline-none focus:border-amber-500"
                      >
                        {COORDINATOR_OPTIONS.map(c => (
                          <option key={c} value={c} className="bg-slate-900 text-white">{c}</option>
                        ))}
                      </select>
                    </td>

                    {/* Presupuesto */}
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.currentBudget}
                        onChange={(e) => handleItemChange(item.id, 'currentBudget', parseFloat(e.target.value) || 0)}
                        className="bg-slate-950/40 border border-slate-800 rounded px-2 py-1 text-right text-xs text-emerald-400 font-mono w-24 focus:outline-none focus:border-emerald-500"
                      />
                    </td>

                    {/* Costo x Mensaje */}
                    <td className="py-2 px-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.costPerMessage}
                          onChange={(e) => handleItemChange(item.id, 'costPerMessage', parseFloat(e.target.value) || 0)}
                          className="bg-slate-950/40 border border-slate-800 rounded px-2 py-1 text-right text-xs text-sky-400 font-mono w-20 focus:outline-none focus:border-sky-500"
                        />
                        <div className="w-20 bg-slate-800/80 h-1 rounded-full overflow-hidden" title={`CPR: $${item.costPerMessage || 0} (Promedio: $${Math.round(portfolioAvgCost)})`}>
                          <div
                            className={`h-full rounded-full ${Number(item.costPerMessage) === 0 ? 'bg-slate-600' : Number(item.costPerMessage) <= portfolioAvgCost ? 'bg-emerald-400' : Number(item.costPerMessage) > portfolioAvgCost * 1.3 ? 'bg-rose-500' : 'bg-sky-400'}`}
                            style={{ width: `${Number(item.costPerMessage) === 0 ? 0 : Math.min(100, Math.max(10, (Number(item.costPerMessage) / ((portfolioAvgCost || 1000) * 1.8)) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Efectividad */}
                    <td className="py-2 px-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={item.effectiveness}
                            onChange={(e) => handleItemChange(item.id, 'effectiveness', parseFloat(e.target.value) || 0)}
                            className={`bg-slate-950/40 border rounded px-2 py-1 text-right text-xs font-mono w-16 focus:outline-none ${
                              isLowEff 
                                ? 'border-amber-800/80 text-amber-400 focus:border-amber-500' 
                                : 'border-slate-800 text-purple-400 focus:border-purple-500'
                            }`}
                          />
                          <span className="text-slate-500">%</span>
                        </div>
                        <div className="w-16 bg-slate-800/80 h-1 rounded-full overflow-hidden" title={`Efectividad: ${item.effectiveness}% (Umbral: ${minEffectivenessThreshold}%)`}>
                          <div
                            className={`h-full rounded-full ${isLowEff ? 'bg-amber-400' : 'bg-purple-400'}`}
                            style={{ width: `${Math.min(100, Math.max(10, (Number(item.effectiveness) / 30) * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Mensajes */}
                    <td className="py-2 px-3 text-right text-slate-400 font-mono">
                      {item.currentMessages?.toLocaleString()}
                    </td>

                    {/* Diagnóstico */}
                    <td className="py-2 px-3 text-center font-sans">
                      {isCheapAndLowEff ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20" title="Costo bajo pero efectividad deficiente: Alerta de trampa publicitaria">
                          <AlertCircle className="w-3 h-3" /> Trampa Bajo Costo
                        </span>
                      ) : isLowEff ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Baja Efect. (&lt;{minEffectivenessThreshold}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Óptima
                        </span>
                      )}
                    </td>

                    {/* Acción */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition"
                        title="Eliminar fila"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <Edit2 className="w-3 h-3" />
        Puedes editar directamente el Producto, Trafiker, Coordinador, Presupuesto, Costo y Efectividad de cualquier tienda.
      </p>
    </div>
  );
}
