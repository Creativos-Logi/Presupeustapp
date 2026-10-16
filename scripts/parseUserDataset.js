import fs from 'fs';

const raw = fs.readFileSync('src/data/userDataset.csv', 'utf8').trim().split('\n');
const headers = raw[0].replace('\r', '').split(';');

const lines = raw.slice(1);
const stores = {};

lines.forEach(lineStr => {
  if (!lineStr.trim()) return;
  const parts = lineStr.replace('\r', '').split(';');
  const date = parts[0];
  const name = parts[2].trim();
  const category = parts[8].trim();
  const budget = parseFloat(parts[10]) || 0;
  const spend = parseFloat(parts[11]) || 0;
  const msgs = parseFloat(parts[12]) || 0;
  const cantadas = parseFloat(parts[17]) || 0;
  const cargadas = parseFloat(parts[18]) || 0;

  if (!stores[name]) {
    stores[name] = {
      name,
      category,
      totalSpend: 0,
      totalBudget: 0,
      totalMsgs: 0,
      totalCantadas: 0,
      totalCargadas: 0,
      dailyEffs: []
    };
  }

  stores[name].totalSpend += spend;
  stores[name].totalBudget += budget;
  stores[name].totalMsgs += msgs;
  stores[name].totalCantadas += cantadas;
  stores[name].totalCargadas += cargadas;

  if (msgs > 0) {
    const dailyEff = (cantadas / msgs) * 100;
    stores[name].dailyEffs.push(dailyEff);
  }
});

const result = Object.values(stores).map(s => {
  const avgCpm = s.totalMsgs > 0 ? (s.totalSpend / s.totalMsgs) : 0;
  // Efectividad Total = (Total cantadas / Total mensajes) * 100
  const totalEff = s.totalMsgs > 0 ? ((s.totalCantadas / s.totalMsgs) * 100) : 0;
  const avgDailyEff = s.dailyEffs.length > 0 
    ? (s.dailyEffs.reduce((a, b) => a + b, 0) / s.dailyEffs.length)
    : 0;

  return {
    name: s.name,
    category: s.category,
    totalBudget: Math.round(s.totalBudget / 3), // promedio diario o gasto
    totalSpend: Math.round(s.totalSpend),
    totalMsgs: s.totalMsgs,
    costPerMessage: Number(avgCpm.toFixed(2)),
    totalCantadas: s.totalCantadas,
    totalCargadas: s.totalCargadas,
    totalEff: Number(totalEff.toFixed(2)),
    avgDailyEff: Number(avgDailyEff.toFixed(2))
  };
});

console.log(JSON.stringify(result, null, 2));
