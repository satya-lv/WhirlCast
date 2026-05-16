const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenarios = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? ORDER BY created_at DESC`).all(cycle.cycle_id);
    db.close();
    res.json({ scenarios, cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/compare', (req, res) => {
  try {
    const db = getDb();
    const { scenario_ids } = req.body;
    if (!scenario_ids || scenario_ids.length < 2) return res.status(400).json({ error: 'Need at least 2 scenarios' });

    const scenarios = scenario_ids.map(id => db.prepare(`SELECT * FROM forecast_scenarios WHERE scenario_id=?`).get(id)).filter(Boolean);

    const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
    const MONTHS = ['02-2026','03-2026','04-2026','05-2026','06-2026','07-2026'];

    const comparisonData = scenarios.map(s => {
      const branchData = {};
      for (const branch of BRANCHES) {
        const monthData = {};
        for (const month of MONTHS) {
          const total = db.prepare(`SELECT SUM(value) as t FROM forecast_runs WHERE scenario_id=? AND branch=? AND month=?`).get(s.scenario_id, branch, month);
          monthData[month] = total?.t || 0;
        }
        branchData[branch] = monthData;
      }
      return { ...s, branchData };
    });

    // Accuracy/bias trend data (simulated)
    const trendData = MONTHS.map((month, i) => {
      const obj = { month };
      scenarios.forEach((s, si) => {
        obj[`accuracy_s${si+1}`] = Math.round((s.accuracy || 85) + (Math.random() * 4 - 2));
        obj[`bias_s${si+1}`] = parseFloat(((s.bias || 4) + (Math.random() * 2 - 1)).toFixed(1));
      });
      return obj;
    });

    // Chart data: historical actual + both scenarios
    const hist = db.prepare(`SELECT month, SUM(value) as total FROM forecast_runs WHERE scenario_id=? GROUP BY month ORDER BY month`).all(scenarios[0].scenario_id);

    db.close();
    res.json({ scenarios: comparisonData, trendData, chartData: hist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/finalize', (req, res) => {
  try {
    const db = getDb();
    const { scenario_id } = req.body;
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE scenario_id=?`).get(scenario_id);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

    db.prepare(`UPDATE forecast_scenarios SET status='finalized', finalized_at=? WHERE scenario_id=?`).run(new Date().toISOString(), scenario_id);
    db.prepare(`UPDATE forecast_scenarios SET status='draft' WHERE scenario_id != ? AND cycle_id=?`).run(scenario_id, scenario.cycle_id);

    // Create branch override records
    const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
    const MONTHS = ['02-2026','03-2026','04-2026','05-2026','06-2026','07-2026'];
    const runs = db.prepare(`SELECT * FROM forecast_runs WHERE scenario_id=?`).all(scenario_id);
    const existingOverrides = db.prepare(`SELECT branch, sku, month FROM branch_overrides WHERE cycle_id=?`).all(scenario.cycle_id);
    const existingSet = new Set(existingOverrides.map(o => `${o.branch}|${o.sku}|${o.month}`));

    const insertOverride = db.prepare(`INSERT OR IGNORE INTO branch_overrides (cycle_id, branch, sku, month, ai_forecast, status) VALUES (?,?,?,?,?,?)`);
    for (const run of runs) {
      if (MONTHS.includes(run.month) && !existingSet.has(`${run.branch}|${run.sku}|${run.month}`)) {
        insertOverride.run(scenario.cycle_id, run.branch, run.sku, run.month, run.value, 'pending');
      }
    }

    db.prepare(`UPDATE forecast_cycles SET status='overrides_pending' WHERE cycle_id=?`).run(scenario.cycle_id);
    const updatedCycle = db.prepare(`SELECT * FROM forecast_cycles WHERE cycle_id=?`).get(scenario.cycle_id);
    db.close();

    res.json({ message: 'Scenario finalized', cycle: updatedCycle, scenario: { ...scenario, status: 'finalized' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
