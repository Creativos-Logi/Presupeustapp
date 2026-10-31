import { optimizeBudget, planTwoPhaseRedistribution } from '../src/utils/optimizer.js';
import { mergeExtractedMetrics } from '../src/utils/dataMerger.js';

function runTests() {
  console.log('🧪 Iniciando pruebas del algoritmo de optimización...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // Conjunto de prueba
  const testItems = [
    { id: '1', name: 'Tienda A (Calidad)', currentBudget: 1000, costPerMessage: 2.0, effectiveness: 25.0 }, // IRC alto
    { id: '2', name: 'Tienda B (Trampa)', currentBudget: 1000, costPerMessage: 0.8, effectiveness: 3.0 },  // Bajo costo pero baja efectividad
    { id: '3', name: 'Tienda C (Media)', currentBudget: 1000, costPerMessage: 1.5, effectiveness: 14.0 },  // Intermedia
  ];

  // Test 1: La tienda trampa con baja efectividad (<8%) NO debe recibir inyección de presupuesto
  {
    const result = optimizeBudget(testItems, {
      minEffectivenessThreshold: 8.0,
      targetBudgetPctDelta: 0
    });

    const storeB = result.optimizedItems.find(it => it.id === '2');
    const storeA = result.optimizedItems.find(it => it.id === '1');

    assert(storeB.isBelowThreshold === true, 'Tienda B es identificada por debajo del umbral de efectividad');
    assert(storeB.newBudget <= storeB.currentBudget, `Tienda B no recibe más presupuesto (${storeB.newBudget} <= ${storeB.currentBudget})`);
    assert(storeA.newBudget > storeA.currentBudget, `Tienda A recibe más presupuesto (${storeA.newBudget} > ${storeA.currentBudget})`);
    assert(result.summary.effectiveDeltaPct > 0, `Efectividad global aumenta (+${result.summary.effectiveDeltaPct}%)`);
  }

  // Test 2: Proyección al alza (+20%)
  {
    const totalCurrent = 3000;
    const target = 3600;
    const result = optimizeBudget(testItems, {
      targetBudget: target,
      minEffectivenessThreshold: 8.0
    });

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    const diff = Math.abs(totalAllocated - target);
    assert(diff < 1.0, `Presupuesto proyectado al alza cuadra con el objetivo ($${totalAllocated} ≈ $${target})`);

    const storeB = result.optimizedItems.find(it => it.id === '2');
    assert(storeB.newBudget <= storeB.currentBudget, `Incluso en presupuesto global +20%, Tienda B no supera su presupuesto base`);
  }

  // Test 3: Proyección a la baja (-25%)
  {
    const target = 2250;
    const result = optimizeBudget(testItems, {
      targetBudget: target,
      minEffectivenessThreshold: 8.0
    });

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    const diff = Math.abs(totalAllocated - target);
    assert(diff < 1.0, `Presupuesto proyectado a la baja cuadra con el objetivo ($${totalAllocated} ≈ $${target})`);
  }

  // Test 4: Mensajes efectivos incrementan significativamente manteniendo el mismo presupuesto
  {
    const result = optimizeBudget(testItems, {
      minEffectivenessThreshold: 8.0,
      targetBudgetPctDelta: 0
    });

    assert(result.summary.newTotalEffective > result.summary.currentTotalEffective,
      `Mensajes efectivos totales aumentan (${result.summary.newTotalEffective} > ${result.summary.currentTotalEffective}) con el mismo presupuesto`);
  }

  // Test 5: Particionamiento de Presupuesto por Categorías (ej. $5M total -> $3M Camisetas, $2M Conjuntos)
  {
    const categoryItems = [
      { id: 'c1', name: 'Camisetas Premium', category: 'Camisetas', currentBudget: 1500000, costPerMessage: 1000, effectiveness: 22.0 },
      { id: 'c2', name: 'Camisetas Baratas Trampa', category: 'Camisetas', currentBudget: 1500000, costPerMessage: 400, effectiveness: 3.0 },
      { id: 's1', name: 'Conjuntos Verano', category: 'Conjuntos', currentBudget: 1000000, costPerMessage: 1200, effectiveness: 19.0 },
      { id: 's2', name: 'Conjuntos Básico', category: 'Conjuntos', currentBudget: 1000000, costPerMessage: 1100, effectiveness: 16.0 },
    ];

    const result = optimizeBudget(categoryItems, {
      targetBudget: 5000000,
      categoryBudgets: {
        'Camisetas': 3000000,
        'Conjuntos': 2000000
      },
      minEffectivenessThreshold: 8.0
    });

    const camisetasTotal = result.optimizedItems
      .filter(it => it.category === 'Camisetas')
      .reduce((sum, it) => sum + it.newBudget, 0);

    const conjuntosTotal = result.optimizedItems
      .filter(it => it.category === 'Conjuntos')
      .reduce((sum, it) => sum + it.newBudget, 0);

    assert(Math.abs(camisetasTotal - 3000000) < 5, `Categoría Camisetas recibe exactamente $3,000,000 (actual: ${camisetasTotal})`);
    assert(Math.abs(conjuntosTotal - 2000000) < 5, `Categoría Conjuntos recibe exactamente $2,000,000 (actual: ${conjuntosTotal})`);

    const c2 = result.optimizedItems.find(it => it.id === 'c2');
    assert(c2.newBudget <= c2.currentBudget, `Línea trampa dentro de Camisetas no recibe inyección (${c2.newBudget} <= ${c2.currentBudget})`);

    assert(result.categorySummaries.length === 2, `Se generaron resúmenes para 2 categorías`);
  }

  // Test 6: Fusión de capturas separadas (Costo por Mensaje + Efectividad)
  {
    const initialCosts = [
      { id: '1', name: 'DRISTRI PRO 1', costPerMessage: 1200, currentBudget: 1500000, currentMessages: 1250, effectiveness: 0 },
      { id: '2', name: 'DANTE NOVA 3', costPerMessage: 1400, currentBudget: 1200000, currentMessages: 857, effectiveness: 0 },
    ];

    const incomingEffectiveness = [
      { name: 'DRISTRI PRO 1', effectiveness: 24.5 },
      { name: 'DANTE NOVA 3', effectiveness: 21.0 }
    ];

    const merged = mergeExtractedMetrics(initialCosts, incomingEffectiveness, 'EFFECTIVENESS');

    assert(merged.length === 2, `Se mantienen 2 tiendas tras fusionar efectividad`);
    assert(merged[0].costPerMessage === 1200, `Conserva costo x mensaje previo ($1200)`);
    assert(merged[0].effectiveness === 24.5, `Actualiza efectividad correctamente (24.5%)`);
    assert(merged[1].effectiveness === 21.0, `Actualiza efectividad de tienda 2 (21.0%)`);
    assert(merged[1].currentBudget === 1200000, `Conserva presupuesto previo ($1,200,000)`);
  }

  // Test 7: Aislamiento total al filtrar por Trafiker (sólo cambia el grupo filtrado, el resto queda intacto)
  {
    const mixedStores = [
      { id: 'o1', name: 'DRISTRI PRO 1', trafiker: 'Oscar', product: 'CAMISETAS', currentBudget: 1000000, costPerMessage: 700, effectiveness: 14.0 },
      { id: 'o2', name: 'NOVA HOME', trafiker: 'Oscar', product: 'CAMISETAS', currentBudget: 1000000, costPerMessage: 600, effectiveness: 4.0 }, // trampa
      { id: 'j1', name: 'LATIN SHOP', trafiker: 'Julio', product: 'CAMISETAS', currentBudget: 2000000, costPerMessage: 650, effectiveness: 12.0 },
      { id: 'j2', name: 'COMPRAMAS 1', trafiker: 'Julio', product: 'CAMISETAS', currentBudget: 1500000, costPerMessage: 800, effectiveness: 10.0 }
    ];

    // Simulamos filtrado por Oscar con target de $2,500,000 (+25% para Oscar)
    const filteredForOscar = mixedStores.filter(s => s.trafiker === 'Oscar');
    const unfilteredJulio = mixedStores.filter(s => s.trafiker !== 'Oscar');

    const oscarOpt = optimizeBudget(filteredForOscar, {
      targetBudget: 2500000,
      minEffectivenessThreshold: 8.0
    });

    // Las de Julio se mantienen intactas
    const julioUntouched = unfilteredJulio.map(s => ({
      ...s,
      newBudget: s.currentBudget,
      budgetDelta: 0
    }));

    const allStoresCombined = [...oscarOpt.optimizedItems, ...julioUntouched];

    const oscarTotalNew = allStoresCombined.filter(s => s.trafiker === 'Oscar').reduce((a, b) => a + b.newBudget, 0);
    const julioTotalNew = allStoresCombined.filter(s => s.trafiker === 'Julio').reduce((a, b) => a + b.newBudget, 0);
    const julioTotalOld = unfilteredJulio.reduce((a, b) => a + b.currentBudget, 0);

    assert(Math.abs(oscarTotalNew - 2500000) < 5, `Presupuesto de Oscar se redistribuye exactamente al objetivo ($2,500,000)`);
    assert(julioTotalNew === julioTotalOld, `Presupuesto de Julio no se altera ($${julioTotalNew} === $${julioTotalOld})`);
    
    const julioDeltas = allStoresCombined.filter(s => s.trafiker === 'Julio').every(s => s.budgetDelta === 0);
    assert(julioDeltas === true, `Todas las tiendas de Julio tienen delta exactamente $0`);

    const oscarTrap = oscarOpt.optimizedItems.find(s => s.id === 'o2');
    assert(oscarTrap.newBudget <= oscarTrap.currentBudget, `Tienda trampa de Oscar no recibe aumento (${oscarTrap.newBudget} <= ${oscarTrap.currentBudget})`);
  }

  // Test 8: Aislamiento total al filtrar por Producto (CAMISETAS no altera CONJUNTOS ni PIJAMAS)
  {
    const portfolio = [
      { id: 'p1', name: 'Tienda Camisetas A', product: 'CAMISETAS', currentBudget: 800000, costPerMessage: 500, effectiveness: 15.0 },
      { id: 'p2', name: 'Tienda Camisetas B', product: 'CAMISETAS', currentBudget: 800000, costPerMessage: 900, effectiveness: 5.0 },
      { id: 'p3', name: 'Tienda Conjuntos C', product: 'CONJUNTOS', currentBudget: 1200000, costPerMessage: 600, effectiveness: 18.0 }
    ];

    const filteredCamisetas = portfolio.filter(s => s.product === 'CAMISETAS');
    const unfilteredOthers = portfolio.filter(s => s.product !== 'CAMISETAS');

    const optCamisetas = optimizeBudget(filteredCamisetas, {
      targetBudget: 1600000,
      minEffectivenessThreshold: 8.0
    });

    const optP1 = optCamisetas.optimizedItems.find(s => s.id === 'p1');
    const optP2 = optCamisetas.optimizedItems.find(s => s.id === 'p2');

    assert(optP1.newBudget > optP1.currentBudget, `Camisetas A con alta efectividad recibe inyección (${optP1.newBudget} > ${optP1.currentBudget})`);
    assert(optP2.newBudget <= optP2.currentBudget, `Camisetas B trampa no recibe inyección (${optP2.newBudget} <= ${optP2.currentBudget})`);
    assert(unfilteredOthers[0].currentBudget === 1200000, `Tienda Conjuntos C permanece 100% inalterada con $1,200,000`);
  }

  // Test 9: Garantía de asignación exacta al cambiar targetBudget con categoryBudgets activo (Caso $850k -> $1.25M)
  {
    const items = [
      { id: '1', name: 'Tienda 1', category: 'CAMISETAS', currentBudget: 500000, costPerMessage: 700, effectiveness: 14.0 },
      { id: '2', name: 'Tienda 2', category: 'CAMISETAS', currentBudget: 350000, costPerMessage: 600, effectiveness: 10.0 }
    ];

    // Simula que categoryBudgets tenía el total anterior de $850,000
    const staleCategoryBudgets = {
      'CAMISETAS': 850000
    };

    // El usuario define un targetBudget de $1,250,000
    const result = optimizeBudget(items, {
      targetBudget: 1250000,
      categoryBudgets: staleCategoryBudgets,
      minEffectivenessThreshold: 8.0
    });

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    assert(Math.abs(totalAllocated - 1250000) < 1, `El optimizador escala categoryBudgets y asigna exactamente $1,250,000 (actual: ${totalAllocated})`);
    assert(result.summary.finalTargetBudget === 1250000, `El resumen ejecutivo refleja $1,250,000`);
  }

  // Test 10: Redondeo comercial limpio en múltiplos de $5,000 COP (terminados en 0 o 5)
  {
    const copItems = [
      { id: '1', name: 'Tienda 1', currentBudget: 500000, costPerMessage: 685, effectiveness: 14.5 },
      { id: '2', name: 'Tienda 2', currentBudget: 350000, costPerMessage: 540, effectiveness: 11.2 },
      { id: '3', name: 'Tienda 3', currentBudget: 400000, costPerMessage: 920, effectiveness: 5.1 } // baja efectividad
    ];

    const result = optimizeBudget(copItems, {
      targetBudget: 1250000,
      roundingStep: 5000,
      minEffectivenessThreshold: 8.0
    });

    const allMultiplesOf5k = result.optimizedItems.every(it => it.newBudget % 5000 === 0);
    assert(allMultiplesOf5k, 'Todos los presupuestos optimizados son múltiplos exactos de $5,000 COP');

    const noOddDecimals = result.optimizedItems.every(it => Number.isInteger(it.newBudget));
    assert(noOddDecimals, 'Ningún presupuesto tiene decimales ni centavos sueltos');

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    assert(totalAllocated === 1250000, `La suma de presupuestos redondeados cuadra exactamente a $1,250,000 (actual: ${totalAllocated})`);
  }

  // Test 11: Planificador de Re-escalada en 2 fases (Finde -30% ➔ Lunes $1,250,000)
  {
    const stores = [
      { id: '1', name: 'Tienda A', currentBudget: 500000, costPerMessage: 700, effectiveness: 18.0 },
      { id: '2', name: 'Tienda B', currentBudget: 400000, costPerMessage: 600, effectiveness: 12.0 },
      { id: '3', name: 'Tienda C', currentBudget: 350000, costPerMessage: 800, effectiveness: 4.0 } // trampa
    ];

    const plan = planTwoPhaseRedistribution(stores, {
      baseBudget: 1250000,
      reductionPct: 30, // -30% para fin de semana ($875,000)
      reboundTargetBudget: 1250000, // retorno a $1,250,000 el lunes
      roundingStep: 5000,
      minEffectivenessThreshold: 8.0
    });

    const totalWeekend = plan.combinedItems.reduce((acc, it) => acc + it.weekendBudget, 0);
    const totalMonday = plan.combinedItems.reduce((acc, it) => acc + it.mondayBudget, 0);

    assert(totalWeekend === 875000, `Fase Finde asigna exactamente $875,000 (-30% de $1.25M)`);
    assert(totalMonday === 1250000, `Fase Lunes retorna exactamente a $1,250,000`);

    const totalReactivation = plan.combinedItems.reduce((acc, it) => acc + it.reactivationDelta, 0);
    assert(totalReactivation === (1250000 - 875000), `El Salto de Reactivación total es exactamente +$375,000`);

    // Cada tienda tiene presupuestos limpios en múltiplos de $5,000
    const weekendMultiples = plan.combinedItems.every(it => it.weekendBudget % 5000 === 0);
    const mondayMultiples = plan.combinedItems.every(it => it.mondayBudget % 5000 === 0);
    const deltaMultiples = plan.combinedItems.every(it => it.reactivationDelta % 5000 === 0);

    assert(weekendMultiples && mondayMultiples && deltaMultiples, 'Finde, Lunes y Saltos de Reactivación son múltiplos limpios de $5,000');

    // Tienda trampa C no recibe aumento en reactivación por encima de su capacidad
    const storeC = plan.combinedItems.find(it => it.id === '3');
    assert(storeC.mondayBudget <= storeC.currentBudget, `Tienda trampa C se mantiene controlada el lunes (${storeC.mondayBudget} <= ${storeC.currentBudget})`);
  }

  // Test 12: Barra de Factor CPR (Sensibilidad Beta)
  {
    const stores = [
      { id: '1', name: 'Tienda Barata', currentBudget: 500000, costPerMessage: 700, effectiveness: 15.0 },
      { id: '2', name: 'Tienda Cara', currentBudget: 500000, costPerMessage: 900, effectiveness: 15.0 }
    ];

    // Con beta bajo/permisivo (0.5)
    const resPermissive = optimizeBudget(stores, { targetBudget: 1000000, beta: 0.5, roundingStep: 5000 });
    // Con beta estricto/alto (1.8)
    const resStrict = optimizeBudget(stores, { targetBudget: 1000000, beta: 1.8, roundingStep: 5000 });

    const cheapPermissive = resPermissive.optimizedItems.find(it => it.id === '1').newBudget;
    const cheapStrict = resStrict.optimizedItems.find(it => it.id === '1').newBudget;
    const expensivePermissive = resPermissive.optimizedItems.find(it => it.id === '2').newBudget;
    const expensiveStrict = resStrict.optimizedItems.find(it => it.id === '2').newBudget;

    assert(cheapStrict > cheapPermissive, `Factor CPR beta alto inyecta más presupuesto a tienda con bajo CPR (${cheapStrict} > ${cheapPermissive})`);
    assert(expensiveStrict < expensivePermissive, `Factor CPR beta alto penaliza tienda con alto CPR (${expensiveStrict} < ${expensivePermissive})`);
  }

  // Test 13: Techo estricto de presupuesto (Zero-Overflow) y números limpios en miles ($1,000 COP)
  {
    const stores = [
      { id: '1', name: 'Tienda Alfa', currentBudget: 150000, costPerMessage: 680, effectiveness: 22.0 },
      { id: '2', name: 'Tienda Beta', currentBudget: 120000, costPerMessage: 950, effectiveness: 14.5 },
      { id: '3', name: 'Tienda Gamma', currentBudget: 180000, costPerMessage: 520, effectiveness: 18.2 },
      { id: '4', name: 'Tienda Delta', currentBudget: 100000, costPerMessage: 800, effectiveness: 4.0 } // trampa
    ];

    const target = 650000;
    const result = optimizeBudget(stores, {
      targetBudget: target,
      roundingStep: 1000,
      minEffectivenessThreshold: 8.0
    });

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);

    // Techo estricto: la suma NUNCA supera el presupuesto objetivo
    assert(totalAllocated <= target, `Presupuesto total jamás sobrepasa el techo ($${totalAllocated} <= $${target})`);
    assert(totalAllocated === target, `Presupuesto total cuadra exactamente con el objetivo ($${totalAllocated} === $${target})`);

    // Todos los valores son enteros limpios en miles (terminados en 000, no cifras raras como 34,123)
    const allCleanThousands = result.optimizedItems.every(it => it.newBudget % 1000 === 0);
    assert(allCleanThousands, 'Todos los presupuestos optimizados son múltiplos exactos de $1,000 COP (terminan en 000)');

    const noOddNumbers = result.optimizedItems.every(it => Number.isInteger(it.newBudget));
    assert(noOddNumbers, 'Ningún presupuesto tiene decimales ni centavos sueltos');
  }

  // Test 14: Bloqueo manual de presupuesto por tienda con redistribución del saldo remanente
  {
    const stores = [
      { id: 's1', name: 'CAMISETAS 1', category: 'CAMISETAS', currentBudget: 100000, costPerMessage: 700, effectiveness: 12.0 },
      { id: 's2', name: 'CAMISETAS 2', category: 'CAMISETAS', currentBudget: 100000, costPerMessage: 650, effectiveness: 18.0 },
      { id: 's3', name: 'CAMISETAS 3', category: 'CAMISETAS', currentBudget: 100000, costPerMessage: 600, effectiveness: 15.0 }
    ];

    const target = 300000;

    // Supongamos que el optimizador recomienda bajarle a CAMISETAS 1, pero el usuario
    // decide manualmente fijarle $120,000 COP porque con menos presupuesto no rinde bien.
    const manualOverrides = {
      's1': 120000
    };

    const result = optimizeBudget(stores, {
      targetBudget: target,
      roundingStep: 1000,
      manualOverrides
    });

    const s1 = result.optimizedItems.find(it => it.id === 's1');
    const s2 = result.optimizedItems.find(it => it.id === 's2');
    const s3 = result.optimizedItems.find(it => it.id === 's3');

    // s1 debe tener exactamente el presupuesto bloqueado
    assert(s1.newBudget === 120000, `Tienda bloqueada s1 recibe exactamente el presupuesto manual ($${s1.newBudget} === $120,000)`);
    assert(s1.isManualLocked === true, 's1 está marcada como bloqueada manualmente (isManualLocked)');

    // El resto (300,000 - 120,000 = 180,000) se reparte entre s2 y s3
    const unlockedSum = s2.newBudget + s3.newBudget;
    assert(unlockedSum === 180000, `El remanente de $180,000 se redistribuye entre las tiendas desbloqueadas (actual: $${unlockedSum})`);

    // La tienda s2 con mayor efectividad (18% vs 15%) debe recibir más que s3
    assert(s2.newBudget >= s3.newBudget, `Entre las desbloqueadas, s2 (18% eff) recibe más o igual que s3 (15% eff): $${s2.newBudget} >= $${s3.newBudget}`);

    // La suma global es exactamente 300,000
    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    assert(totalAllocated === target, `La suma global con tiendas bloqueadas cuadra exactamente al target ($${totalAllocated} === $${target})`);
  }

  // Test 15: Manejo robusto cuando las tiendas tienen CPR en 0 (estado inicial pre-cargado)
  {
    const zeroCprStores = [
      { id: 'z1', name: 'DRISTRI PRO 1', currentBudget: 0, costPerMessage: 0, effectiveness: 18.0 },
      { id: 'z2', name: 'LATIN SHOP', currentBudget: 0, costPerMessage: 0, effectiveness: 14.0 },
      { id: 'z3', name: 'SURAE', currentBudget: 0, costPerMessage: 0, effectiveness: 3.0 }
    ];

    const result = optimizeBudget(zeroCprStores, {
      targetBudget: 300000,
      roundingStep: 1000,
      minEffectivenessThreshold: 8.0
    });

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    assert(totalAllocated === 300000, `Distribuye presupuesto a tiendas con CPR 0 sin errores de división ni NaN ($${totalAllocated} === $300,000)`);

    const noNaN = result.optimizedItems.every(it => !isNaN(it.newBudget) && isFinite(it.newBudget));
    assert(noNaN, 'Ninguna asignación resulta en NaN o Infinity cuando el CPR es 0');
  }

  // Test 16: Bloqueo de categoría y redistribución automática del remanente en miles limpios
  {
    const multiCatStores = [
      { id: 'c1', name: 'Camisetas A', category: 'CAMISETAS', currentBudget: 1000000, costPerMessage: 1000, effectiveness: 20.0 },
      { id: 'c2', name: 'Camisetas B', category: 'CAMISETAS', currentBudget: 1000000, costPerMessage: 1000, effectiveness: 15.0 },
      { id: 'j1', name: 'Conjuntos A', category: 'CONJUNTOS', currentBudget: 1000000, costPerMessage: 1200, effectiveness: 18.0 },
      { id: 'j2', name: 'Conjuntos B', category: 'CONJUNTOS', currentBudget: 1000000, costPerMessage: 1200, effectiveness: 14.0 },
      { id: 'v1', name: 'Vestidos A', category: 'VESTIDOS', currentBudget: 1000000, costPerMessage: 800, effectiveness: 16.0 },
    ];
    const totalTarget = 5000000;
    // El usuario bloquea CONJUNTOS en $1,500,000 COP
    const lockedCategories = { 'CONJUNTOS': 1500000 };
    const freeForUnlocked = totalTarget - 1500000; // 3,500,000 COP

    // Redistribución entre CAMISETAS (base 2M) y VESTIDOS (base 1M)
    const baseUnlockedSum = 3000000;
    const catBudgets = {
      ...lockedCategories,
      'CAMISETAS': Math.floor((2000000 / baseUnlockedSum) * freeForUnlocked / 1000) * 1000,
      'VESTIDOS': Math.floor((1000000 / baseUnlockedSum) * freeForUnlocked / 1000) * 1000,
    };
    catBudgets['CAMISETAS'] += 1000; // Asignación de remanente

    const result = optimizeBudget(multiCatStores, {
      targetBudget: totalTarget,
      categoryBudgets: catBudgets,
      roundingStep: 1000
    });

    const totalAllocated = result.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    assert(totalAllocated === totalTarget, `Suma total asignada a categorías con bloqueo cuadra exactamente al target ($${totalAllocated} === $${totalTarget})`);

    const conjuntosTotal = result.optimizedItems
      .filter(it => it.category === 'CONJUNTOS')
      .reduce((acc, it) => acc + it.newBudget, 0);
    assert(conjuntosTotal === 1500000, `Categoría CONJUNTOS recibe exactamente el monto bloqueado ($${conjuntosTotal} === $1,500,000)`);
  }

  // Test 17: Plan de Re-escalada con segmentación por categoría y categoryReboundSummaries
  {
    const reboundStores = [
      { id: 'c1', name: 'Camisetas A', category: 'CAMISETAS', currentBudget: 1000000, costPerMessage: 1000, effectiveness: 20.0 },
      { id: 'j1', name: 'Conjuntos A', category: 'CONJUNTOS', currentBudget: 1000000, costPerMessage: 1200, effectiveness: 18.0 }
    ];

    const reboundResult = planTwoPhaseRedistribution(reboundStores, {
      baseBudget: 2000000,
      reductionPct: 30, // -30% el fin de semana
      reboundTargetBudget: 2000000,
      roundingStep: 1000,
      categoryBudgets: {
        'CAMISETAS': 1200000,
        'CONJUNTOS': 800000
      }
    });

    assert(Array.isArray(reboundResult.categoryReboundSummaries), 'categoryReboundSummaries existe y es un array');
    assert(reboundResult.categoryReboundSummaries.length === 2, 'Contiene resúmenes para ambas categorías');

    const camisasSummary = reboundResult.categoryReboundSummaries.find(s => s.category === 'CAMISETAS');
    assert(camisasSummary.mondayBudget === 1200000, `Presupuesto Lunes de CAMISETAS respeta el presupuesto asignado ($${camisasSummary.mondayBudget} === $1,200,000)`);
    assert(camisasSummary.weekendBudget < camisasSummary.mondayBudget, `Presupuesto Finde de CAMISETAS es menor ($${camisasSummary.weekendBudget} < $${camisasSummary.mondayBudget})`);
    assert(camisasSummary.reactivationDelta > 0, `Salto de reactivación es positivo (+$${camisasSummary.reactivationDelta})`);
  }

  // Test 18: Sin Infinity ni NaN en projectedMessages y efectividad cuando CPR = 0
  {
    const zeroCprList = [
      { id: 'z1', name: 'Tienda Nueva', category: 'CAMISETAS', currentBudget: 0, costPerMessage: 0, effectiveness: 15.0 }
    ];

    const result = optimizeBudget(zeroCprList, {
      targetBudget: 100000,
      roundingStep: 1000
    });

    const item = result.optimizedItems[0];
    assert(item.projectedMessages === 0, `Mensajes proyectados son 0 en lugar de Infinity cuando CPR es 0 (actual: ${item.projectedMessages})`);
    assert(!isNaN(item.projectedEffectiveMessages), `Mensajes efectivos proyectados no son NaN (actual: ${item.projectedEffectiveMessages})`);
    assert(!isNaN(result.summary.newWeightedEff), `Efectividad ponderada en summary no es NaN (actual: ${result.summary.newWeightedEff})`);
  }

  // Test 19: Bloqueo manual de tienda en planTwoPhaseRedistribution
  {
    const reboundStores = [
      { id: 's1', name: 'Tienda Bloqueada', currentBudget: 500000, costPerMessage: 1000, effectiveness: 20.0 },
      { id: 's2', name: 'Tienda Libre', currentBudget: 500000, costPerMessage: 1000, effectiveness: 15.0 }
    ];

    const reboundResult = planTwoPhaseRedistribution(reboundStores, {
      baseBudget: 1000000,
      reductionPct: 30,
      reboundTargetBudget: 1000000,
      roundingStep: 1000,
      manualOverrides: {
        's1': 600000
      }
    });

    const s1 = reboundResult.combinedItems.find(it => it.id === 's1');
    const s2 = reboundResult.combinedItems.find(it => it.id === 's2');

    assert(s1.mondayBudget === 600000, `Tienda bloqueada s1 recibe exactamente $600,000 en Lunes ($${s1.mondayBudget})`);
    assert(s1.isManualLocked === true, 's1 está marcada como bloqueada en combinedItems');
    assert(s2.mondayBudget === 400000, `Tienda libre s2 recibe el remanente de $400,000 en Lunes ($${s2.mondayBudget})`);
    assert(s1.mondayBudget + s2.mondayBudget === 1000000, 'La suma total de Lunes con tiendas bloqueadas es exactamente $1,000,000');
  }

  // Test 20: Bloqueo de Categoría (lockedCategoryBudgets) + Bloqueo de Tienda (manualOverrides)
  {
    const pivotStores = [
      { id: 'c1', name: 'Camisetas A', category: 'CAMISETAS', currentBudget: 10000000, costPerMessage: 700, effectiveness: 12.0 },
      { id: 'c2', name: 'Camisetas B', category: 'CAMISETAS', currentBudget: 8000000, costPerMessage: 800, effectiveness: 10.0 },
      { id: 'j1', name: 'Conjuntos A', category: 'CONJUNTOS', currentBudget: 6000000, costPerMessage: 600, effectiveness: 14.0 },
      { id: 'j2', name: 'Conjuntos B', category: 'CONJUNTOS', currentBudget: 4000000, costPerMessage: 650, effectiveness: 9.0 },
      { id: 'p1', name: 'Pijamas A', category: 'PIJAMAS', currentBudget: 12000000, costPerMessage: 750, effectiveness: 11.0 }
    ];
    const totalTarget = 40000000;

    // 1. Bloqueo de categoría CAMISETAS en $15,000,000 COP
    // 2. Bloqueo de tienda c1 en $8,000,000 COP
    // 3. Bloqueo de tienda j1 en $4,000,000 COP
    const lockedCat = { 'CAMISETAS': 15000000 };
    const manualLocks = { 'c1': 8000000, 'j1': 4000000 };

    const catBudgets = {
      'CAMISETAS': 15000000,
      'CONJUNTOS': 10000000,
      'PIJAMAS': 15000000
    };

    const optResult = optimizeBudget(pivotStores, {
      targetBudget: totalTarget,
      categoryBudgets: catBudgets,
      lockedCategoryBudgets: lockedCat,
      manualOverrides: manualLocks,
      roundingStep: 1000
    });

    const camAllocated = optResult.optimizedItems.filter(it => it.category === 'CAMISETAS').reduce((acc, it) => acc + it.newBudget, 0);
    const totalAllocated = optResult.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    const c1Opt = optResult.optimizedItems.find(it => it.id === 'c1');
    const c2Opt = optResult.optimizedItems.find(it => it.id === 'c2');
    const j1Opt = optResult.optimizedItems.find(it => it.id === 'j1');

    assert(camAllocated === 15000000, `Categoría bloqueada CAMISETAS asigna exactamente $15,000,000 (${camAllocated})`);
    assert(c1Opt.newBudget === 8000000, `Tienda bloqueada c1 dentro de CAMISETAS recibe exactamente $8,000,000 (${c1Opt.newBudget})`);
    assert(c1Opt.isManualLocked === true, 'c1 está marcada como isManualLocked');
    assert(c2Opt.newBudget === 7000000, `Tienda hermana c2 recibe el remanente de la categoría ($7,000,000, actual: ${c2Opt.newBudget})`);
    assert(j1Opt.newBudget === 4000000, `Tienda bloqueada j1 en CONJUNTOS recibe exactamente $4,000,000 (${j1Opt.newBudget})`);
    assert(totalAllocated === totalTarget, `Suma total cuadra exactamente al target (${totalAllocated} === ${totalTarget})`);

    // Probar Re-escalada en 2 fases con bloqueos combinados
    const reboundResult = planTwoPhaseRedistribution(pivotStores, {
      baseBudget: totalTarget,
      reductionPct: 30,
      reboundTargetBudget: totalTarget,
      categoryBudgets: catBudgets,
      lockedCategoryBudgets: lockedCat,
      manualOverrides: manualLocks,
      roundingStep: 1000
    });

    const c1Rebound = reboundResult.combinedItems.find(it => it.id === 'c1');
    const j1Rebound = reboundResult.combinedItems.find(it => it.id === 'j1');
    assert(c1Rebound.mondayBudget === 8000000, `Re-escalada Lunes c1 recibe $8,000,000 (${c1Rebound.mondayBudget})`);
    assert(c1Rebound.weekendBudget === 5600000, `Re-escalada Finde c1 reduce -30% a $5,600,000 (${c1Rebound.weekendBudget})`);
    assert(j1Rebound.mondayBudget === 4000000, `Re-escalada Lunes j1 recibe $4,000,000 (${j1Rebound.mondayBudget})`);
    assert(j1Rebound.weekendBudget === 2800000, `Re-escalada Finde j1 reduce -30% a $2,800,000 (${j1Rebound.weekendBudget})`);
  }

  // Test 21: Redondeo estricto a múltiplos de $5,000 COP con suma global idéntica al target
  {
    const items5k = [
      { id: 't1', name: 'Tienda 1', currentBudget: 140000, costPerMessage: 650, effectiveness: 12.0 },
      { id: 't2', name: 'Tienda 2', currentBudget: 270000, costPerMessage: 500, effectiveness: 15.0 },
      { id: 't3', name: 'Tienda 3', currentBudget: 220000, costPerMessage: 800, effectiveness: 9.0 },
      { id: 't4', name: 'Tienda 4', currentBudget: 170000, costPerMessage: 700, effectiveness: 10.0 }
    ];
    const totalTarget = 800000;

    const res = optimizeBudget(items5k, {
      targetBudget: totalTarget,
      roundingStep: 5000,
      maxVariationPct: 35
    });

    const allMultiples5k = res.optimizedItems.every(it => it.newBudget % 5000 === 0);
    assert(allMultiples5k, 'Todos los presupuestos asignados son múltiplos exactos de $5,000 COP');

    const sumAllocated = res.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
    assert(sumAllocated === totalTarget, `La suma asignada (${sumAllocated}) cuadra exactamente con el target (${totalTarget})`);
  }

  // Test 22: Hard Cap ±35% en optimización normal
  {
    const itemsCap = [
      { id: 'h1', name: 'Super Tienda', currentBudget: 100000, costPerMessage: 300, effectiveness: 25.0 },
      { id: 'h2', name: 'Tienda Regular', currentBudget: 200000, costPerMessage: 700, effectiveness: 10.0 },
      { id: 'h3', name: 'Tienda Débil', currentBudget: 150000, costPerMessage: 900, effectiveness: 8.5 }
    ];
    const target = 450000; // Mismo presupuesto total

    const res = optimizeBudget(itemsCap, {
      targetBudget: target,
      maxVariationPct: 35,
      roundingStep: 5000
    });

    const h1 = res.optimizedItems.find(it => it.id === 'h1');
    const h3 = res.optimizedItems.find(it => it.id === 'h3');

    // h1 tiene rendimiento excelente pero jamás puede superar 100,000 * 1.35 = 135,000
    assert(h1.newBudget <= 135000, `Super Tienda respeta Hard Cap superior de +35% (${h1.newBudget} <= 135,000)`);

    // h3 no debe bajar más de 150,000 * 0.65 = 97,500
    assert(h3.newBudget >= 95000, `Tienda Débil respeta Hard Cap inferior de -35% (${h3.newBudget} >= 95,000)`);
  }

  // Test 23: Hard Cap al bloquear tiendas (evitar desborde +60% en la tienda libre)
  {
    const stores7 = [
      { id: 's1', name: 'Tienda 1', currentBudget: 250000, costPerMessage: 716, effectiveness: 10.0 },
      { id: 's2', name: 'Tienda 2', currentBudget: 100000, costPerMessage: 625, effectiveness: 4.09 },
      { id: 's3', name: 'Tienda 3', currentBudget: 170000, costPerMessage: 688, effectiveness: 5.65 },
      { id: 's4', name: 'Tienda 4', currentBudget: 250000, costPerMessage: 642, effectiveness: 9.21 },
      { id: 's5', name: 'Tienda 5', currentBudget: 170000, costPerMessage: 783, effectiveness: 5.84 },
      { id: 's6', name: 'GOAL STORE 2', currentBudget: 140000, costPerMessage: 638, effectiveness: 6.4 },
      { id: 's7', name: 'Tienda 7', currentBudget: 170000, costPerMessage: 542, effectiveness: 4.63 }
    ];

    // Bloquear 6 de las 7 tiendas para el fin de semana a valores normales
    const weekendLocks = {
      's1': 165000,
      's2': 60000,
      's3': 80000,
      's4': 160000,
      's5': 80000,
      's7': 90000
    };
    // Suma de bloqueos = 635,000. Meta Finde = 875,000.
    // Presupuesto restante = 240,000.
    // Sin guardrail, GOAL STORE 2 (s6, base 140k) se inflaba a 240,000 (+71%!).
    // Con guardrail ±35%, la cota teórica es 140,000 * 1.35 = 189,000.
    const res = optimizeBudget(stores7, {
      targetBudget: 875000,
      manualOverrides: weekendLocks,
      maxVariationPct: 35,
      roundingStep: 5000
    });

    const s6 = res.optimizedItems.find(it => it.id === 's6');
    assert(s6.newBudget <= 190000, `GOAL STORE 2 no se desborda a +60% o +71% y respeta cota de variación (${s6.newBudget} <= 190,000)`);
  }

  // Test 24: Bloqueo manual independiente de Fin de Semana (weekendManualOverrides)
  {
    const storesFinde = [
      { id: 'f1', name: 'Tienda A', currentBudget: 200000, costPerMessage: 700, effectiveness: 12.0 },
      { id: 'f2', name: 'Tienda B', currentBudget: 300000, costPerMessage: 600, effectiveness: 14.0 }
    ];

    const rebound = planTwoPhaseRedistribution(storesFinde, {
      baseBudget: 500000,
      reductionPct: 30, // Meta Finde = 350,000
      roundingStep: 5000,
      weekendManualOverrides: {
        'f1': 120000 // Bloqueo explícito de fin de semana para Tienda A
      }
    });

    const f1 = rebound.combinedItems.find(it => it.id === 'f1');
    const f2 = rebound.combinedItems.find(it => it.id === 'f2');

    assert(f1.weekendBudget === 120000, `Tienda A recibe exactamente su presupuesto de finde fijado ($120,000, actual: ${f1.weekendBudget})`);
    assert(f1.isWeekendManualLocked === true, 'f1 está marcada como isWeekendManualLocked');
    assert(f2.weekendBudget === 230000, `Tienda B recibe el remanente de finde ($230,000, actual: ${f2.weekendBudget})`);
    assert(f1.weekendBudget + f2.weekendBudget === 350000, 'Suma de fin de semana cuadra exactamente a 350,000');
  }

  // Test 25: Bloqueo dual simultáneo (Finde y Lunes fijados por el usuario)
  {
    const storesDual = [
      { id: 'd1', name: 'Tienda Dual', currentBudget: 200000, costPerMessage: 650, effectiveness: 11.0 },
      { id: 'd2', name: 'Tienda Libre', currentBudget: 300000, costPerMessage: 600, effectiveness: 13.0 }
    ];

    const rebound = planTwoPhaseRedistribution(storesDual, {
      baseBudget: 500000,
      reductionPct: 30,
      roundingStep: 5000,
      weekendManualOverrides: { 'd1': 110000 },
      manualOverrides: { 'd1': 190000 }
    });

    const d1 = rebound.combinedItems.find(it => it.id === 'd1');
    assert(d1.weekendBudget === 110000, `d1 Finde fijado a 110,000 (actual: ${d1.weekendBudget})`);
    assert(d1.mondayBudget === 190000, `d1 Lunes fijado a 190,000 (actual: ${d1.mondayBudget})`);
    assert(d1.reactivationDelta === 80000, `Salto de reactivación es exactamente Lunes - Finde (80,000, actual: ${d1.reactivationDelta})`);
    assert(d1.reactivationAction === 'Subir +$80.000', `Acción recomendada es Subir +$80.000 (actual: ${d1.reactivationAction})`);
  }

  // Test 26: Salto de reactivación negativo sin prefijo roto +$-
  {
    const storesNeg = [
      { id: 'n1', name: 'Tienda Neg', currentBudget: 150000, costPerMessage: 600, effectiveness: 10.0 }
    ];

    const rebound = planTwoPhaseRedistribution(storesNeg, {
      baseBudget: 150000,
      weekendManualOverrides: { 'n1': 160000 },
      manualOverrides: { 'n1': 100000 }
    });

    const n1 = rebound.combinedItems.find(it => it.id === 'n1');
    assert(n1.reactivationDelta === -60000, `Delta negativo es exactamente -60,000 (actual: ${n1.reactivationDelta})`);
    assert(n1.reactivationAction === 'Ajustar -$60.000', `Acción recomendada no tiene signos rotos: ${n1.reactivationAction}`);
  }

  console.log(`\nResultados: ${passed} pasadas, ${failed} fallidas`);
  if (failed > 0) process.exit(1);
}

runTests();
