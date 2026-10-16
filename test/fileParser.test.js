import * as XLSX from 'xlsx';
import {
  cleanNumericValue,
  identifyColumns,
  parseDelimitedText,
  parseExcelWorkbook
} from '../src/utils/fileParser.js';

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

  console.log(`\nResultados File Parser: ${passed} pasadas, ${failed} fallidas`);
  if (failed > 0) process.exit(1);
}

runFileParserTests();
