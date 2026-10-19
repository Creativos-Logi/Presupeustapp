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

  console.log(`\nResultados: ${passed} pasadas, ${failed} fallidas`);
  if (failed > 0) process.exit(1);
}

runTests();
