import { optimizeBudget } from '../src/utils/optimizer.js';
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


  // Test 11: Detección y parsing automático de reporte matricial horario (tblMatriz con 223 columnas y 73 tiendas)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'tblMatriz_sample.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    assert(parsed.detectedType === 'EFFECTIVENESS', 'Reporte matricial se clasifica automáticamente como EFFECTIVENESS');
    assert(parsed.parsedItems.length === 73, `Extrae exactamente 73 tiendas del reporte matricial (actual: ${parsed.parsedItems.length})`);

    // Limpieza de prefijos telefónicos (ej: '3105219787 · OUTFIT FACTORY 3' -> 'OUTFIT FACTORY 3')
    const outfit3 = parsed.parsedItems.find(it => it.name === 'OUTFIT FACTORY 3');
    assert(outfit3 !== undefined, 'Encuentra OUTFIT FACTORY 3 con prefijo telefónico limpiado');
    assert(outfit3.currentMessages === 129, `OUTFIT FACTORY 3 tiene 129 mensajes (actual: ${outfit3?.currentMessages})`);
    assert(outfit3.cantadas === 6, `OUTFIT FACTORY 3 tiene 6 ventas cantadas (actual: ${outfit3?.cantadas})`);
    assert(outfit3.effectiveness === 4.65, `OUTFIT FACTORY 3 tiene efectividad 4.65% (actual: ${outfit3?.effectiveness}%)`);
    assert(outfit3.coordinator === 'ALEJANDRA', `OUTFIT FACTORY 3 se mapea a la coordinadora oficial ALEJANDRA (actual: ${outfit3?.coordinator})`);

    // Control de anomalía: Ventas sin mensajes (ej: DISMERCA COLOMBIA con 0 msgs y 6 ventas)
    const dismerca = parsed.parsedItems.find(it => it.name === 'DISMERCA COLOMBIA');
    assert(dismerca !== undefined, 'Encuentra DISMERCA COLOMBIA');
    assert(dismerca.cantadas === 6, 'DISMERCA COLOMBIA registra 6 cantadas');
    assert(dismerca.currentMessages === 6, `DISMERCA COLOMBIA imputa mensajes = ventas (6) para evitar división por cero (actual: ${dismerca?.currentMessages})`);
    assert(dismerca.effectiveness === 100.0, `DISMERCA COLOMBIA tiene efectividad 100.0% (actual: ${dismerca?.effectiveness}%)`);

    // Control de anomalía: Outlier de efectividad > 100% (ej: STYLE TRENDS 1 con 1 msg y 2 ventas = 200%)
    const styleTrends = parsed.parsedItems.find(it => it.name === 'STYLE TRENDS 1');
    assert(styleTrends !== undefined, 'Encuentra STYLE TRENDS 1');
    assert(styleTrends.cantadas === 2, 'STYLE TRENDS 1 registra 2 ventas');
    assert(styleTrends.effectiveness === 100.0, `STYLE TRENDS 1 capa efectividad anormal a 100% (actual: ${styleTrends?.effectiveness}%)`);

    // Tiendas dinámicas fuera del catálogo (debe detectar las 4 tiendas no listadas en los 79 iniciales)
    const dynamicStores = parsed.parsedItems.filter(it => it.isDynamic);
    assert(dynamicStores.length === 4, `Detecta exactamente 4 tiendas dinámicas fuera del catálogo (actual: ${dynamicStores.length})`);
    assert(dynamicStores.some(it => it.name === 'LOOK CENTRAL 2'), 'LOOK CENTRAL 2 detectada como dinámica');
    assert(dynamicStores.some(it => it.name === 'OUTFIT FACTORY'), 'OUTFIT FACTORY detectada como dinámica');
    assert(dynamicStores.some(it => it.name === 'DANTE NOVA 4'), 'DANTE NOVA 4 detectada como dinámica');
    assert(dynamicStores.some(it => it.name === 'AGORA SALON'), 'AGORA SALON detectada como dinámica');
  }

  // Test 12: Fusión de reporte matricial con portafolio inicial de catálogo oficial
  {
    const initialCatalog = getInitialCatalogPortfolio();
    const fixturePath = path.join(__dirname, 'fixtures', 'tblMatriz_sample.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    const mergedPortfolio = mergeExtractedMetrics(initialCatalog, parsed.parsedItems, 'EFFECTIVENESS');

    // 79 del catálogo + 4 dinámicas = 83 tiendas únicas sin duplicados
    assert(mergedPortfolio.length === 83, `Portafolio fusionado contiene exactamente 83 tiendas sin duplicados (actual: ${mergedPortfolio.length})`);

    // Verificar que OUTFIT FACTORY 3 fusionó métricas y conservó cantadas
    const outfitInMerged = mergedPortfolio.find(it => it.name === 'OUTFIT FACTORY 3');
    assert(outfitInMerged !== undefined, 'OUTFIT FACTORY 3 existe en el portafolio fusionado');
    assert(outfitInMerged.cantadas === 6, `OUTFIT FACTORY 3 conserva cantadas = 6 (actual: ${outfitInMerged?.cantadas})`);
    assert(outfitInMerged.currentMessages === 129, `OUTFIT FACTORY 3 conserva currentMessages = 129 (actual: ${outfitInMerged?.currentMessages})`);
    assert(outfitInMerged.effectiveness === 4.65, `OUTFIT FACTORY 3 conserva efectividad 4.65% (actual: ${outfitInMerged?.effectiveness}%)`);
    assert(outfitInMerged.coordinator === 'ALEJANDRA', 'OUTFIT FACTORY 3 conserva su coordinadora oficial ALEJANDRA');

    // Verificar que las 4 tiendas dinámicas fueron incorporadas con CPR en 0
    const agoraSalon = mergedPortfolio.find(it => it.name === 'AGORA SALON');
    assert(agoraSalon !== undefined, 'AGORA SALON se incorporó al portafolio');
    assert(agoraSalon.isDynamic === true, 'AGORA SALON está marcada como dinámica');
    assert(agoraSalon.costPerMessage === 0, 'AGORA SALON inicia con CPR en 0');
    assert(agoraSalon.cantadas === 1, `AGORA SALON conserva su venta cantada (actual: ${agoraSalon?.cantadas})`);
  }

  // Test 13: Parsing de Reporte Semanal Pivot Maestro (7 días, 65 columnas, $81.2M COP)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'reporte_semana_pivot.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    assert(parsed.detectedType === 'BOTH', 'Reporte semanal pivot se clasifica automáticamente como BOTH (trae gasto, costo y efectividad)');
    assert(parsed.parsedItems.length === 88, `Extrae exactamente 88 tiendas únicas consolidadas (actual: ${parsed.parsedItems.length})`);

    const totalGasto = parsed.parsedItems.reduce((acc, it) => acc + it.currentBudget, 0);
    const totalMsgs = parsed.parsedItems.reduce((acc, it) => acc + it.currentMessages, 0);
    const totalCantadas = parsed.parsedItems.reduce((acc, it) => acc + it.cantadas, 0);

    assert(totalGasto === 81226188, `Gasto total consolidado cuadra exactamente ($81,226,188 COP, actual: ${totalGasto})`);
    assert(totalMsgs === 106622, `Mensajes totales consolidados cuadran exactamente (106,622 msgs, actual: ${totalMsgs})`);
    assert(totalCantadas === 8429, `Cantadas totales consolidadas cuadran exactamente (8,429 ventas, actual: ${totalCantadas})`);

    // Limpieza de sufijos telefónicos en paréntesis: 'NET CAPITAL 3 (3117983168)' -> 'NET CAPITAL 3'
    const netCapital3 = parsed.parsedItems.find(it => it.name === 'NET CAPITAL 3');
    assert(netCapital3 !== undefined, 'Encuentra NET CAPITAL 3 con teléfono entre paréntesis limpiado');
    assert(netCapital3.currentBudget === 1228916, `NET CAPITAL 3 tiene presupuesto $1,228,916 (actual: ${netCapital3?.currentBudget})`);
    assert(netCapital3.costPerMessage === 617.24, `NET CAPITAL 3 tiene CPM $617.24 (actual: ${netCapital3?.costPerMessage})`);
    assert(netCapital3.effectiveness === 10.75, `NET CAPITAL 3 tiene efectividad 10.75% (actual: ${netCapital3?.effectiveness}%)`);
    assert(netCapital3.category === 'CAMISETAS', `NET CAPITAL 3 extrae categoría CAMISETAS del árbol (actual: ${netCapital3?.category})`);
    assert(netCapital3.bpo === 'BTK', `NET CAPITAL 3 extrae BPO BTK del árbol (actual: ${netCapital3?.bpo})`);
    assert(netCapital3.coordinator === 'ALEJANDRA', `NET CAPITAL 3 asocia coordinadora ALEJANDRA del catálogo (actual: ${netCapital3?.coordinator})`);
  }

  // Test 14: Parsing de Reporte Multidía Pivot (8 días, 73 columnas, $95.6M COP)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'reporte_8dias_pivot.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    assert(parsed.detectedType === 'BOTH', 'Reporte multidía pivot se clasifica como BOTH');
    assert(parsed.parsedItems.length === 89, `Extrae exactamente 89 tiendas únicas consolidadas (actual: ${parsed.parsedItems.length})`);

    const totalGasto = parsed.parsedItems.reduce((acc, it) => acc + it.currentBudget, 0);
    const totalMsgs = parsed.parsedItems.reduce((acc, it) => acc + it.currentMessages, 0);
    const totalCantadas = parsed.parsedItems.reduce((acc, it) => acc + it.cantadas, 0);

    assert(totalGasto === 95626552, `Gasto total de 8 días cuadra exactamente ($95,626,552 COP, actual: ${totalGasto})`);
    assert(totalMsgs === 125471, `Mensajes de 8 días cuadran exactamente (125,471 msgs, actual: ${totalMsgs})`);
    assert(totalCantadas === 9860, `Cantadas de 8 días cuadran exactamente (9,860 ventas, actual: ${totalCantadas})`);

    // Consolidación de tiendas repetidas en campañas + orgánico (ej: Clothesnew)
    const clothesnew = parsed.parsedItems.find(it => it.name.toLowerCase() === 'clothesnew');
    assert(clothesnew !== undefined, 'Clothesnew consolidada correctamente');
    assert(clothesnew.cantadas === 242, `Clothesnew suma ventas publicitarias y orgánicas (240 + 2 = 242, actual: ${clothesnew?.cantadas})`);
  }

  // Test 15: Optimización End-to-End sobre datos del reporte semanal pivot (subidas, bajadas y redondeo a miles)
  {
    const fixturePath = path.join(__dirname, 'fixtures', 'reporte_semana_pivot.csv');
    const csvContent = fs.readFileSync(fixturePath, 'utf-8');
    const parsed = parseDelimitedText(csvContent);

    const optResult = optimizeBudget(parsed.parsedItems, {
      roundingStep: 1000,
      minEffectivenessThreshold: 8.0,
      maxVariationPct: 50
    });

    const increases = optResult.optimizedItems.filter(it => it.status === 'INCREASE');
    const decreases = optResult.optimizedItems.filter(it => it.status === 'DECREASE');
    const blocked = optResult.optimizedItems.filter(it => it.status === 'BLOCKED_LOW_EFF');

    assert(increases.length > 0, `Genera subidas automáticas para tiendas ganadoras (${increases.length} tiendas)`);
    assert(decreases.length > 0, `Genera bajadas automáticas para tiendas con costo alto o rendimiento inferior (${decreases.length} tiendas)`);
    assert(blocked.length > 0, `Protege tiendas por debajo del 8% de efectividad evitando aumentos (${blocked.length} tiendas)`);

    // Verificar redondeo estricto a múltiplos de $1,000 sin decimales
    const allCleanThousands = optResult.optimizedItems.every(it => it.newBudget % 1000 === 0 && Number.isInteger(it.newBudget));
    assert(allCleanThousands, 'Todos los presupuestos asignados son múltiplos exactos de $1,000 COP sin centavos');

    // Comprobar que NET CAPITAL 3 (alta efectividad 10.75% y bajo CPM $617) recibe inyección de presupuesto
    const nc3Opt = optResult.optimizedItems.find(it => it.name === 'NET CAPITAL 3');
    assert(nc3Opt.status === 'INCREASE', 'NET CAPITAL 3 es calificada con Inyectar Presupuesto (INCREASE)');
    assert(nc3Opt.newBudget > nc3Opt.currentBudget, `NET CAPITAL 3 incrementa presupuesto (${nc3Opt.currentBudget} -> ${nc3Opt.newBudget})`);
  }

  console.log(`\nResultados File Parser: ${passed} pasadas, ${failed} fallidas`);
  if (failed > 0) process.exit(1);
}

runFileParserTests();
