import fs from 'fs';
import { findInCatalog } from '../src/data/storeCatalog.js';

// 1. Procesar Efectividad Histórica (12, 13, 14 de Octubre - ignorando el 15)
const effRaw = fs.readFileSync('src/data/userDataset.csv', 'utf8').trim().split('\n');
const effLines = effRaw.slice(1);

const effMap = {};

effLines.forEach(line => {
  if (!line.trim()) return;
  const parts = line.replace('\r', '').split(';');
  const date = parts[0].trim();
  
  // Ignorar el día 15 explícitamente a pedido del usuario
  if (date.startsWith('2026-10-15')) return;

  const name = parts[2].trim();
  const msgs = parseFloat(parts[12]) || 0;
  const cantadas = parseFloat(parts[17]) || 0;

  if (!effMap[name]) {
    effMap[name] = { totalMsgs: 0, totalCantadas: 0 };
  }

  effMap[name].totalMsgs += msgs;
  effMap[name].totalCantadas += cantadas;
});

const calculatedEff = {};
Object.entries(effMap).forEach(([name, data]) => {
  const eff = data.totalMsgs > 0 ? ((data.totalCantadas / data.totalMsgs) * 100) : 0;
  calculatedEff[name] = Number(eff.toFixed(2));
});

console.log('Efectividades calculadas (Oct 12-14):', Object.keys(calculatedEff).length, 'tiendas');

// 2. Procesar Datos de Hoy (16 de Octubre)
const todayRaw = fs.readFileSync('src/data/todayData.csv', 'utf8').trim().split('\n');
const todayLines = todayRaw.slice(1);

const categoryEffSum = {};
const categoryEffCount = {};

// Calcular promedios de efectividad por categoría para tiendas sin historial previo
Object.entries(calculatedEff).forEach(([name, eff]) => {
  const cat = findInCatalog(name)?.category || 'GENERAL';
  categoryEffSum[cat] = (categoryEffSum[cat] || 0) + eff;
  categoryEffCount[cat] = (categoryEffCount[cat] || 0) + 1;
});

const categoryAvgEff = {};
Object.keys(categoryEffSum).forEach(cat => {
  categoryAvgEff[cat] = Number((categoryEffSum[cat] / categoryEffCount[cat]).toFixed(2));
});

const mergedStores = [];

todayLines.forEach((line, idx) => {
  if (!line.trim()) return;
  const parts = line.replace('\r', '').split(',');
  if (parts.length < 16) return;

  const name = parts[2].trim();
  if (!name || name === 'TOTAL' || !parts[12]) return;

  const budget = parseFloat(parts[12]) || 0;
  const spend = parseFloat(parts[13]) || 0;
  const msgs = parseFloat(parts[14]) || 0;
  const cxm = parseFloat(parts[15]) || (msgs > 0 ? spend / msgs : 800);
  const rawProduct = parts[8]?.trim();

  const catalogMatch = findInCatalog(name);
  const category = catalogMatch ? catalogMatch.category : (rawProduct || 'GENERAL');

  // Buscar efectividad histórica de Oct 12-14
  let effectiveness = calculatedEff[name];
  if (effectiveness === undefined && catalogMatch) {
    effectiveness = calculatedEff[catalogMatch.name];
  }
  
  // Si no tenía historial en los 3 días anteriores, usar el promedio de su categoría
  let hasHistorical = true;
  if (effectiveness === undefined || effectiveness === null) {
    effectiveness = categoryAvgEff[category] || 8.0;
    hasHistorical = false;
  }

  mergedStores.push({
    id: `today-${idx + 1}`,
    name: catalogMatch ? catalogMatch.name : name,
    category,
    currentBudget: budget > 0 ? budget : 100000,
    costPerMessage: Number(cxm.toFixed(2)),
    effectiveness: Number(effectiveness.toFixed(2)),
    currentMessages: msgs > 0 ? Math.round(msgs) : Math.round(budget / cxm),
    todaySpend: Math.round(spend),
    hasHistorical
  });
});

console.log('Tiendas activas de hoy procesadas y fusionadas:', mergedStores.length);

// Guardar en src/data/realTrackingDataset.js
const fileContent = `/**
 * Dataset consolidado en tiempo real con datos de HOY (16-10-2026) y efectividad histórica (Oct 12-14)
 */
export const REAL_TRACKING_DATASET = ${JSON.stringify(mergedStores, null, 2)};
`;

fs.writeFileSync('src/data/realTrackingDataset.js', fileContent, 'utf8');
console.log('✅ Archivo src/data/realTrackingDataset.js actualizado exitosamente.');
