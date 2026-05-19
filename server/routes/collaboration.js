const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const overrides = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=?`).all(cycle.cycle_id);

    const branchSummary = BRANCHES.map(branch => {
      const branchOv = overrides.filter(o => o.branch === branch);
      const submitted = branchOv.some(o => o.status !== 'pending');
      const total = branchOv.length;
      const overrideCount = branchOv.filter(o => o.override_value != null).length;
      const conflictCount = branchOv.filter(o => {
        if (!o.override_value || !o.ai_forecast) return false;
        return Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast) > 0.2;
      }).length;

      return { branch, submitted, total, overrideCount, conflictCount, status: submitted ? 'submitted' : 'pending' };
    });

    db.close();
    res.json({ branches: branchSummary, cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:branch', (req, res) => {
  try {
    const db = getDb();
    const { branch } = req.params;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);

    const overrides = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=? AND branch=?`).all(cycle.cycle_id, branch);
    const products = db.prepare(`SELECT * FROM product_master WHERE active=1`).all();

    const MONTHS = ['02-2026','03-2026','04-2026','05-2026','06-2026','07-2026'];

    const tableData = products.map(product => {
      const monthData = MONTHS.map(month => {
        const run = db.prepare(`SELECT value FROM forecast_runs WHERE scenario_id=? AND branch=? AND sku=? AND month=?`).get(scenario?.scenario_id, branch, product.sku, month);
        const override = overrides.find(o => o.sku === product.sku && o.month === month);
        const hist = db.prepare(`SELECT AVG(value) as avg FROM forecast_runs WHERE branch=? AND sku=? AND month LIKE '%-2025'`).get(branch, product.sku);
        return {
          month,
          ai_forecast: run?.value || 0,
          override_value: override?.override_value || null,
          reason: override?.reason || '',
          override_by: override?.override_by || '',
          override_on: override?.override_on || '',
          override_version: override?.override_version || 1,
          status: override?.status || 'pending',
          override_id: override?.override_id || null,
          last_6m_actual: Math.round((hist?.avg || 0) * 6),
        };
      });

      return {
        sku: product.sku,
        category: product.category,
        segment: product.segment,
        months: monthData,
      };
    });

    // Historical data for inline charts
    const histData = {};
    for (const product of products) {
      const hist = db.prepare(`SELECT month, value FROM forecast_runs WHERE branch=? AND sku=? AND month LIKE '%-2025' ORDER BY month`).all(branch, product.sku);
      histData[product.sku] = hist;
    }

    db.close();
    res.json({ branch, tableData, histData, cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/override', (req, res) => {
  try {
    const db = getDb();
    const { branch, sku, month, value, reason } = req.body;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();

    const existing = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=? AND branch=? AND sku=? AND month=?`).get(cycle.cycle_id, branch, sku, month);

    if (existing) {
      db.prepare(`UPDATE branch_overrides SET override_value=?, reason=?, override_by='User', override_on=?, override_version=override_version+1 WHERE override_id=?`).run(value, reason, new Date().toISOString(), existing.override_id);
    } else {
      const run = db.prepare(`SELECT value FROM forecast_runs WHERE cycle_id=? AND branch=? AND sku=? AND month=? LIMIT 1`).get(cycle.cycle_id, branch, sku, month);
      db.prepare(`INSERT INTO branch_overrides (cycle_id, branch, sku, month, ai_forecast, override_value, reason, override_by, override_on, status) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        cycle.cycle_id, branch, sku, month, run?.value || 0, value, reason, 'User', new Date().toISOString(), 'pending'
      );
    }

    const scenarioId = db.prepare(
      `SELECT scenario_id FROM forecast_scenarios WHERE status='finalized' ORDER BY finalized_at DESC LIMIT 1`
    ).get()?.scenario_id;
    if (scenarioId && value != null) {
      db.prepare(`UPDATE forecast_runs SET value=? WHERE branch=? AND sku=? AND month=? AND scenario_id=?`)
        .run(value, branch, sku, month, scenarioId);
    }

    db.close();
    res.json({ message: 'Override saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/submit/:branch', (req, res) => {
  try {
    const db = getDb();
    const { branch } = req.params;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    db.prepare(`UPDATE branch_overrides SET status='submitted' WHERE cycle_id=? AND branch=? AND status='pending'`).run(cycle.cycle_id, branch);
    db.close();
    res.json({ message: `Overrides submitted for ${branch}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
