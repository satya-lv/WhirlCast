const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);

    const MONTHS_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
    const MONTHS_HIST = ['07-2025','08-2025','09-2025','10-2025','11-2025','12-2025'];
    const ALL_MONTHS = [...MONTHS_HIST, ...MONTHS_FWD];

    const branchAccuracy = { 'Mumbai':91,'Bangalore':89,'Pune':88,'New Delhi':85,'Hyderabad':83,'Kolkata':81,'Chennai':79,'Ahmedabad':78 };

    // Trend chart data
    const trendData = ALL_MONTHS.map((month, i) => {
      const actual = db.prepare(`SELECT SUM(value) as t FROM forecast_runs WHERE cycle_id=? AND month=? AND scenario_id=?`).get(cycle.cycle_id, month, scenario?.scenario_id);
      const isFuture = i >= MONTHS_HIST.length;
      const baseActual = actual?.t || 0;
      return {
        month,
        actual: isFuture ? null : Math.round(baseActual * (0.92 + Math.random() * 0.08)),
        ai_forecast: Math.round(baseActual),
        after_overrides: Math.round(baseActual * (1 + Math.random() * 0.05)),
        is_future: isFuture,
      };
    });

    // Future forecast table
    const futureForecast = db.prepare(`SELECT branch, sku, month, value, demand_sensing_adjusted FROM forecast_runs WHERE cycle_id=? AND scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026') ORDER BY branch, sku`).all(cycle.cycle_id, scenario?.scenario_id);

    // Historical performance (Dec 2025)
    const histPerf = db.prepare(`SELECT branch, sku, value FROM forecast_runs WHERE cycle_id=? AND month='12-2025' AND scenario_id=?`).all(cycle.cycle_id, scenario?.scenario_id);
    const perfData = histPerf.map(r => {
      const acc = branchAccuracy[r.branch] || 82;
      const variance = (Math.random() * 10 - 5);
      const actual = Math.round(r.value * (1 - variance / 100));
      const bias = parseFloat((variance / 2).toFixed(1));
      return {
        branch: r.branch, sku: r.sku, month: '12-2025',
        actual, ai_forecast: r.value,
        override: Math.round(r.value * 1.02), final: actual,
        accuracy: Math.min(99, acc + Math.round(Math.random() * 4 - 2)),
        bias,
      };
    });

    const sid = scenario?.scenario_id;

    const india_total = sid ? db.prepare(
      `SELECT month, SUM(value) as value FROM forecast_runs WHERE scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026') GROUP BY month ORDER BY month`
    ).all(sid) : [];

    const by_category = sid ? db.prepare(
      `SELECT pm.category, fr.month, SUM(fr.value) as value FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.scenario_id=? AND fr.month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026') GROUP BY pm.category, fr.month ORDER BY pm.category, fr.month`
    ).all(sid) : [];

    const by_branch = sid ? db.prepare(
      `SELECT branch, month, SUM(value) as value FROM forecast_runs WHERE scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026') GROUP BY branch, month ORDER BY branch, month`
    ).all(sid) : [];

    const by_branch_sku = sid ? db.prepare(
      `SELECT branch, sku, month, value FROM forecast_runs WHERE scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026') ORDER BY branch, sku, month`
    ).all(sid) : [];

    db.close();
    res.json({
      kpis: {
        totalUnits: scenario?.total_units || 124850,
        accuracy: scenario?.accuracy || 87.3,
        bias: scenario?.bias || 3.6,
        revenue: 148.2,
        unitsTrend: 8.2,
        accuracyTrend: -1.2,
        biasTrend: -0.6,
        revenueTrend: 11.4,
      },
      trendData,
      branchAccuracy: Object.entries(branchAccuracy).map(([branch, acc]) => ({ branch, accuracy: acc })).sort((a, b) => b.accuracy - a.accuracy),
      categoryMix: [
        { name: 'Air Conditioner', value: 32, color: '#1B3A6B' },
        { name: 'Refrigerator', value: 28, color: '#E31837' },
        { name: 'Washing Machine', value: 24, color: '#16A34A' },
        { name: 'Microwave', value: 10, color: '#D97706' },
        { name: 'Induction', value: 6, color: '#7C3AED' },
      ],
      futureForecast,
      perfData,
      india_total,
      by_category,
      by_branch,
      by_branch_sku,
      cycle,
      scenario,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/export', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const runs = db.prepare(`SELECT branch, sku, category, month, value FROM forecast_runs WHERE cycle_id=? AND scenario_id=? ORDER BY branch, sku, month`).all(cycle.cycle_id, scenario?.scenario_id);

    const header = 'Branch,SKU,Category,Month,Forecast Units\n';
    const rows = runs.map(r => `${r.branch},${r.sku},${r.category},${r.month},${r.value}`).join('\n');
    db.close();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="DemandIQ_Forecast_May2026.csv"`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
