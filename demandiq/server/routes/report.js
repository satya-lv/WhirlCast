const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

const BRANCH_ACC_FULL = {
  'Mumbai':    { acc:91, bias:2.3 }, 'New Delhi': { acc:85, bias:6.9 },
  'Kolkata':   { acc:81, bias:8.2 }, 'Chennai':   { acc:79, bias:9.1 },
  'Bangalore': { acc:89, bias:3.4 }, 'Hyderabad': { acc:83, bias:5.8 },
  'Pune':      { acc:88, bias:3.8 }, 'Ahmedabad': { acc:78, bias:4.5 },
};

const CAT_OFFSET = {
  'Air Conditioner':          { acc: -2.0 },
  'Direct Cool Refrigerator': { acc:  1.5 },
  'Frost Free Refrigerator':  { acc: -0.5 },
  'Washing Machine':          { acc:  2.0 },
  'Microwave':                { acc: -3.5 },
  'Induction':                { acc: -5.0 },
};

const CAT_COLORS_LIST = ['#1B3A6B','#E31837','#16A34A','#D97706','#7C3AED','#0891B2'];
const FWD_IN = `'06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'`;

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const bf = req.query.branch || null;

    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const sid = scenario?.scenario_id;

    const MONTHS_FWD  = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
    const MONTHS_HIST = ['07-2025','08-2025','09-2025','10-2025','11-2025','12-2025'];

    /* Trend chart */
    const trendData = [...MONTHS_HIST, ...MONTHS_FWD].map((month, i) => {
      const row = bf
        ? db.prepare(`SELECT SUM(value) as t FROM forecast_runs WHERE cycle_id=? AND month=? AND scenario_id=? AND branch=?`).get(cycle.cycle_id, month, sid, bf)
        : db.prepare(`SELECT SUM(value) as t FROM forecast_runs WHERE cycle_id=? AND month=? AND scenario_id=?`).get(cycle.cycle_id, month, sid);
      const isFuture = i >= MONTHS_HIST.length;
      const base = row?.t || 0;
      return {
        month,
        actual:          isFuture ? null : Math.round(base * (0.92 + Math.random() * 0.08)),
        ai_forecast:     Math.round(base),
        after_overrides: Math.round(base * (1 + Math.random() * 0.05)),
        is_future:       isFuture,
      };
    });

    /* Future forecast rows */
    const futureForecast = sid ? (bf
      ? db.prepare(`SELECT fr.branch, fr.sku, pm.category, pm.segment, pm.subsegment, fr.month, fr.value, fr.demand_sensing_adjusted FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.cycle_id=? AND fr.scenario_id=? AND fr.branch=? AND fr.month IN (${FWD_IN}) ORDER BY fr.sku`).all(cycle.cycle_id, sid, bf)
      : db.prepare(`SELECT fr.branch, fr.sku, pm.category, pm.segment, pm.subsegment, fr.month, fr.value, fr.demand_sensing_adjusted FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.cycle_id=? AND fr.scenario_id=? AND fr.month IN (${FWD_IN}) ORDER BY fr.branch, fr.sku`).all(cycle.cycle_id, sid)
    ) : [];

    /* Historical perf (Dec 2025) */
    const histPerf = sid ? (bf
      ? db.prepare(`SELECT branch, sku, value FROM forecast_runs WHERE cycle_id=? AND month='12-2025' AND scenario_id=? AND branch=?`).all(cycle.cycle_id, sid, bf)
      : db.prepare(`SELECT branch, sku, value FROM forecast_runs WHERE cycle_id=? AND month='12-2025' AND scenario_id=?`).all(cycle.cycle_id, sid)
    ) : [];
    const perfData = histPerf.map(r => {
      const acc = BRANCH_ACC_FULL[r.branch]?.acc || 82;
      const variance = (Math.random() * 10 - 5);
      return {
        branch: r.branch, sku: r.sku, month: '12-2025',
        actual:      Math.round(r.value * (1 - variance / 100)),
        ai_forecast: r.value,
        override:    Math.round(r.value * 1.02),
        final:       Math.round(r.value * (1 - variance / 100)),
        accuracy:    Math.min(99, acc + Math.round(Math.random() * 4 - 2)),
        bias:        parseFloat((variance / 2).toFixed(1)),
      };
    });

    /* Aggregates */
    const india_total = sid ? (bf
      ? db.prepare(`SELECT month, SUM(value) as value FROM forecast_runs WHERE scenario_id=? AND branch=? AND month IN (${FWD_IN}) GROUP BY month ORDER BY month`).all(sid, bf)
      : db.prepare(`SELECT month, SUM(value) as value FROM forecast_runs WHERE scenario_id=? AND month IN (${FWD_IN}) GROUP BY month ORDER BY month`).all(sid)
    ) : [];

    const by_category = sid ? (bf
      ? db.prepare(`SELECT pm.category, fr.month, SUM(fr.value) as value FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.scenario_id=? AND fr.branch=? AND fr.month IN (${FWD_IN}) GROUP BY pm.category, fr.month ORDER BY pm.category, fr.month`).all(sid, bf)
      : db.prepare(`SELECT pm.category, fr.month, SUM(fr.value) as value FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.scenario_id=? AND fr.month IN (${FWD_IN}) GROUP BY pm.category, fr.month ORDER BY pm.category, fr.month`).all(sid)
    ) : [];

    const by_branch = sid ? (bf
      ? db.prepare(`SELECT branch, month, SUM(value) as value FROM forecast_runs WHERE scenario_id=? AND branch=? AND month IN (${FWD_IN}) GROUP BY branch, month ORDER BY branch, month`).all(sid, bf)
      : db.prepare(`SELECT branch, month, SUM(value) as value FROM forecast_runs WHERE scenario_id=? AND month IN (${FWD_IN}) GROUP BY branch, month ORDER BY branch, month`).all(sid)
    ) : [];

    const by_branch_sku = sid ? (bf
      ? db.prepare(`SELECT fr.branch, fr.sku, pm.category, pm.segment, pm.subsegment, fr.month, fr.value FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.scenario_id=? AND fr.branch=? AND fr.month IN (${FWD_IN}) ORDER BY fr.sku, fr.month`).all(sid, bf)
      : db.prepare(`SELECT fr.branch, fr.sku, pm.category, pm.segment, pm.subsegment, fr.month, fr.value FROM forecast_runs fr JOIN product_master pm ON fr.sku=pm.sku WHERE fr.scenario_id=? AND fr.month IN (${FWD_IN}) ORDER BY fr.branch, fr.sku, fr.month`).all(sid)
    ) : [];

    const overrides = bf
      ? db.prepare(`SELECT branch, sku, month, override_value FROM branch_overrides WHERE cycle_id=? AND branch=? AND override_value IS NOT NULL`).all(cycle.cycle_id, bf)
      : db.prepare(`SELECT branch, sku, month, override_value FROM branch_overrides WHERE cycle_id=? AND override_value IS NOT NULL`).all(cycle.cycle_id);

    /* KPIs — compute from actual data when branch-filtered */
    const kpis = bf ? (() => {
      const products = db.prepare(`SELECT sku, price FROM product_master WHERE active=1`).all();
      const priceMap = {};
      for (const p of products) priceMap[p.sku] = p.price || 20000;
      const totalUnits = by_branch_sku.reduce((s, r) => s + (r.value || 0), 0);
      const revenue    = parseFloat((by_branch_sku.reduce((s, r) => s + (r.value || 0) * priceMap[r.sku], 0) / 1e7).toFixed(1));
      const brInfo     = BRANCH_ACC_FULL[bf] || { acc: 87, bias: 5 };
      return { totalUnits, accuracy: brInfo.acc, bias: brInfo.bias, revenue, unitsTrend:8.2, accuracyTrend:-1.2, biasTrend:-0.6, revenueTrend:11.4 };
    })() : {
      totalUnits: scenario?.total_units || 124850, accuracy: scenario?.accuracy || 87.3,
      bias: scenario?.bias || 3.6, revenue: 148.2,
      unitsTrend:8.2, accuracyTrend:-1.2, biasTrend:-0.6, revenueTrend:11.4,
    };

    /* Accuracy by category for the filtered branch */
    const categoryAccuracy = bf ? (() => {
      const cats = [...new Set(by_branch_sku.map(r => r.category).filter(Boolean))].sort();
      const base  = BRANCH_ACC_FULL[bf] || { acc: 85 };
      return cats.map(cat => ({
        category: cat,
        accuracy: parseFloat(Math.min(95, Math.max(70, base.acc + (CAT_OFFSET[cat]?.acc || 0))).toFixed(1)),
      }));
    })() : null;

    /* Category mix — compute from filtered data when branch is specified */
    const categoryMix = bf && by_branch_sku.length > 0 ? (() => {
      const totals = {};
      for (const r of by_branch_sku) {
        if (r.category) totals[r.category] = (totals[r.category] || 0) + r.value;
      }
      const grand = Object.values(totals).reduce((s, v) => s + v, 0);
      return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([name, val], i) => ({
        name, value: grand > 0 ? Math.round(val / grand * 100) : 0, color: CAT_COLORS_LIST[i % CAT_COLORS_LIST.length],
      }));
    })() : [
      { name:'Air Conditioner', value:32, color:'#1B3A6B' },
      { name:'Refrigerator',    value:28, color:'#E31837' },
      { name:'Washing Machine', value:24, color:'#16A34A' },
      { name:'Microwave',       value:10, color:'#D97706' },
      { name:'Induction',       value: 6, color:'#7C3AED' },
    ];

    const branchAccuracy = Object.entries(BRANCH_ACC_FULL)
      .map(([branch, { acc }]) => ({ branch, accuracy: acc }))
      .sort((a, b) => b.accuracy - a.accuracy);

    db.close();
    res.json({
      overrides, kpis, trendData,
      branchAccuracy, categoryAccuracy, categoryMix,
      futureForecast, perfData, india_total, by_category, by_branch, by_branch_sku,
      cycle, scenario,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/export', (req, res) => {
  try {
    const db = getDb();
    const bf = req.query.branch || null;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const runs = bf
      ? db.prepare(`SELECT branch, sku, category, month, value FROM forecast_runs WHERE cycle_id=? AND scenario_id=? AND branch=? ORDER BY sku, month`).all(cycle.cycle_id, scenario?.scenario_id, bf)
      : db.prepare(`SELECT branch, sku, category, month, value FROM forecast_runs WHERE cycle_id=? AND scenario_id=? ORDER BY branch, sku, month`).all(cycle.cycle_id, scenario?.scenario_id);

    const header = 'Branch,SKU,Category,Month,Forecast Units\n';
    const rows = runs.map(r => `${r.branch},${r.sku},${r.category},${r.month},${r.value}`).join('\n');
    db.close();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="WhirlCast_Forecast_Jun2026.csv"`);
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
