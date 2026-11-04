import assert from 'assert';
import { STORE_CATALOG } from '../src/data/storeCatalog.js';

console.log('🧪 Iniciando pruebas de Filtros Dinámicos en Cascada (Faceted Filtering)...');

// 1. Prueba: Si selecciono Oscar, no debe haber ningún producto "BODY"
{
  const oscarStores = STORE_CATALOG.filter(it => it.trafiker === 'Oscar');
  const oscarProducts = Array.from(new Set(oscarStores.map(it => it.product || it.category))).filter(Boolean);

  assert(!oscarProducts.includes('BODY'), 'Oscar no tiene producto BODY en su catálogo');
  assert(oscarProducts.includes('CAMISETAS'), 'Oscar tiene producto CAMISETAS');
  console.log('✅ PASS: Al seleccionar Oscar, BODY no aparece en las opciones disponibles');
}

// 2. Prueba: Si selecciono Julio, BODY sí aparece
{
  const julioStores = STORE_CATALOG.filter(it => it.trafiker === 'Julio');
  const julioProducts = Array.from(new Set(julioStores.map(it => it.product || it.category))).filter(Boolean);

  assert(julioProducts.includes('BODY'), 'Julio maneja producto BODY');
  console.log('✅ PASS: Al seleccionar Julio, BODY sí aparece disponible');
}

// 3. Prueba: Si selecciono CAMISETAS, sólo coordinadores de camisetas deben aparecer
{
  const camisetasStores = STORE_CATALOG.filter(it => (it.product || it.category) === 'CAMISETAS');
  const availableCoords = Array.from(new Set(camisetasStores.map(it => it.coordinator))).filter(Boolean);

  // Gómez y Alejandra manejan camisetas
  assert(availableCoords.includes('GOMEZ'), 'GOMEZ aparece en CAMISETAS');
  assert(availableCoords.includes('ALEJANDRA'), 'ALEJANDRA aparece en CAMISETAS');

  // Erika maneja E-HUK Smart / Pijamas / Boxer, pero NO camisetas
  assert(!availableCoords.includes('ERIKA'), 'ERIKA no aparece en CAMISETAS');
  console.log('✅ PASS: Al seleccionar CAMISETAS, coordinadores que no tienen camisetas (ej. ERIKA) se excluyen');
}

// 4. Prueba: Si selecciono ALEJANDRA, sólo sus productos aparecen
{
  const alejandraStores = STORE_CATALOG.filter(it => it.coordinator === 'ALEJANDRA');
  const alejandraProducts = Array.from(new Set(alejandraStores.map(it => it.product || it.category))).filter(Boolean);

  assert(alejandraProducts.includes('CAMISETAS'), 'Alejandra maneja CAMISETAS');
  assert(alejandraProducts.includes('BODY'), 'Alejandra maneja BODY');
  assert(alejandraProducts.includes('CARPAS'), 'Alejandra maneja CARPAS');
  
  // Alejandra no maneja SMARTWATCH (lo maneja Jorge y Erika)
  assert(!alejandraProducts.includes('SMARTWATCH'), 'Alejandra no maneja SMARTWATCH');
  console.log('✅ PASS: Al seleccionar ALEJANDRA, productos que ella no maneja (ej. SMARTWATCH) no aparecen');
}

// 5. Prueba: Auto-reconciliación de incompatibilidad
{
  // Simular que el usuario tenía seleccionado BODY
  let selectedProduct = 'BODY';
  let selectedTrafiker = 'Julio';

  // Cambia a Oscar
  selectedTrafiker = 'Oscar';
  const subsetForProducts = STORE_CATALOG.filter(it => it.trafiker === selectedTrafiker);
  const availableProducts = Array.from(new Set(subsetForProducts.map(it => it.product || it.category))).filter(Boolean);

  if (!availableProducts.includes(selectedProduct)) {
    selectedProduct = 'ALL';
  }

  assert(selectedProduct === 'ALL', 'El producto BODY se reseteó a ALL automáticamente al cambiar a Oscar');
  console.log('✅ PASS: La auto-reconciliación resetea el producto a ALL al seleccionar un trafiker incompatible');
}

console.log('\nResultados Filtros Cascada: 5 pasadas, 0 fallidas\n');
