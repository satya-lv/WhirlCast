const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const MONTHS   = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];

const LAST_6M_ACTUALS_MUMBAI = {
  'REF_190L_DirectCool':2263,'REF_240L_FrostFree':1842,'REF_340L_TripleDoor':1200,
  'WM_7KG_TopLoad':1721,'WM_8KG_FrontLoad':948,'WM_6.5KG_SemiAuto':1050,
  'AC_1.5T_Inverter':2180,'AC_2.0T_Split':1340,'MW_25L_Convection':512,'IH_3B_SmartGlass':390,
};
const BRANCH_FACTOR = {
  'Mumbai':1.25,'New Delhi':1.22,'Kolkata':0.95,'Chennai':1.05,
  'Bangalore':1.08,'Hyderabad':0.98,'Pune':0.88,'Ahmedabad':0.85,
};

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const overrides = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=?`).all(cycle.cycle_id);

    const branchSummary = BRANCHES.map(branch => {
      const branchOv = overrides.filter(o => o.branch === branch);
      const submitted = branchOv.some(o => o.status === 'submitted' || o.status === 'resolved');
      const overrideCount = branchOv.filter(o => o.override_value != null).length;
      const conflictCount = branchOv.filter(o => {
        if (!o.override_value || !o.ai_forecast) return false;
        return Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast) > 0.2;
      }).length;
      return { branch, submitted, total: branchOv.length, overrideCount, conflictCount, status: submitted ? 'submitted' : 'pending' };
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
    const products  = db.prepare(`SELECT * FROM product_master WHERE active=1`).all();
    const bFactor   = BRANCH_FACTOR[branch] || 1.0;

    const tableData = products.map(product => {
      const last6mActual = Math.round((LAST_6M_ACTUALS_MUMBAI[product.sku] || 0) * bFactor / 1.25);
      const monthData = MONTHS.map(month => {
        const run      = db.prepare(`SELECT value FROM forecast_runs WHERE scenario_id=? AND branch=? AND sku=? AND month=?`).get(scenario?.scenario_id, branch, product.sku, month);
        const override = overrides.find(o => o.sku === product.sku && o.month === month);
        return {
          month,
          ai_forecast:      run?.value || 0,
          override_value:   override?.override_value  || null,
          reason:           override?.reason           || '',
          override_by:      override?.override_by      || '',
          override_on:      override?.override_on      || '',
          override_version: override?.override_version || 1,
          status:           override?.status           || 'pending',
          override_id:      override?.override_id      || null,
        };
      });
      return { sku: product.sku, category: product.category, segment: product.segment, last_6m_actual: last6mActual, months: monthData };
    });

    const submitted    = overrides.some(o => o.status === 'submitted' || o.status === 'resolved');
    const hasConflicts = overrides.some(o => {
      if (!o.override_value || !o.ai_forecast) return false;
      return Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast) > 0.2;
    });

    const histData = {};
    for (const product of products) {
      histData[product.sku] = db.prepare(`SELECT month, value FROM forecast_runs WHERE branch=? AND sku=? AND month LIKE '%-2025' ORDER BY month`).all(branch, product.sku);
    }

    db.close();
    res.json({ branch, tableData, histData, cycle, submitted, hasConflicts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/override', (req, res) => {
  try {
    const db = getDb();
    const { branch, sku, month, override_value, value, reason, overrides: batchOverrides } = req.body;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenarioId = db.prepare(`SELECT scenario_id FROM forecast_scenarios WHERE status='finalized' ORDER BY finalized_at DESC LIMIT 1`).get()?.scenario_id;

    const saveOne = (s, m, val, rsn) => {
      const numVal = parseInt(val);
      if (!numVal) return;
      const existing = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=? AND branch=? AND sku=? AND month=?`).get(cycle.cycle_id, branch, s, m);
      const runVal   = scenarioId ? db.prepare(`SELECT value FROM forecast_runs WHERE scenario_id=? AND branch=? AND sku=? AND month=? LIMIT 1`).get(scenarioId, branch, s, m) : null;
      if (existing) {
        db.prepare(`UPDATE branch_overrides SET override_value=?, reason=?, override_by='User', override_on=datetime('now'), override_version=override_version+1, status='submitted' WHERE override_id=?`).run(numVal, rsn || existing.reason, existing.override_id);
      } else {
        db.prepare(`INSERT INTO branch_overrides (cycle_id,branch,sku,month,ai_forecast,override_value,reason,override_by,override_on,override_version,status) VALUES (?,?,?,?,?,?,?,?,datetime('now'),?,?)`).run(cycle.cycle_id, branch, s, m, runVal?.value || 0, numVal, rsn || '', 'User', 1, 'submitted');
      }
      if (scenarioId) {
        db.prepare(`UPDATE forecast_runs SET value=? WHERE branch=? AND sku=? AND month=? AND scenario_id=?`).run(numVal, branch, s, m, scenarioId);
      }
    };

    if (Array.isArray(batchOverrides)) {
      for (const ov of batchOverrides) saveOne(sku, ov.month, ov.value, reason);
    } else {
      saveOne(sku, month, override_value !== undefined ? override_value : value, reason);
    }

    db.close();
    res.json({ success: true, branch, sku, status: 'submitted' });
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
    const submittedCount = db.prepare(`SELECT COUNT(DISTINCT branch) as cnt FROM branch_overrides WHERE cycle_id=? AND (status='submitted' OR status='resolved')`).get(cycle.cycle_id)?.cnt || 0;
    if (submittedCount >= 3) {
      db.prepare(`UPDATE forecast_cycles SET status='conflicts_pending' WHERE cycle_id=?`).run(cycle.cycle_id);
    }
    db.close();
    res.json({ message: `Overrides submitted for ${branch}`, submittedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
