import React from 'react';
import { Search, Filter, X, Tag, User, Briefcase, Sparkles, Check, SlidersHorizontal } from 'lucide-react';

export default function FilterBar({
  products = [],
  selectedProduct = 'ALL',
  onSelectProduct,
  coordinators = [],
  selectedCoordinator = 'ALL',
  onSelectCoordinator,
  trafikers = [],
  selectedTrafiker = 'ALL',
  onSelectTrafiker,
  searchTerm = '',
  onSearchChange,
  totalStoresCount = 0,
  filteredStoresCount = 0,
  onResetFilters,
  filterSimulationMode = false,
  setFilterSimulationMode,
  filteredBudget = 0
}) {
  const hasActiveFilters = selectedProduct !== 'ALL' || selectedCoordinator !== 'ALL' || selectedTrafiker !== 'ALL' || searchTerm.trim().length > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3">
      {/* Encabezado del panel de filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Filtros Dinámicos por Producto, Trafiker y Coordinador</span>
              {hasActiveFilters && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 animate-pulse">
                  Filtro Activo
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Filtra tiendas y resultados al instante o segmenta la optimización presupuestaria
            </p>
          </div>
        </div>

        {/* Contador de tiendas y presupuesto del filtro */}
        <div className="flex items-center gap-2">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
            <span className="text-slate-400">Mostrando: </span>
            <strong className="text-emerald-400 font-mono">{filteredStoresCount}</strong>
            <span className="text-slate-500"> / {totalStoresCount} tiendas</span>
            {filteredBudget > 0 && (
              <span className="text-slate-500 ml-1.5 border-l border-slate-800 pl-2">
                Presupuesto: <strong className="text-pink-400 font-mono">${filteredBudget.toLocaleString()}</strong>
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={onResetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Restablecer todos los filtros"
            >
              <X className="w-3.5 h-3.5 text-rose-400" />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Selectores principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Buscador por nombre */}
        <div className="relative">
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <Search className="w-3 h-3 text-slate-500" />
            <span>Buscar Tienda</span>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Ej. DISTRI PRO, NOVA..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-pink-500 transition"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Filtro por Producto */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <Tag className="w-3 h-3 text-pink-400" />
            <span>Producto / Línea</span>
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => onSelectProduct(e.target.value)}
            className={`w-full bg-slate-950 border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-pink-500 transition ${
              selectedProduct !== 'ALL'
                ? 'border-pink-500 text-pink-300 font-semibold'
                : 'border-slate-800 text-slate-200'
            }`}
          >
            <option value="ALL">Todos los Productos ({products.length})</option>
            {products.map(prod => (
              <option key={prod} value={prod}>
                {prod}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Filtro por Trafiker */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <User className="w-3 h-3 text-sky-400" />
            <span>Trafiker</span>
          </label>
          <div className="flex bg-slate-950 rounded-xl p-0.5 border border-slate-800">
            <button
              onClick={() => onSelectTrafiker('ALL')}
              className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                selectedTrafiker === 'ALL'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todos
            </button>
            {trafikers.map(traf => (
              <button
                key={traf}
                onClick={() => onSelectTrafiker(traf)}
                className={`flex-1 py-1 text-xs font-medium rounded-lg transition ${
                  selectedTrafiker === traf
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {traf}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Filtro por Coordinador */}
        <div>
          <label className="block text-[11px] font-medium text-slate-400 mb-1 flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-amber-400" />
            <span>Coordinador</span>
          </label>
          <select
            value={selectedCoordinator}
            onChange={(e) => onSelectCoordinator(e.target.value)}
            className={`w-full bg-slate-950 border rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-amber-500 transition ${
              selectedCoordinator !== 'ALL'
                ? 'border-amber-500 text-amber-300 font-semibold'
                : 'border-slate-800 text-slate-200'
            }`}
          >
            <option value="ALL">Todos los Coordinadores ({coordinators.length})</option>
            {coordinators.map(coord => (
              <option key={coord} value={coord}>
                {coord}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Estado de Aislamiento de Presupuesto */}
      <div className="mt-1 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        {hasActiveFilters ? (
          <div className="flex items-center gap-2 text-pink-300 bg-pink-950/40 px-3 py-1.5 rounded-xl border border-pink-800/40 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>
              <strong>Distribución Aislada Activa:</strong> El presupuesto objetivo se redistribuye <u>únicamente</u> entre las <strong>{filteredStoresCount} tiendas filtradas</strong>. Las {totalStoresCount - filteredStoresCount} tiendas no seleccionadas quedan 100% blindadas y conservan su presupuesto actual sin alteraciones.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <span>
              Optimizando las {totalStoresCount} tiendas de la cartera completa. Selecciona un <strong>Producto</strong>, <strong>Trafiker</strong> o <strong>Coordinador</strong> arriba para aislar y redistribuir el presupuesto sólo en ese grupo sin afectar al resto.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
