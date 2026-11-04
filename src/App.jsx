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
  const [maxVariationPct, setMaxVariationPct] = useState(35); // +/- 35% guardrail estricto
  const [alpha, setAlpha] = useState(1.3); // Exponente efectividad
  const [beta, setBeta] = useState(1.0); // Factor de sensibilidad al costo x mensaje (CPR)
  const [roundingStep, setRoundingStep] = useState(5000); // Redondeo comercial a múltiplos de $5,000 COP

  // Bloqueo manual de presupuesto por tienda { [id]: number }
  const [manualOverrides, setManualOverrides] = useState({}); // Lunes / General
  const [weekendManualOverrides, setWeekendManualOverrides] = useState({}); // Fin de Semana

  // Planificador de Re-escalada (Finde ➔ Lunes)
  const [isReboundMode, setIsReboundMode] = useState(false);
  const [reboundReductionPct, setReboundReductionPct] = useState(30); // -30% finde
  const [reboundMondayBudget, setReboundMondayBudget] = useState(null); // Retorno a lunes

  // Control de categorías
  const [isCategoryMode, setIsCategoryMode] = useState(true);
  const [categoryBudgets, setCategoryBudgets] = useState({});
  const [lockedCategoryBudgets, setLockedCategoryBudgets] = useState({});
  
  // Filtros dinámicos: Producto, Trafiker, Coordinador, Buscador
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedTrafiker, setSelectedTrafiker] = useState('ALL');
  const [selectedCoordinator, setSelectedCoordinator] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // UI estados auxiliares
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  // Listas de opciones dinámicas en cascada cruzada (Faceted Filtering)
  const availableProducts = useMemo(() => {
    const subset = items.filter(it => {
      if (selectedCoordinator !== 'ALL' && it.coordinator !== selectedCoordinator) return false;
      if (selectedTrafiker !== 'ALL' && it.trafiker !== selectedTrafiker) return false;
      return true;
    });
    return Array.from(new Set(subset.map(it => it.product || it.category || 'CAMISETAS'))).filter(Boolean).sort();
  }, [items, selectedCoordinator, selectedTrafiker]);

  const availableCoordinators = useMemo(() => {
    const subset = items.filter(it => {
      if (selectedProduct !== 'ALL' && (it.product || it.category) !== selectedProduct) return false;
      if (selectedTrafiker !== 'ALL' && it.trafiker !== selectedTrafiker) return false;
      return true;
    });
    return Array.from(new Set(subset.map(it => it.coordinator || 'GOMEZ'))).filter(Boolean).sort();
  }, [items, selectedProduct, selectedTrafiker]);

  const availableTrafikers = useMemo(() => {
    const subset = items.filter(it => {
      if (selectedProduct !== 'ALL' && (it.product || it.category) !== selectedProduct) return false;
      if (selectedCoordinator !== 'ALL' && it.coordinator !== selectedCoordinator) return false;
      return true;
    });
    return Array.from(new Set(subset.map(it => it.trafiker || 'Oscar'))).filter(Boolean).sort();
  }, [items, selectedProduct, selectedCoordinator]);

  // Conteo de tiendas por opción bajo los filtros complementarios activos
  const productCounts = useMemo(() => {
    const counts = {};
    const subset = items.filter(it => {
      if (selectedCoordinator !== 'ALL' && it.coordinator !== selectedCoordinator) return false;
      if (selectedTrafiker !== 'ALL' && it.trafiker !== selectedTrafiker) return false;
      return true;
    });
    subset.forEach(it => {
      const p = it.product || it.category || 'CAMISETAS';
      counts[p] = (counts[p] || 0) + 1;
    });
    return counts;
  }, [items, selectedCoordinator, selectedTrafiker]);

  const coordinatorCounts = useMemo(() => {
    const counts = {};
    const subset = items.filter(it => {
      if (selectedProduct !== 'ALL' && (it.product || it.category) !== selectedProduct) return false;
      if (selectedTrafiker !== 'ALL' && it.trafiker !== selectedTrafiker) return false;
      return true;
    });
    subset.forEach(it => {
      const c = it.coordinator || 'GOMEZ';
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [items, selectedProduct, selectedTrafiker]);

  const trafikerCounts = useMemo(() => {
    const counts = {};
    const subset = items.filter(it => {
      if (selectedProduct !== 'ALL' && (it.product || it.category) !== selectedProduct) return false;
      if (selectedCoordinator !== 'ALL' && it.coordinator !== selectedCoordinator) return false;
      return true;
    });
    subset.forEach(it => {
      const t = it.trafiker || 'Oscar';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [items, selectedProduct, selectedCoordinator]);

  // Auto-limpieza / Reconciliación: si un filtro cruzado deja fuera la opción seleccionada, resetearla a 'ALL'
  useEffect(() => {
    if (selectedProduct !== 'ALL' && availableProducts.length > 0 && !availableProducts.includes(selectedProduct)) {
      setSelectedProduct('ALL');
    }
  }, [availableProducts, selectedProduct]);

  useEffect(() => {
    if (selectedCoordinator !== 'ALL' && availableCoordinators.length > 0 && !availableCoordinators.includes(selectedCoordinator)) {
      setSelectedCoordinator('ALL');
    }
  }, [availableCoordinators, selectedCoordinator]);

  useEffect(() => {
    if (selectedTrafiker !== 'ALL' && availableTrafikers.length > 0 && !availableTrafikers.includes(selectedTrafiker)) {
      setSelectedTrafiker('ALL');
    }
  }, [availableTrafikers, selectedTrafiker]);

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

  // Sincronizar presupuestos por categoría respetando bloqueos manuales (candados)
  useEffect(() => {
    if (categories.length === 0) return;
    
    const catCurrentTotals = {};
    const catStoreCounts = {};
    categories.forEach(cat => {
      const itemsInCat = filteredItems.filter(it => (it.category || 'General') === cat);
      catCurrentTotals[cat] = itemsInCat.reduce((sum, it) => sum + (Number(it.currentBudget) || 0), 0);
      catStoreCounts[cat] = itemsInCat.length;
    });

    // 1. Identificar categorías con presupuesto bloqueado manualmente
    const validLocked = {};
    let totalLockedAmount = 0;

    categories.forEach(cat => {
      if (lockedCategoryBudgets && lockedCategoryBudgets[cat] !== undefined) {
        const raw = Math.max(0, Number(lockedCategoryBudgets[cat]) || 0);
        // Redondeo en múltiplos limpios de roundingStep ($5,000 COP)
        const step = roundingStep > 0 ? roundingStep : 1000;
        const rounded = Math.floor(raw / step) * step;
        validLocked[cat] = rounded;
        totalLockedAmount += rounded;
      }
    });

    const unlockedCategories = categories.filter(cat => validLocked[cat] === undefined);
    const newCatBudgets = { ...validLocked };

    // Si todas las categorías están bloqueadas
    if (unlockedCategories.length === 0) {
      setCategoryBudgets(newCatBudgets);
      return;
    }

    // Saldo libre para repartir entre categorías no bloqueadas
    const freeBudget = Math.max(0, effectiveTargetBudget - totalLockedAmount);

    // Suma de bases de las desbloqueadas
    const unlockedCurrentSum = unlockedCategories.reduce((sum, cat) => sum + catCurrentTotals[cat], 0);

    // Pesos para las desbloqueadas
    const weights = unlockedCategories.map(cat => {
      if (unlockedCurrentSum > 0) {
        return catCurrentTotals[cat] / unlockedCurrentSum;
      }
      return (catStoreCounts[cat] || 1);
    });
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

    const step = roundingStep > 0 ? roundingStep : 1000;
    // Asignación floor en múltiplos de roundingStep
    let unlockedAllocations = unlockedCategories.map((_, i) => {
      const rawAlloc = (weights[i] / totalWeight) * freeBudget;
      return Math.floor(rawAlloc / step) * step;
    });

    // Repartir residuo en pasos de roundingStep a las categorías de mayor peso
    let assignedUnlockedSum = unlockedAllocations.reduce((sum, val) => sum + val, 0);
    let remainder = freeBudget - assignedUnlockedSum;

    const sortedIndices = unlockedCategories
      .map((cat, idx) => ({ idx, weight: weights[idx] }))
      .sort((a, b) => b.weight - a.weight);

    let loop = 0;
    while (remainder >= step && loop < sortedIndices.length * 10) {
      const targetIdx = sortedIndices[loop % sortedIndices.length].idx;
      unlockedAllocations[targetIdx] += step;
      remainder -= step;
      loop++;
    }

    unlockedCategories.forEach((cat, idx) => {
      newCatBudgets[cat] = unlockedAllocations[idx];
    });

    setCategoryBudgets(newCatBudgets);
  }, [filteredItems, effectiveTargetBudget, categories.join(','), lockedCategoryBudgets, roundingStep]);

  // Cálculo de optimización en tiempo real sobre las tiendas filtradas
  const { optimizedItems: rawOptimizedFiltered, summary: filteredSummary, categorySummaries } = useMemo(() => {
    return optimizeBudget(filteredItems, {
      targetBudget: effectiveTargetBudget,
      categoryBudgets: isCategoryMode ? categoryBudgets : null,
      lockedCategoryBudgets: isCategoryMode ? lockedCategoryBudgets : {},
      minEffectivenessThreshold,
      maxVariationPct,
      alpha,
      beta,
      roundingStep,
      manualOverrides
    });
  }, [filteredItems, effectiveTargetBudget, isCategoryMode, categoryBudgets, lockedCategoryBudgets, minEffectivenessThreshold, maxVariationPct, alpha, beta, roundingStep, manualOverrides]);

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
      categoryBudgets: isCategoryMode ? categoryBudgets : null,
      lockedCategoryBudgets: isCategoryMode ? lockedCategoryBudgets : {},
      manualOverrides,
      weekendManualOverrides
    });
  }, [isReboundMode, filteredItems, effectiveTargetBudget, reboundReductionPct, reboundMondayBudget, roundingStep, minEffectivenessThreshold, maxVariationPct, alpha, beta, isCategoryMode, categoryBudgets, lockedCategoryBudgets, manualOverrides, weekendManualOverrides]);

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
    setManualOverrides({});
    setWeekendManualOverrides({});
    setLockedCategoryBudgets({});
  };

  // Calibrar el portafolio actual con los presupuestos diarios reales de Meta Ads
  const handleApplyDailyBudgets = () => {
    setItems(prev => prev.map(item => {
      const match = findInCatalog(item.name) || (item.phone ? findInCatalog(item.phone) : null);
      const daily = (item.dailyBudget > 0) ? item.dailyBudget : (match?.dailyBudget > 0 ? match.dailyBudget : item.currentBudget);
      const cost = Number(item.costPerMessage) || 0;
      return {
        ...item,
        currentBudget: daily,
        dailyBudget: daily,
        currentMessages: cost > 0 ? Math.round(daily / cost) : item.currentMessages
      };
    }));
    setTargetBudget(null);
    setPctDelta(0);
  };

  // Handlers para bloqueo de presupuestos por tienda individual (Lunes)
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

  // Handlers para bloqueo de presupuestos de Fin de Semana por tienda individual
  const handleSetWeekendManualBudget = (id, amount) => {
    setWeekendManualOverrides(prev => ({
      ...prev,
      [id]: Math.max(0, Number(amount) || 0)
    }));
  };

  const handleClearWeekendManualBudget = (id) => {
    setWeekendManualOverrides(prev => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  };

  const handleClearAllWeekendManualBudgets = () => {
    setWeekendManualOverrides({});
  };

  // Handlers para bloqueo de presupuestos por categoría
  const handleSetCategoryBudget = (cat, amount) => {
    const step = roundingStep > 0 ? roundingStep : 5000;
    const cleanAmount = Math.max(0, Math.floor((Number(amount) || 0) / step) * step);
    setLockedCategoryBudgets(prev => ({ ...prev, [cat]: cleanAmount }));
  };

  const handleClearCategoryLock = (cat) => {
    setLockedCategoryBudgets(prev => {
      const copy = { ...prev };
      delete copy[cat];
      return copy;
    });
  };

  const handleClearAllCategoryLocks = () => {
    setLockedCategoryBudgets({});
  };

  const handleReset = () => {
    setItems(getInitialCatalogPortfolio());
    setTargetBudget(null);
    setPctDelta(0);
    setManualOverrides({});
    setWeekendManualOverrides({});
    setLockedCategoryBudgets({});
    handleResetFilters();
  };

  const handleLoadSample = (key = 'defaultCase') => {
    const dataset = (SAMPLE_DATASETS[key] || SAMPLE_DATASETS.defaultCase).map(enrichItemWithCatalog);
    setItems(dataset);
    setTargetBudget(null);
    setPctDelta(0);
    setManualOverrides({});
    setWeekendManualOverrides({});
    setLockedCategoryBudgets({});
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
        onApplyDailyBudgets={handleApplyDailyBudgets}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* Fila 1: Filtros Dinámicos (Producto, Trafiker, Coordinador, Buscador) */}
        {items.length > 0 && (
          <FilterBar
            products={availableProducts}
            productCounts={productCounts}
            selectedProduct={selectedProduct}
            onSelectProduct={handleSelectProduct}
            coordinators={availableCoordinators}
            coordinatorCounts={coordinatorCounts}
            selectedCoordinator={selectedCoordinator}
            onSelectCoordinator={handleSelectCoordinator}
            trafikers={availableTrafikers}
            trafikerCounts={trafikerCounts}
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
              onApplyDailyBudgets={handleApplyDailyBudgets}
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
        {categories.length > 0 && (
          <CategoryBudgetManager
            categories={categories}
            categoryBudgets={categoryBudgets}
            setCategoryBudgets={setCategoryBudgets}
            totalTargetBudget={effectiveTargetBudget}
            isCategoryMode={isCategoryMode}
            setIsCategoryMode={setIsCategoryMode}
            categorySummaries={categorySummaries}
            lockedCategoryBudgets={lockedCategoryBudgets}
            onSetCategoryBudget={handleSetCategoryBudget}
            onClearCategoryLock={handleClearCategoryLock}
            onClearAllCategoryLocks={handleClearAllCategoryLocks}
            isReboundMode={isReboundMode}
            reboundReductionPct={reboundReductionPct}
            reboundPlan={reboundPlan}
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
            weekendManualOverrides={weekendManualOverrides}
            onSetWeekendManualBudget={handleSetWeekendManualBudget}
            onClearWeekendManualBudget={handleClearWeekendManualBudget}
            onClearAllWeekendManualBudgets={handleClearAllWeekendManualBudgets}
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
          setManualOverrides({});
          setWeekendManualOverrides({});
          setLockedCategoryBudgets({});
        }}
      />
    </div>
  );
}
