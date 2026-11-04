import assert from 'assert';
import { optimizeBudget, planTwoPhaseRedistribution } from '../src/utils/optimizer.js';

console.log('🔥 =======================================================');
console.log('🔥 INICIANDO BATERÍA DE PRUEBAS DE ESTRÉS EXTREMAS (10 VECTORES)');
console.log('🔥 =======================================================\n');

let passedCount = 0;
let totalCount = 0;

function runTest(name, fn) {
  totalCount++;
  try {
    fn();
    console.log(`✅ PASS [Vector ${totalCount}]: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`❌ FAIL [Vector ${totalCount}]: ${name}`);
    console.error(`   Error: ${err.message}`);
    console.error(err.stack);
  }
}

// =========================================================================
// VECTOR 1: Paradoja de Sobre-bloqueo (Candados > Presupuesto Objetivo)
// =========================================================================
runTest('Sobre-bloqueo: Candados suman $1.5M con target de $1.0M', () => {
  const stores = [
    { id: '1', name: 'Tienda Bloqueada 1', currentBudget: 400000, costPerMessage: 700, effectiveness: 15.0 },
    { id: '2', name: 'Tienda Bloqueada 2', currentBudget: 400000, costPerMessage: 700, effectiveness: 14.0 },
    { id: '3', name: 'Tienda Bloqueada 3', currentBudget: 400000, costPerMessage: 700, effectiveness: 12.0 },
    { id: '4', name: 'Tienda Libre 1', currentBudget: 200000, costPerMessage: 800, effectiveness: 10.0 },
    { id: '5', name: 'Tienda Libre 2', currentBudget: 200000, costPerMessage: 900, effectiveness: 9.0 }
  ];

  const target = 1000000;
  const locks = {
    '1': 500000,
    '2': 500000,
    '3': 500000 // Total bloqueado = 1,500,000 > target 1,000,000
  };

  const res = optimizeBudget(stores, {
    targetBudget: target,
    manualOverrides: locks,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  // 1. Las tiendas bloqueadas deben recibir exactamente su presupuesto fijado
  assert.strictEqual(res.optimizedItems.find(it => it.id === '1').newBudget, 500000);
  assert.strictEqual(res.optimizedItems.find(it => it.id === '2').newBudget, 500000);
  assert.strictEqual(res.optimizedItems.find(it => it.id === '3').newBudget, 500000);

  // 2. Las tiendas no bloqueadas NO deben recibir presupuesto negativo
  const free1 = res.optimizedItems.find(it => it.id === '4');
  const free2 = res.optimizedItems.find(it => it.id === '5');
  assert.strictEqual(free1.newBudget, 0, 'Tienda libre 1 recibe 0 COP (no negativo)');
  assert.strictEqual(free2.newBudget, 0, 'Tienda libre 2 recibe 0 COP (no negativo)');

  // 3. No debe haber NaN ni Infinity
  assert(res.optimizedItems.every(it => !isNaN(it.newBudget) && isFinite(it.newBudget)));
});

// =========================================================================
// VECTOR 2: El Embudo Solitario (1 tienda libre con baja efectividad vs excedente millonario)
// =========================================================================
runTest('Embudo Solitario: Tienda libre con efectividad baja (<8%) no explota a +2600%', () => {
  const stores = [];
  const locks = {};
  for (let i = 1; i <= 9; i++) {
    stores.push({ id: `s${i}`, name: `Tienda ${i}`, currentBudget: 100000, costPerMessage: 600, effectiveness: 12.0 });
    locks[`s${i}`] = 100000;
  }
  // Tienda 10: Única tienda libre, base 150k, efectividad 4.5% (<8%)
  stores.push({ id: 's10', name: 'Tienda Débil Libre', currentBudget: 150000, costPerMessage: 700, effectiveness: 4.5 });

  // Target millonario: 5,000,000 COP (Sobran $4.1M)
  const res = optimizeBudget(stores, {
    targetBudget: 5000000,
    manualOverrides: locks,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const s10 = res.optimizedItems.find(it => it.id === 's10');
  // s10 NO debe recibir 4.1 millones porque su efectividad es 4.5% (<8%). Debe estar topada en su presupuesto base o máximo +35%
  assert(s10.newBudget <= 205000, `Tienda débil libre está protegida y no se infló sin control (actual: ${s10.newBudget} COP)`);
  assert(s10.isBelowThreshold === true, 'Está marcada como isBelowThreshold');
});

// =========================================================================
// VECTOR 3: Portafolio 100% "Enfermo" (Todas las tiendas < 8% de efectividad)
// =========================================================================
runTest('Portafolio 100% "Enfermo": Todas <8% efectividad no congelan el presupuesto a 0', () => {
  const sickStores = [
    { id: '1', name: 'Tienda 1', currentBudget: 200000, costPerMessage: 700, effectiveness: 3.5 },
    { id: '2', name: 'Tienda 2', currentBudget: 200000, costPerMessage: 800, effectiveness: 4.0 },
    { id: '3', name: 'Tienda 3', currentBudget: 200000, costPerMessage: 650, effectiveness: 2.1 },
    { id: '4', name: 'Tienda 4', currentBudget: 200000, costPerMessage: 900, effectiveness: 5.0 },
    { id: '5', name: 'Tienda 5', currentBudget: 200000, costPerMessage: 750, effectiveness: 1.8 }
  ];

  const target = 1300000; // Aumento a $1.3M
  const res = optimizeBudget(sickStores, {
    targetBudget: target,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const sumAllocated = res.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
  assert.strictEqual(sumAllocated, target, `El presupuesto total de $1.3M se asignó sin congelarse (actual: ${sumAllocated})`);
  assert(res.optimizedItems.every(it => it.newBudget % 5000 === 0), 'Todos son múltiplos exactos de $5.000 COP');

  // La tienda con mejor efectividad relativa (Tienda 4 con 5.0%) debe recibir más o igual que la peor (Tienda 5 con 1.8%)
  const t4 = res.optimizedItems.find(it => it.id === '4');
  const t5 = res.optimizedItems.find(it => it.id === '5');
  assert(t4.newBudget >= t5.newBudget, `Tienda 4 (5% eff) recibe $${t4.newBudget} >= Tienda 5 (1.8% eff) $${t5.newBudget}`);
});

// =========================================================================
// VECTOR 4: Singularidad Numérica (CPR = 0 o $0.001 COP)
// =========================================================================
runTest('Singularidad Numérica: CPR = 0 o $0.001 COP no genera NaN, Infinity ni división por cero', () => {
  const edgeStores = [
    { id: '1', name: 'Tienda Sin CPR', currentBudget: 200000, costPerMessage: 0, effectiveness: 14.0 },
    { id: '2', name: 'Tienda Centavos', currentBudget: 200000, costPerMessage: 0.001, effectiveness: 10.0 },
    { id: '3', name: 'Tienda Costosa', currentBudget: 200000, costPerMessage: 50000, effectiveness: 18.0 }
  ];

  const target = 600000;
  const res = optimizeBudget(edgeStores, {
    targetBudget: target,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  assert.strictEqual(res.optimizedItems.reduce((s, it) => s + it.newBudget, 0), target);
  
  res.optimizedItems.forEach(it => {
    assert(!isNaN(it.newBudget), `${it.name} newBudget no es NaN`);
    assert(isFinite(it.newBudget), `${it.name} newBudget es finito`);
    assert(!isNaN(it.projectedMessages), `${it.name} projectedMessages no es NaN`);
    assert(isFinite(it.projectedMessages), `${it.name} projectedMessages es finito`);
    assert(!isNaN(it.baseIRC), `${it.name} baseIRC no es NaN`);
    assert(isFinite(it.baseIRC), `${it.name} baseIRC es finito`);
  });
});

// =========================================================================
// VECTOR 5: Portafolio de Arranque en Frío (Presupuesto Actual = $0 COP)
// =========================================================================
runTest('Arranque en Frío: Cartera con presupuesto en $0 no se queda atrapada en $0', () => {
  const coldStores = [
    { id: '1', name: 'Línea A', currentBudget: 0, costPerMessage: 600, effectiveness: 15.0 },
    { id: '2', name: 'Línea B', currentBudget: 0, costPerMessage: 700, effectiveness: 12.0 },
    { id: '3', name: 'Línea C', currentBudget: 0, costPerMessage: 800, effectiveness: 10.0 }
  ];

  const target = 1500000;
  const res = optimizeBudget(coldStores, {
    targetBudget: target,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const sumAllocated = res.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
  assert.strictEqual(sumAllocated, target, `Asigna los $1.5M a partir de $0 base (actual: ${sumAllocated})`);
  assert(res.optimizedItems.every(it => it.newBudget > 0), 'Todas las líneas reciben presupuesto');
  assert(res.optimizedItems.every(it => it.newBudget % 5000 === 0), 'Todos múltiplos de $5.000 COP');
});

// =========================================================================
// VECTOR 6: Target "Sucio" y Redondeo Estricto a $5.000 COP
// =========================================================================
runTest('Target "Sucio": $1.253.487 COP se normaliza por piso a $1.250.000 COP sin excederse', () => {
  const stores = [
    { id: '1', name: 'Tienda 1', currentBudget: 500000, costPerMessage: 600, effectiveness: 12.0 },
    { id: '2', name: 'Tienda 2', currentBudget: 500000, costPerMessage: 700, effectiveness: 14.0 }
  ];

  const messyTarget = 1253487; // No es múltiplo de $5.000
  const res = optimizeBudget(stores, {
    targetBudget: messyTarget,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const sumAllocated = res.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
  const expectedCleanTarget = 1250000; // Math.floor(1253487 / 5000) * 5000

  assert.strictEqual(sumAllocated, expectedCleanTarget, `La suma es exactamente $1.250.000 COP (actual: ${sumAllocated})`);
  assert(sumAllocated <= messyTarget, 'Zero-Overflow estricto: jamás sobrepasa el target original');
  assert(res.optimizedItems.every(it => it.newBudget % 5000 === 0), 'Todos múltiplos de $5.000 COP');

  // Subcaso: Target menor al paso comercial ($3.000 < $5.000)
  const tinyTarget = 3000;
  const resTiny = optimizeBudget(stores, {
    targetBudget: tinyTarget,
    roundingStep: 5000
  });
  const sumTiny = resTiny.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
  assert.strictEqual(sumTiny, 3000, 'Target < roundingStep desactiva redondeo para evitar asignar $0 COP (Fallback resiliente)');
  assert(sumTiny <= tinyTarget, 'Zero-Overflow: Jamás sobrepasa el target original');
});

// =========================================================================
// VECTOR 7: Recortes Salvajes en Fin de Semana (-80% a -90%)
// =========================================================================
runTest('Recorte Salvaje: Reducción de fin de semana del -80% alcanza el target exacto', () => {
  const stores = [
    { id: '1', name: 'Tienda 1', currentBudget: 500000, costPerMessage: 650, effectiveness: 12.0 },
    { id: '2', name: 'Tienda 2', currentBudget: 500000, costPerMessage: 750, effectiveness: 15.0 },
    { id: '3', name: 'Tienda 3', currentBudget: 250000, costPerMessage: 600, effectiveness: 10.0 }
  ];

  // Base $1.250.000 COP, recorte de -80% -> Meta Finde = $250.000 COP
  const rebound = planTwoPhaseRedistribution(stores, {
    baseBudget: 1250000,
    reductionPct: 80,
    reboundTargetBudget: 1250000,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const totalWeekend = rebound.combinedItems.reduce((s, it) => s + it.weekendBudget, 0);
  const totalMonday = rebound.combinedItems.reduce((s, it) => s + it.mondayBudget, 0);

  assert.strictEqual(totalWeekend, 250000, `Meta Finde del -80% alcanzada exactamente ($250,000 COP, actual: ${totalWeekend})`);
  assert.strictEqual(totalMonday, 1250000, `Retorno Lunes exacto ($1,250,000 COP, actual: ${totalMonday})`);

  // Ninguna tienda debe subir en el fin de semana durante un recorte
  rebound.combinedItems.forEach(it => {
    assert(it.weekendBudget <= it.currentBudget, `${it.name} no subió en finde (${it.weekendBudget} <= ${it.currentBudget})`);
    assert(it.weekendBudget % 5000 === 0, `${it.name} Finde es múltiplo de $5.000`);
    assert(it.mondayBudget % 5000 === 0, `${it.name} Lunes es múltiplo de $5.000`);
  });
});

// =========================================================================
// VECTOR 8: Paradoja de Salto Inverso en Re-escalada
// =========================================================================
runTest('Salto Inverso: Bloqueos contradictorios o Lunes menor a Finde formatean limpio sin signos rotos', () => {
  const stores = [
    { id: '1', name: 'Tienda A', currentBudget: 200000, costPerMessage: 600, effectiveness: 12.0 },
    { id: '2', name: 'Tienda B', currentBudget: 200000, costPerMessage: 600, effectiveness: 12.0 }
  ];

  // Forzar un salto negativo mediante candados manuales independientes:
  // Tienda A bloqueada en Finde a $150.000 y en Lunes a $100.000 (Salto = -$50.000)
  const rebound = planTwoPhaseRedistribution(stores, {
    baseBudget: 400000,
    reductionPct: 20,
    roundingStep: 5000,
    weekendManualOverrides: { '1': 150000 },
    manualOverrides: { '1': 100000 }
  });

  const tA = rebound.combinedItems.find(it => it.id === '1');
  assert.strictEqual(tA.weekendBudget, 150000, 'Finde respeta candado $150.000');
  assert.strictEqual(tA.mondayBudget, 100000, 'Lunes respeta candado $100.000');
  assert.strictEqual(tA.reactivationDelta, -50000, 'Delta de reactivación es exactamente -$50.000');
  assert.strictEqual(tA.reactivationAction, 'Ajustar -$50.000', `Acción recomendada limpia: ${tA.reactivationAction}`);
  assert(!tA.reactivationAction.includes('+$-'), 'No contiene texto roto +$-');
});

// =========================================================================
// VECTOR 9: Filtro Vacío y Tienda Única
// =========================================================================
runTest('Filtro Vacío y Tienda Única: Manejo seguro de casos extremos de filtrado', () => {
  // 1. Array vacío
  const emptyRes = optimizeBudget([], { targetBudget: 1000000 });
  assert.strictEqual(emptyRes.optimizedItems.length, 0, 'Array vacío retorna 0 ítems');
  assert.strictEqual(emptyRes.summary.finalTargetBudget, 0);

  // 2. Exactamente 1 tienda con meta superior al 35%
  const singleStore = [
    { id: 'solo', name: 'Tienda Única', currentBudget: 100000, costPerMessage: 600, effectiveness: 15.0 }
  ];

  const singleRes = optimizeBudget(singleStore, {
    targetBudget: 300000, // +200%
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const solo = singleRes.optimizedItems[0];
  assert.strictEqual(solo.newBudget, 300000, `Tienda única absorbe el presupuesto objetivo si es elegible ($300,000, actual: ${solo.newBudget})`);
});

// =========================================================================
// VECTOR 10: Escaneo Masivo de Residuos (Cartera de 80 tiendas)
// =========================================================================
runTest('Escaneo Masivo: Reparto de $35.000 COP entre 80 tiendas sin fuga de un solo peso', () => {
  const stores80 = [];
  for (let i = 1; i <= 80; i++) {
    stores80.push({
      id: `store-${i}`,
      name: `Tienda ${i}`,
      currentBudget: 100000,
      costPerMessage: 600,
      effectiveness: 12.0 // Mismo rendimiento base para aislar el reparto residual puro
    });
  }

  // Base total = 80 * 100,000 = $8,000,000 COP
  // Target con excedente de exactamente $35.000 COP (7 pasos de $5.000)
  const target = 8035000;
  const res = optimizeBudget(stores80, {
    targetBudget: target,
    roundingStep: 5000,
    maxVariationPct: 35
  });

  const sumAllocated = res.optimizedItems.reduce((acc, it) => acc + it.newBudget, 0);
  assert.strictEqual(sumAllocated, target, `Asignación exacta de $8.035.000 COP con 80 tiendas (actual: ${sumAllocated})`);
  assert(res.optimizedItems.every(it => it.newBudget % 5000 === 0), 'Todas las 80 tiendas son múltiplos de $5.000 COP');

  // Exactamente 7 tiendas debieron recibir un paso adicional de +$5.000 ($105.000) y 73 permanecer en $100.000
  const increased = res.optimizedItems.filter(it => it.newBudget === 105000);
  const regular = res.optimizedItems.filter(it => it.newBudget === 100000);
  assert.strictEqual(increased.length, 7, `Exactamente 7 tiendas recibieron los 7 pasos de $5.000 (actual: ${increased.length})`);
  assert.strictEqual(regular.length, 73, `Las 73 tiendas restantes conservaron exactamente $100.000 (actual: ${regular.length})`);
});

console.log('\n=======================================================');
console.log(`🔥 RESUMEN PRUEBAS DE ESTRÉS: ${passedCount} de ${totalCount} pasadas`);
console.log('=======================================================\n');

if (passedCount < totalCount) {
  process.exit(1);
}
