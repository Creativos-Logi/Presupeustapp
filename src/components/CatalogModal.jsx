import React, { useState } from 'react';
import { X, Database, Search, Layers, User, Briefcase, Tag, RefreshCw } from 'lucide-react';
import { STORE_CATALOG, getCatalogCategories, getCatalogProducts, getCatalogCoordinators, getCatalogTrafikers } from '../data/storeCatalog';

export default function CatalogModal({ isOpen, onClose, onLoadStores }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedTrafiker, setSelectedTrafiker] = useState('ALL');
  const [selectedCoordinator, setSelectedCoordinator] = useState('ALL');

  if (!isOpen) return null;

  const products = getCatalogProducts();
  const coordinators = getCatalogCoordinators();
  const trafikers = getCatalogTrafikers();

  const filtered = STORE_CATALOG.filter(it => {
    const matchesProduct = selectedProduct === 'ALL' || it.product === selectedProduct;
    const matchesTrafiker = selectedTrafiker === 'ALL' || it.trafiker === selectedTrafiker;
    const matchesCoordinator = selectedCoordinator === 'ALL' || it.coordinator === selectedCoordinator;
    
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm ||
      it.name.toLowerCase().includes(searchLower) ||
      (it.coordinator && it.coordinator.toLowerCase().includes(searchLower)) ||
      (it.trafiker && it.trafiker.toLowerCase().includes(searchLower)) ||
      (it.product && it.product.toLowerCase().includes(searchLower)) ||
      (it.group && it.group.toLowerCase().includes(searchLower)) ||
      (it.campaign && it.campaign.toLowerCase().includes(searchLower));

    return matchesProduct && matchesTrafiker && matchesCoordinator && matchesSearch;
  });

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedProduct('ALL');
    setSelectedTrafiker('ALL');
    setSelectedCoordinator('ALL');
  };

  const handleLoadSelected = () => {
    const storesToLoad = filtered.map((it, idx) => ({
      id: `store-${idx + 1}-${Date.now()}`,
      name: it.name,
      category: it.category,
      product: it.product,
      coordinator: it.coordinator,
      trafiker: it.trafiker,
      group: it.group,
      campaign: it.campaign,
      currentBudget: 150000,
      costPerMessage: 800,
      effectiveness: 8.5,
      currentMessages: 187
    }));

    onLoadStores(storesToLoad);
    onClose();
  };

  const hasFilters = selectedProduct !== 'ALL' || selectedTrafiker !== 'ALL' || selectedCoordinator !== 'ALL' || searchTerm.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Directorio y Catálogo Maestro de Tiendas</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {STORE_CATALOG.length} tiendas oficiales
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Mapeo de tiendas con Producto, Trafiker (Oscar/Julio), Coordinador y Grupo
            </p>
          </div>
        </div>

        {/* Barra de Filtros: Producto, Trafiker, Coordinador, Buscador */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 mb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Buscador */}
          <div className="relative">
            <label className="block text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-slate-500" />
              <span>Buscar</span>
            </label>
            <input
              type="text"
              placeholder="Tienda, campaña, grupo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
            />
          </div>

          {/* Filtro Producto */}
          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Tag className="w-3 h-3 text-pink-400" />
              <span>Producto</span>
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-pink-500"
            >
              <option value="ALL">Todos ({products.length})</option>
              {products.map(prod => (
                <option key={prod} value={prod}>{prod}</option>
              ))}
            </select>
          </div>

          {/* Filtro Trafiker */}
          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-sky-400" />
              <span>Trafiker</span>
            </label>
            <select
              value={selectedTrafiker}
              onChange={(e) => setSelectedTrafiker(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Todos los Trafikers</option>
              {trafikers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Filtro Coordinador */}
          <div>
            <label className="block text-[10px] font-medium text-slate-400 mb-1 flex items-center gap-1">
              <Briefcase className="w-3 h-3 text-amber-400" />
              <span>Coordinador</span>
            </label>
            <select
              value={selectedCoordinator}
              onChange={(e) => setSelectedCoordinator(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="ALL">Todos los Coordinadores</option>
              {coordinators.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Fila de Acciones y Contadores */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Coincidencias: <strong className="text-emerald-400 font-mono">{filtered.length}</strong> de {STORE_CATALOG.length} tiendas
            </span>
            {hasFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-rose-400 transition"
              >
                <RefreshCw className="w-3 h-3" />
                Limpiar filtros
              </button>
            )}
          </div>

          <button
            onClick={handleLoadSelected}
            disabled={filtered.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-medium text-xs transition flex items-center gap-1.5 shadow-md shadow-pink-900/30"
          >
            <Layers className="w-3.5 h-3.5" />
            Cargar {filtered.length} {filtered.length === 1 ? 'tienda' : 'tiendas'} al Optimizador
          </button>
        </div>

        {/* Lista de tiendas en tabla */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Tienda / Línea</th>
                <th className="py-2.5 px-3">Producto</th>
                <th className="py-2.5 px-3">Trafiker</th>
                <th className="py-2.5 px-3">Coordinador</th>
                <th className="py-2.5 px-3">Grupo</th>
                <th className="py-2.5 px-3">Campaña Oficial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-3 font-sans font-medium text-white">{item.name}</td>
                  <td className="py-2 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-pink-500/10 text-pink-300 border border-pink-500/20 font-sans">
                      {item.product}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                      item.trafiker === 'Oscar'
                        ? 'bg-sky-500/10 text-sky-300 border-sky-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    }`}>
                      <User className="w-2.5 h-2.5" /> {item.trafiker}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-sans">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      <Briefcase className="w-2.5 h-2.5" /> {item.coordinator}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400 font-sans">{item.group}</td>
                  <td className="py-2 px-3 text-slate-400 font-sans">{item.campaign}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
