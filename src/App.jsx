import React, { useState, useMemo, useEffect } from 'react';
import Header from './components/Header';
import CsvUploader from './components/CsvUploader';
import ProjectionControls from './components/ProjectionControls';
import CategoryBudgetManager from './components/CategoryBudgetManager';
import FilterBar from './components/FilterBar';
import KpiSummaryCards from './components/KpiSummaryCards';
import DataGrid from './components/DataGrid';
import ChartsView from './components/ChartsView';
import ResultsTable from './components/ResultsTable';
import HelpModal from './components/HelpModal';
import CatalogModal from './components/CatalogModal';
import { optimizeBudget, planTwoPhaseRedistribution } from './utils/optimizer';
import { SAMPLE_DATASETS } from './utils/ocrParser';
import { enrichItemWithCatalog, getInitialCatalogPortfolio } from './data/storeCatalog';

export default function App() {
  // Estado principal de tiendas / líneas (79 tiendas oficiales precargadas con CPR=0 y Budget=0)
  const [items, setItems] = useState(() => getInitialCatalogPortfolio());
  
  // Parámetros de simulación y proyección
  const [targetBudget, setTargetBudget] = useState(null);
  const [pctDelta, setPctDelta] = useState(0);
  const [minEffectivenessThreshold, setMinEffectivenessThreshold] = useState(8.0); // % corte
  const [maxVariationPct, setMaxVariationPct] = useState(50); // +/- 50%
  const [alpha, setAlpha] = useState(1.3); // Exponente efectividad
  const [beta, setBeta] = useState(1.0); // Factor de sensibilidad al costo x mensaje (CPR)
  const [roundingStep, setRoundingStep] = useState(1000); // Redondeo por defecto a miles enteros ($1,000 COP)

  // Bloqueo manual de presupuesto por tienda { [id]: number }
  const [manualOverrides, setManualOverrides] = useState({});

  // Planificador de Re-escalada (Finde ➔ Lunes)
  const [isReboundMode, setIsReboundMode] = useState(false);
  const [reboundReductionPct, setReboundReductionPct] = useState(30); // -30% finde
  const [reboundMondayBudget, setReboundMondayBudget] = useState(null); // Retorno a lunes

  // Control de categorías
  const [isCategoryMode, setIsCategoryMode] = useState(true);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  
  // Filtros dinámicos: Producto, Trafiker, Coordinador, Buscador
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedTrafiker, setSelectedTrafiker] = useState('ALL');
  const [selectedCoordinator, setSelectedCoordinator] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // UI estados auxiliares
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Listas de opciones únicas extraídas de los ítems actuales
  const availableProducts = useMemo(() => {
    return Array.from(new Set(items.map(it => it.product || it.category || 'CAMISETAS'))).filter(Boolean).sort();
  }, [items]);

  const availableCoordinators = useMemo(() => {
    return Array.from(new Set(items.map(it => it.coordinator || 'GOMEZ'))).filter(Boolean).sort();
  }, [items]);

  const availableTrafikers = useMemo(() => {
    return Array.from(new Set(items.map(it => it.trafiker || 'Oscar'))).filter(Boolean).sort();
  }, [items]);

  // Indicador de si hay algún filtro activo
  const isFilterActive = useMemo(() => {
    return selectedProduct !== 'ALL' || selectedTrafiker !== 'ALL' || selectedCoordinator !== 'ALL' || searchTerm.trim().length > 0;
  }, [selectedProduct, selectedTrafiker, selectedCoordinator, searchTerm]);

  // Predicado de filtrado dinámico
  const filterPredicate = useMemo(() => {
    return (item) => {
      if (selectedProduct !== 'ALL' && (item.product || item.category) !== selectedProduct) return false;
      if (selectedTrafiker !== 'ALL' && item.trafiker !== selectedTrafiker) return false;
      if (selectedCoordinator !== 'ALL' && item.coordinator !== selectedCoordinator) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const matchName = item.name.toLowerCase().includes(s);
        const matchProd = (item.product || '').toLowerCase().includes(s);
        const matchCoord = (item.coordinator || '').toLowerCase().includes(s);
        const matchTraf = (item.trafiker || '').toLowerCase().includes(s);
        if (!matchName && !matchProd && !matchCoord && !matchTraf) return false;
      }
      return true;
    };
  }, [selectedProduct, selectedTrafiker, selectedCoordinator, searchTerm]);

  // Partición de tiendas en: filtradas (en optimización) y no filtradas (intactas al 100%)
  const { filteredItems, unfilteredItems } = useMemo(() => {
    if (!isFilterActive) {
      return { filteredItems: items, unfilteredItems: [] };
    }
    const f = [];
    const u = [];
    items.forEach(it => {
      if (filterPredicate(it)) f.push(it);
      else u.push(it);
    });
    return { filteredItems: f, unfilteredItems: u };
  }, [items, isFilterActive, filterPredicate]);

  // Presupuesto actual de las tiendas en optimización
  const activeBaseBudget = useMemo(() => {
    return filteredItems.reduce((acc, it) => acc + (Number(it.currentBudget) || 0), 0);
  }, [filteredItems]);

  // Presupuesto objetivo efectivo para el grupo en optimización
  const effectiveTargetBudget = useMemo(() => {
    if (targetBudget !== null && !isNaN(targetBudget)) {
      return targetBudget;
    }
    return Math.round(activeBaseBudget * (1 + pctDelta / 100));
  }, [targetBudget, activeBaseBudget, pctDelta]);

  // Lista única de categorías presentes en las tiendas filtradas
  const categories = useMemo(() => {
    return Array.from(new Set(filteredItems.map(it => it.category || 'General')));
  }, [filteredItems]);

  // Sincronizar presupuestos por categoría iniciales
  useEffect(() => {
    if (categories.length === 0) return;
    
    const catCurrentTotals = {};
    categories.forEach(cat => {
      catCurrentTotals[cat] = filteredItems
        .filter(it => (it.category || 'General') === cat)
        .reduce((sum, it) => sum + (Number(it.currentBudget) || 0), 0);
    });

    const newCatBudgets = {};
    let allocatedSum = 0;
    categories.forEach((cat, idx) => {
      if (idx === categories.length - 1) {
        newCatBudgets[cat] = Math.max(0, effectiveTargetBudget - allocatedSum);
      } else {
        const ratio = activeBaseBudget > 0 ? (catCurrentTotals[cat] / activeBaseBudget) : (1 / categories.length);
        const amount = Math.round(effectiveTargetBudget * ratio);
        newCatBudgets[cat] = amount;
        allocatedSum += amount;
      }
    });

    setCategoryBudgets(newCatBudgets);
  }, [filteredItems, effectiveTargetBudget, categories.join(',')]);

  // Cálculo de optimización en tiempo real sobre las tiendas filtradas
  const { optimizedItems: rawOptimizedFiltered, summary: filteredSummary, categorySummaries } = useMemo(() => {
    return optimizeBudget(filteredItems, {
      targetBudget: effectiveTargetBudget,
      categoryBudgets: isCategoryMode ? categoryBudgets : null,
      minEffectivenessThreshold,
      maxVariationPct,
      alpha,
      beta,
      roundingStep,
      manualOverrides
    });
  }, [filteredItems, effectiveTargetBudget, isCategoryMode, categoryBudgets, minEffectivenessThreshold, maxVariationPct, alpha, beta, roundingStep, manualOverrides]);

  // Plan de Re-escalada en 2 fases si el modo está activo
  const reboundPlan = useMemo(() => {
    if (!isReboundMode) return null;
    return planTwoPhaseRedistribution(filteredItems, {
      baseBudget: effectiveTargetBudget,
      reductionPct: reboundReductionPct,
      reboundTargetBudget: reboundMondayBudget || effectiveTargetBudget,
      roundingStep,
      minEffectivenessThreshold,
      maxVariationPct,
      alpha,
      beta,
      categoryBudgets: isCategoryMode ? categoryBudgets : null
    });
  }, [isReboundMode, filteredItems, effectiveTargetBudget, reboundReductionPct, reboundMondayBudget, roundingStep, minEffectivenessThreshold, maxVariationPct, alpha, beta, isCategoryMode, categoryBudgets]);

  // Tiendas no filtradas: mantienen su presupuesto actual exactamente igual (0 variación)
  const untouchedItems = useMemo(() => {
    return unfilteredItems.map(it => {
      const cost = Number(it.costPerMessage) || 1;
      const budget = Number(it.currentBudget) || 0;
      const eff = Number(it.effectiveness) || 0;
      const msgs = it.currentMessages || (cost > 0 ? Math.round(budget / cost) : 0);
      const effMsgs = Math.round((msgs * eff) / 100);

      return {
        ...it,
        newBudget: budget,
        budgetDelta: 0,
        budgetDeltaPct: 0,
        projectedMessages: msgs,
        messagesDelta: 0,
        currentEffectiveMessages: effMsgs,
        projectedEffectiveMessages: effMsgs,
        effectiveDelta: 0,
        statusLabel: 'Fuera de Filtro (Intacto)',
        statusBadgeColor: 'bg-slate-800 text-slate-400 border-slate-700',
        isBelowThreshold: eff < minEffectivenessThreshold,
        irc: 1.0
      };
    });
  }, [unfilteredItems, minEffectivenessThreshold]);

  // Lista unificada completa preservando el orden original
  const allOptimizedItems = useMemo(() => {
    if (!isFilterActive) return rawOptimizedFiltered;
    const map = new Map();
    rawOptimizedFiltered.forEach(it => map.set(it.id, it));
    untouchedItems.forEach(it => map.set(it.id, it));
    return items.map(it => map.get(it.id) || it);
  }, [items, isFilterActive, rawOptimizedFiltered, untouchedItems]);

  // Resumen representativo de las tiendas en optimización
  const summary = useMemo(() => {
    return filteredSummary;
  }, [filteredSummary]);

  // Reset de target budget al cambiar cualquier filtro para que coincida con el nuevo grupo
  const handleSelectProduct = (val) => {
    setSelectedProduct(val);
    setTargetBudget(null);
    setPctDelta(0);
  };

  const handleSelectTrafiker = (val) => {
    setSelectedTrafiker(val);
    setTargetBudget(null);
    setPctDelta(0);
  };

  const handleSelectCoordinator = (val) => {
    setSelectedCoordinator(val);
    setTargetBudget(null);
    setPctDelta(0);
  };

  const handleSearchChange = (val) => {
    setSearchTerm(val);
    setTargetBudget(null);
    setPctDelta(0);
  };

  const handleResetFilters = () => {
    setSelectedProduct('ALL');
    setSelectedTrafiker('ALL');
    setSelectedCoordinator('ALL');
    setSearchTerm('');
    setTargetBudget(null);
    setPctDelta(0);
  };

  const handleDataExtracted = (extractedItems) => {
    setItems(extractedItems.map(enrichItemWithCatalog));
    setTargetBudget(null);
    setPctDelta(0);
  };

  const handleSetManualBudget = (id, amount) => {
    setManualOverrides(prev => ({
      ...prev,
      [id]: Math.max(0, Number(amount) || 0)
    }));
  };

  const handleClearManualBudget = (id) => {
    setManualOverrides(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleClearAllManualBudgets = () => {
    setManualOverrides({});
  };

  const handleReset = () => {
    setItems(getInitialCatalogPortfolio());
    setTargetBudget(null);
    setPctDelta(0);
    setManualOverrides({});
    handleResetFilters();
  };

  const handleLoadSample = (key = 'defaultCase') => {
    const dataset = (SAMPLE_DATASETS[key] || SAMPLE_DATASETS.defaultCase).map(enrichItemWithCatalog);
    setItems(dataset);
    setTargetBudget(null);
    setPctDelta(0);
  };

  const filterBadgeInfo = useMemo(() => {
    if (!isFilterActive) return { isActive: false };
    const labels = [];
    if (selectedProduct !== 'ALL') labels.push(`Producto: ${selectedProduct}`);
    if (selectedTrafiker !== 'ALL') labels.push(`Trafiker: ${selectedTrafiker}`);
    if (selectedCoordinator !== 'ALL') labels.push(`Coordinador: ${selectedCoordinator}`);
    if (searchTerm.trim()) labels.push(`"${searchTerm}"`);

    return {
      isActive: true,
      label: labels.join(' • '),
      storesCount: filteredItems.length,
      unfilteredCount: unfilteredItems.length,
      filteredBudget: activeBaseBudget
    };
  }, [isFilterActive, selectedProduct, selectedTrafiker, selectedCoordinator, searchTerm, filteredItems.length, unfilteredItems.length, activeBaseBudget]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 pb-16">
      <Header
        onReset={handleReset}
        onLoadSample={handleLoadSample}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenCatalog={() => setIsCatalogOpen(true)}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Fila 1: Filtros Dinámicos (Producto, Trafiker, Coordinador, Buscador) */}
        {items.length > 0 && (
          <FilterBar
            products={availableProducts}
            selectedProduct={selectedProduct}
            onSelectProduct={handleSelectProduct}
            coordinators={availableCoordinators}
            selectedCoordinator={selectedCoordinator}
            onSelectCoordinator={handleSelectCoordinator}
            trafikers={availableTrafikers}
            selectedTrafiker={selectedTrafiker}
            onSelectTrafiker={handleSelectTrafiker}
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            totalStoresCount={items.length}
            filteredStoresCount={filteredItems.length}
            onResetFilters={handleResetFilters}
            filteredBudget={activeBaseBudget}
          />
        )}

        {/* Fila 2: Carga de Archivo CSV / Excel + Controles de Proyección Focalizados */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <CsvUploader
              items={items}
              onDataExtracted={handleDataExtracted}
              isLoading={isLoadingFile}
              setIsLoading={setIsLoadingFile}
            />
          </div>

          <div className="lg:col-span-7">
            <ProjectionControls
              totalCurrentBudget={activeBaseBudget}
              targetBudget={effectiveTargetBudget}
              setTargetBudget={setTargetBudget}
              pctDelta={pctDelta}
              setPctDelta={setPctDelta}
              minEffectivenessThreshold={minEffectivenessThreshold}
              setMinEffectivenessThreshold={setMinEffectivenessThreshold}
              maxVariationPct={maxVariationPct}
              setMaxVariationPct={setMaxVariationPct}
              alpha={alpha}
              setAlpha={setAlpha}
              beta={beta}
              setBeta={setBeta}
              filterBadgeInfo={filterBadgeInfo}
              isReboundMode={isReboundMode}
              setIsReboundMode={setIsReboundMode}
              reboundReductionPct={reboundReductionPct}
              setReboundReductionPct={setReboundReductionPct}
              reboundMondayBudget={reboundMondayBudget}
              setReboundMondayBudget={setReboundMondayBudget}
              roundingStep={roundingStep}
              setRoundingStep={setRoundingStep}
            />
          </div>
        </div>

        {/* Fila 3: Gestión y Segmentación de Presupuesto por Categorías */}
        {categories.length > 0 && !isReboundMode && (
          <CategoryBudgetManager
            categories={categories}
            categoryBudgets={categoryBudgets}
            setCategoryBudgets={setCategoryBudgets}
            totalTargetBudget={effectiveTargetBudget}
            isCategoryMode={isCategoryMode}
            setIsCategoryMode={setIsCategoryMode}
            categorySummaries={categorySummaries}
          />
        )}

        {/* Fila 4: Tarjetas de KPI Comparativo (Antes vs Proyectado para el Grupo en Optimización) */}
        {!isReboundMode && <KpiSummaryCards summary={summary} />}

        {/* Fila 5: Tabla Editable de Datos Detectados */}
        <DataGrid
          items={items}
          setItems={setItems}
          displayItems={filteredItems}
          minEffectivenessThreshold={minEffectivenessThreshold}
          portfolioAvgCost={summary?.newBlendedCPM || 800}
          manualOverrides={manualOverrides}
          onSetManualBudget={handleSetManualBudget}
          onClearManualBudget={handleClearManualBudget}
        />

        {/* Fila 6: Gráficos de Barras y Cuadrante de Rendimiento */}
        {filteredItems.length > 0 && (
          <ChartsView
            optimizedItems={rawOptimizedFiltered}
            displayItems={rawOptimizedFiltered}
            minEffectivenessThreshold={minEffectivenessThreshold}
            isReboundMode={isReboundMode}
            reboundPlan={reboundPlan}
          />
        )}

        {/* Fila 7: Tabla de Resultados y Recomendaciones con Exportación */}
        {items.length > 0 && (
          <ResultsTable
            optimizedItems={rawOptimizedFiltered}
            displayItems={rawOptimizedFiltered}
            allOptimizedItems={allOptimizedItems}
            summary={summary}
            isFilterActive={isFilterActive}
            filterLabel={filterBadgeInfo.label}
            isReboundMode={isReboundMode}
            reboundPlan={reboundPlan}
            manualOverrides={manualOverrides}
            onSetManualBudget={handleSetManualBudget}
            onClearManualBudget={handleClearManualBudget}
            onClearAllManualBudgets={handleClearAllManualBudgets}
          />
        )}
      </main>

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <CatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onLoadStores={(stores) => {
          setItems(stores.map(enrichItemWithCatalog));
          setTargetBudget(null);
          setPctDelta(0);
        }}
      />
    </div>
  );
}
