const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/schema');

const BRANCHES   = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const MONTHS_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
const SKUS       = ['REF_190L_DirectCool','REF_240L_FrostFree','REF_340L_TripleDoor','WM_7KG_TopLoad','WM_8KG_FrontLoad','WM_6.5KG_SemiAuto','AC_1.5T_Inverter','AC_2.0T_Split','MW_25L_Convection','IH_3B_SmartGlass'];

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

    /* Fallback: finalized scenario values for zero-fill */
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const finalized = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const fbRuns = finalized
      ? db.prepare(`SELECT branch, sku, month, value FROM forecast_runs WHERE scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026')`).all(finalized.scenario_id)
      : [];
    const fallbackMap = {};
    fbRuns.forEach(r => { fallbackMap[`${r.branch}|${r.sku}|${r.month}`] = r.value; });

    /* Per-scenario data */
    const comparisonData = scenarios.map(s => {
      const runs = db.prepare(
        `SELECT branch, sku, month, value FROM forecast_runs WHERE scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026')`
      ).all(s.scenario_id);

      /* Branch×month totals for the trend chart */
      const branchData = {};
      BRANCHES.forEach(b => {
        const md = {};
        MONTHS_FWD.forEach(m => {
          const sum = runs.filter(r => r.branch === b && r.month === m).reduce((a, r) => a + r.value, 0);
          md[m] = sum || SKUS.reduce((a, sku) => a + (fallbackMap[`${b}|${sku}|${m}`] || 0), 0);
        });
        branchData[b] = md;
      });

      return { ...s, branchData, runs };
    });

    /* Accuracy & bias trend (simulated variation around scenario values) */
    const trendData = MONTHS_FWD.map(month => {
      const obj = { month };
      scenarios.forEach((s, si) => {
        obj[`accuracy_s${si+1}`] = Math.round((s.accuracy || 85) + (Math.random() * 4 - 2));
        obj[`bias_s${si+1}`]     = parseFloat(((s.bias || 4) + (Math.random() * 2 - 1)).toFixed(1));
      });
      return obj;
    });

    db.close();
    res.json({ scenarios: comparisonData, trendData, fallbackMap });
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

    const runs = db.prepare(`SELECT * FROM forecast_runs WHERE scenario_id=?`).all(scenario_id);
    const existing = db.prepare(`SELECT branch, sku, month FROM branch_overrides WHERE cycle_id=?`).all(scenario.cycle_id);
    const existingSet = new Set(existing.map(o => `${o.branch}|${o.sku}|${o.month}`));
    const ins = db.prepare(`INSERT OR IGNORE INTO branch_overrides (cycle_id, branch, sku, month, ai_forecast, status) VALUES (?,?,?,?,?,?)`);
    for (const run of runs) {
      if (MONTHS_FWD.includes(run.month) && !existingSet.has(`${run.branch}|${run.sku}|${run.month}`)) {
        ins.run(scenario.cycle_id, run.branch, run.sku, run.month, run.value, 'pending');
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
