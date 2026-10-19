import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cleanNumericValue,
  identifyColumns,
  parseDelimitedText,
  parseExcelWorkbook
} from '../src/utils/fileParser.js';
import { mergeExtractedMetrics } from '../src/utils/dataMerger.js';
import { getInitialCatalogPortfolio } from '../src/data/storeCatalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runFileParserTests() {
  console.log('🧪 Iniciando pruebas de parsing de archivos CSV y Excel...\n');
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

  // Test 1: Limpieza de formatos numéricos monetarios y porcentuales
  {
    assert(cleanNumericValue('$ 1.250.000') === 1250000, 'Limpia moneda colombiana con puntos ($ 1.250.000 -> 1250000)');
    assert(cleanNumericValue('$1,250,000.50') === 1250000.5, 'Limpia moneda anglosajona con comas ($1,250,000.50 -> 1250000.5)');
    assert(cleanNumericValue('15,5%') === 15.5, 'Limpia porcentaje con coma (15,5% -> 15.5)');
    assert(cleanNumericValue('22.8%') === 22.8, 'Limpia porcentaje con punto (22.8% -> 22.8)');
    assert(cleanNumericValue('  $ 850 COP ') === 850, 'Limpia sufijo COP y espacios ($ 850 COP -> 850)');
    assert(cleanNumericValue(null) === 0, 'Valores nulos retornan 0');
  }

  // Test 2: Identificación inteligente de encabezados
  {
    const headers = ['Nombre de la Campaña', 'Costo por resultado', 'Presupuesto Actual', 'Efectividad (%)', 'Trafiker'];
    const map = identifyColumns(headers);

    assert(map.name === 0, 'Detecta columna de nombre de tienda/campaña en índice 0');
    assert(map.costPerMessage === 1, 'Detecta costo por resultado en índice 1');
    assert(map.budget === 2, 'Detecta presupuesto actual en índice 2');
    assert(map.effectiveness === 3, 'Detecta efectividad % en índice 3');
    assert(map.trafiker === 4, 'Detecta trafiker en índice 4');
  }

  // Test 3: Parseo de CSV con coma (,)
  {
    const csvContent = `Tienda,Presupuesto,Costo x Mensaje,Mensajes
DRISTRI PRO 1,"$ 1,500,000",$ 1200,1250
DANTE NOVA,800000,950,842`;

    const result = parseDelimitedText(csvContent);

    assert(result.parsedItems.length === 2, 'Parsea exactamente 2 filas de tiendas en CSV por coma');
    assert(result.parsedItems[0].name === 'DRISTRI PRO 1', 'Reconoce nombre de tienda DRISTRI PRO 1');
    assert(result.parsedItems[0].currentBudget === 1500000, 'Extrae presupuesto limpio de $1,500,000');
    assert(result.parsedItems[0].costPerMessage === 1200, 'Extrae costo por mensaje de $1,200');
    assert(result.detectedType === 'COST', 'Identifica correctamente que el archivo es de tipo COST (sin efectividad)');
    assert(result.parsedItems[0].coordinator === 'GOMEZ', 'Enriquece con coordinador oficial del catálogo (GOMEZ)');
    assert(result.parsedItems[0].trafiker === 'Oscar', 'Enriquece con trafiker oficial del catálogo (Oscar)');
  }

  // Test 4: Parseo de CSV con punto y coma (;) y cálculo de efectividad derivada (cantadas / mensajes)
  {
    const csvSemiContent = `Fecha;Tienda;Mensajes;Cantadas
2026-10-14;LATIN SHOP;1000;140
2026-10-14;SURAE;500;75`;

    const result = parseDelimitedText(csvSemiContent);

    assert(result.parsedItems.length === 2, 'Parsea CSV delimitado por punto y coma (;)');
    assert(result.parsedItems[0].name === 'LATIN SHOP', 'Reconoce LATIN SHOP');
    assert(result.parsedItems[0].currentMessages === 1000, 'Extrae 1000 mensajes');
    // 140 / 1000 = 14.0%
    assert(result.parsedItems[0].effectiveness === 14.0, 'Calcula automáticamente efectividad derivada (140 / 1000 = 14.0%)');
    // 75 / 500 = 15.0%
    assert(result.parsedItems[1].effectiveness === 15.0, 'Calcula automáticamente efectividad de segunda tienda (75 / 500 = 15.0%)');
    assert(result.detectedType === 'EFFECTIVENESS', 'Identifica que el archivo es de tipo EFFECTIVENESS');
    assert(result.parsedItems[0].product === 'CAMISETAS', 'Asocia producto del catálogo (CAMISETAS)');
  }

  // Test 5: Parseo de libro Excel (.xlsx) en memoria
  {
    // Construir un workbook Excel en memoria
    const testData = [
      ['Tienda / Línea', 'Presupuesto', 'Costo por Mensaje', 'Efectividad (%)', 'Mensajes'],
      ['NOVA HOME', 1000000, 750, 18.5, 1333],
      ['TOP MARKET 4', 600000, 1100, 12.0, 545]
    ];

    const ws = XLSX.utils.aoa_to_sheet(testData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const result = parseExcelWorkbook(buffer);

    assert(result.parsedItems.length === 2, 'Parsea exitosamente libro Excel (.xlsx) de 2 filas');
    assert(result.parsedItems[0].name === 'NOVA HOME', 'Identifica NOVA HOME en Excel');
    assert(result.parsedItems[0].currentBudget === 1000000, 'Presupuesto correcto en Excel ($1,000,000)');
    assert(result.parsedItems[0].costPerMessage === 750, 'Costo x Mensaje correcto ($750)');
    assert(result.parsedItems[0].effectiveness === 18.5, 'Efectividad correcta (18.5%)');
    assert(result.detectedType === 'BOTH', 'Detecta que contiene tanto costo como efectividad (BOTH)');
    assert(result.parsedItems[1].product === 'CONJUNTOS CK', 'Enriquece TOP MARKET 4 con CONJUNTOS CK del catálogo');
  }

  // Test 6: Prioridad absoluta de datos subidos sobre datos previamente guardados
  {
    const savedPortfolio = [
      { id: 's1', name: 'DRISTRI PRO 1', currentBudget: 1000000, costPerMessage: 1200, effectiveness: 14.0, currentMessages: 833, trafiker: 'Julio' },
      { id: 's2', name: 'DANTE NOVA 3', currentBudget: 800000, costPerMessage: 1400, effectiveness: 20.0, currentMessages: 571, trafiker: 'Oscar' }
    ];

    // Archivo recién subido con datos frescos de hoy
    const newlyUploadedData = [
      { name: 'DRISTRI PRO 1', currentBudget: 1500000, costPerMessage: 950, effectiveness: 22.5, currentMessages: 1578, trafiker: 'Oscar' },
      { name: 'DANTE NOVA 3', effectiveness: 26.0 } // Solo actualiza efectividad
    ];

    // Fusión con BOTH
    const mergedBoth = mergeExtractedMetrics(savedPortfolio, newlyUploadedData, 'BOTH');
    const store1 = mergedBoth.find(it => it.name === 'DRISTRI PRO 1');
    const store2 = mergedBoth.find(it => it.name === 'DANTE NOVA 3');

    assert(store1.currentBudget === 1500000, 'Presupuesto nuevo ($1,500,000) tiene prioridad sobre el guardado ($1,000,000)');
    assert(store1.costPerMessage === 950, 'Costo nuevo ($950) tiene prioridad sobre el guardado ($1,200)');
    assert(store1.effectiveness === 22.5, 'Efectividad nueva (22.5%) tiene prioridad sobre la guardada (14.0%)');
    assert(store1.currentMessages === 1578, 'Mensajes nuevos (1578) tienen prioridad sobre los guardados (833)');
    assert(store1.trafiker === 'Oscar', 'Trafiker nuevo (Oscar) tiene prioridad sobre el previo (Julio)');

    assert(store2.effectiveness === 26.0, 'Efectividad nueva (26.0%) actualiza tienda 2');
    assert(store2.currentBudget === 800000, 'Conserva presupuesto previo de tienda 2 ($800,000) ya que el archivo no trajo presupuesto');
    assert(store2.costPerMessage === 1400, 'Conserva costo previo de tienda 2 ($1,400) ya que el archivo no trajo costo');
  }

  // Test 7: Resubida no destructiva - CSV de Costos preserva la efectividad previa
  {
    const initialPortfolio = [
      { id: 't1', name: 'DRISTRI PRO 1', currentBudget: 1000000, costPerMessage: 1200, effectiveness: 18.5, currentMessages: 833 }
    ];

    // CSV típico de Meta Ads que SOLO trae Costos y Presupuestos (sin efectividad)
    const costOnlyCsv = `Tienda,Presupuesto,Costo por resultado
DRISTRI PRO 1,1400000,750`;

    const parsedResult = parseDelimitedText(costOnlyCsv);
    assert(parsedResult.parsedItems[0].effectiveness === undefined, 'El parser no asigna 0 a la efectividad ausente');

    // Al fusionar con el portafolio
    const merged = mergeExtractedMetrics(initialPortfolio, parsedResult.parsedItems, 'BOTH');
    const store = merged.find(it => it.name === 'DRISTRI PRO 1');

    assert(store.currentBudget === 1400000, 'Presupuesto actualizado al nuevo ($1,400,000)');
    assert(store.costPerMessage === 750, 'Costo por resultado actualizado al nuevo ($750)');
    assert(store.effectiveness === 18.5, '¡CRUCIAL! La efectividad previa (18.5%) se preserva intacta y NO se resetea a 0%');
    assert(store.currentMessages === Math.round(1400000 / 750), 'Mensajes recalculados automáticamente');
  }

  // Test 8: getInitialCatalogPortfolio arranca con CPR en 0 y presupuesto en 0 para las 79 tiendas
  {
    const initialPortfolio = getInitialCatalogPortfolio();
    assert(initialPortfolio.length === 79, `El portafolio inicial pre-carga exactamente 79 tiendas del catálogo (actual: ${initialPortfolio.length})`);
    
    const allCprZero = initialPortfolio.every(s => s.costPerMessage === 0);
    assert(allCprZero, 'Todas las tiendas del catálogo arrancan con CPR (costPerMessage) exactamente en 0');

    const allBudgetZero = initialPortfolio.every(s => s.currentBudget === 0);
    assert(allBudgetZero, 'Todas las tiendas del catálogo arrancan con presupuesto en 0');

    const allHaveNames = initialPortfolio.every(s => typeof s.name === 'string' && s.name.length > 0);
    assert(allHaveNames, 'Todas las tiendas del catálogo tienen su nombre guardado para facilitar escaneo');
  }

  // Test 9: Ingesta y consolidación de CSV de tracking horario real (820 filas -> 85 tiendas consolidadas)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'tracking_820_rows.csv');
    assert(fs.existsSync(fixturePath), 'El archivo fixture de tracking 820 filas existe');

    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    assert(parsed.detectedType === 'EFFECTIVENESS', 'El tracking se clasifica como EFFECTIVENESS al tener mensajes y cantadas');
    assert(parsed.parsedItems.length === 85, `Consolida 820 filas horarias en exactamente 85 tiendas únicas (actual: ${parsed.parsedItems.length})`);

    // Verificar agregación de OUTFIT FACTORY 2: 168 mensajes, 7 cantadas -> 4.17%
    const outfit = parsed.parsedItems.find(it => it.name === 'OUTFIT FACTORY 2');
    assert(outfit !== undefined, 'OUTFIT FACTORY 2 fue consolidada');
    assert(outfit.currentMessages === 168, `OUTFIT FACTORY 2 suma 168 mensajes acumulados (actual: ${outfit?.currentMessages})`);
    assert(outfit.cantadas === 7, `OUTFIT FACTORY 2 suma 7 cantadas (actual: ${outfit?.cantadas})`);
    assert(outfit.effectiveness === 4.17, `Efectividad calculada exactamente (7/168 = 4.17%, actual: ${outfit?.effectiveness}%)`);

    // Verificar agregación de TOP MARKET 1: 47 mensajes, 8 cantadas -> 17.02%
    const topMarket = parsed.parsedItems.find(it => it.name === 'TOP MARKET 1');
    assert(topMarket !== undefined, 'TOP MARKET 1 fue consolidada');
    assert(topMarket.currentMessages === 47, `TOP MARKET 1 suma 47 mensajes (actual: ${topMarket?.currentMessages})`);
    assert(topMarket.cantadas === 8, `TOP MARKET 1 suma 8 cantadas (actual: ${topMarket?.cantadas})`);
    assert(topMarket.effectiveness === 17.02, `Efectividad calculada (8/47 = 17.02%, actual: ${topMarket?.effectiveness}%)`);

    // Detección de tiendas nuevas fuera del catálogo maestro
    const dynamicStores = parsed.parsedItems.filter(it => it.isDynamic);
    assert(dynamicStores.length > 0, `Se detectaron ${dynamicStores.length} tiendas dinámicas nuevas fuera del catálogo`);

    const hasSantaShop2W = dynamicStores.some(it => it.name === 'SANTA SHOP 2 W');
    const hasDanteNova2 = dynamicStores.some(it => it.name === 'DANTE NOVA 2');
    const hasRawstreet = dynamicStores.some(it => it.name === 'RAWSTREET 1');

    assert(hasSantaShop2W, 'Detecta dinámicamente SANTA SHOP 2 W fuera del catálogo');
    assert(hasDanteNova2, 'Detecta dinámicamente DANTE NOVA 2 fuera del catálogo');
    assert(hasRawstreet, 'Detecta dinámicamente RAWSTREET 1 fuera del catálogo');
  }

  // Test 10: Fusión de tracking sobre catálogo con CPR 0 añade tiendas dinámicas y preserva metadata
  {
    const initialCatalog = getInitialCatalogPortfolio();
    const fixturePath = path.join(__dirname, 'fixtures', 'tracking_820_rows.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    const mergedPortfolio = mergeExtractedMetrics(initialCatalog, parsed.parsedItems, 'EFFECTIVENESS');

    // Total de tiendas: 79 catálogo + 7 dinámicas nuevas = 86 tiendas totales
    assert(mergedPortfolio.length >= 85, `El portafolio final contiene todas las tiendas consolidadas (${mergedPortfolio.length} tiendas)`);

    const outfitInMerged = mergedPortfolio.find(it => it.name === 'OUTFIT FACTORY 2');
    assert(outfitInMerged.costPerMessage === 0, 'OUTFIT FACTORY 2 mantiene CPR en 0 hasta que se suba o asigne costo');
    assert(outfitInMerged.effectiveness === 4.17, 'OUTFIT FACTORY 2 adquiere su efectividad calculada (4.17%)');

    const santaShop2W = mergedPortfolio.find(it => it.name === 'SANTA SHOP 2 W');
    assert(santaShop2W !== undefined, 'La tienda dinámica SANTA SHOP 2 W está incorporada al portafolio');
    assert(santaShop2W.isDynamic === true, 'SANTA SHOP 2 W está marcada como dinámica');
  }

  console.log(`\nResultados File Parser: ${passed} pasadas, ${failed} fallidas`);
  if (failed > 0) process.exit(1);
}

runFileParserTests();
