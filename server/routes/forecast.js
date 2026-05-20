const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

const BRANCHES = ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai', 'Bangalore', 'Hyderabad', 'Pune', 'Ahmedabad'];
const SKUS = ['REF_190L_DirectCool','REF_240L_FrostFree','REF_340L_TripleDoor','WM_7KG_TopLoad','WM_8KG_FrontLoad','WM_6.5KG_SemiAuto','AC_1.5T_Inverter','AC_2.0T_Split','MW_25L_Convection','IH_3B_SmartGlass'];

function getBranchMultiplier(branch, category) {
  let m = 1.0;
  if (branch === 'Mumbai' || branch === 'New Delhi') m *= 1.25;
  if ((branch === 'Chennai' || branch === 'Hyderabad') && category && category.includes('Air')) m *= 1.15;
  return m;
}

function getSeasonalM(sku, monthNum) {
  switch (sku) {
    case 'REF_190L_DirectCool': return (monthNum>=4&&monthNum<=6)?1.4:(monthNum>=10||monthNum<=2)?0.8:1.0;
    case 'REF_240L_FrostFree': return (monthNum>=4&&monthNum<=7)?1.3:1.0;
    case 'WM_7KG_TopLoad': return (monthNum>=9&&monthNum<=11)?1.2:1.0;
    case 'WM_6.5KG_SemiAuto': return (monthNum>=2&&monthNum<=4)?1.25:1.0;
    case 'AC_1.5T_Inverter': case 'AC_2.0T_Split':
      if(monthNum>=4&&monthNum<=7) return 3.5;
      if(monthNum>=11||monthNum<=2) return 0.1;
      if(monthNum===3) return 1.5;
      return 0.7;
    case 'MW_25L_Convection': return (monthNum===10||monthNum===11)?1.3:1.0;
    case 'IH_3B_SmartGlass': return (monthNum>=11||monthNum<=1)?1.15:1.0;
    default: return 1.0;
  }
}

const BASE = { 'REF_190L_DirectCool':300,'REF_240L_FrostFree':250,'REF_340L_TripleDoor':120,'WM_7KG_TopLoad':220,'WM_8KG_FrontLoad':140,'WM_6.5KG_SemiAuto':180,'AC_1.5T_Inverter':200,'AC_2.0T_Split':120,'MW_25L_Convection':90,'IH_3B_SmartGlass':70 };

function pseudoRand(seed) {
  const x = Math.sin(seed*9301+49297)*233280;
  return 0.85+(x-Math.floor(x))*0.3;
}

router.get('/workbench', (req, res) => {
  res.json({
    branches: BRANCHES,
    categories: ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'],
    algorithms: ['SARIMAX','ARIMA','Exponential Smoothing','Moving Average','Random Forest','XGBoost','Prophet'],
    primaryVariables: ['Historical Sales','Primary Sales','Secondary Sales','All Combined'],
    internalCausal: ['Trade Promotions','Pricing Changes','New Launch','Pipeline Changes','Scheme Changes'],
    externalCausal: ['Festival Calendar','Weather Data','GDP Index','Competitor Activity','Govt Regulations'],
  });
});

router.post('/generate', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const products = db.prepare(`SELECT * FROM product_master WHERE active=1`).all();

    const FMONTHS = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
    const forecastRuns = [];
    const exceptions = [];

    for (const branch of BRANCHES) {
      for (const product of products) {
        for (let mi = 0; mi < FMONTHS.length; mi++) {
          const month = FMONTHS[mi];
          const monthNum = parseInt(month.split('-')[0]);
          const base = BASE[product.sku] || 100;
          const branchM = getBranchMultiplier(branch, product.category);
          const seasonM = getSeasonalM(product.sku, monthNum);
          const seed = (BRANCHES.indexOf(branch)+1)*100 + SKUS.indexOf(product.sku)*10 + mi + 5;
          const variance = pseudoRand(seed);
          let val = Math.max(10, Math.round(base * branchM * seasonM * variance));

          // inject exceptions
          const exKey = `${branch}|${product.sku}|${mi}`;
          const exceptionTriggers = { 'New Delhi|REF_190L_DirectCool|0': 4500, 'Mumbai|AC_1.5T_Inverter|1': 0, 'Chennai|WM_8KG_FrontLoad|2': 2800, 'Kolkata|REF_240L_FrostFree|0': -42 };
          if (exceptionTriggers[exKey] !== undefined) {
            const orig = exceptionTriggers[exKey];
            let type = 'Extreme Outlier High';
            if (orig === 0) type = 'Zero Value Anomaly';
            if (orig < 0) type = 'Negative Value Error';
            if (orig > val * 5) type = 'Extreme Outlier High';
            exceptions.push({ branch, sku: product.sku, month, exception_type: type, original_value: orig, corrected_value: val });
          }

          forecastRuns.push({ branch, sku: product.sku, category: product.category, month, value: val, algorithm: req.body?.algorithmConfig?.AX || 'SARIMAX' });
        }
      }
    }

    db.close();
    res.json({ forecast_runs: forecastRuns, exceptions, message: 'Forecast generated successfully', count: forecastRuns.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save-scenario', (req, res) => {
  try {
    const db = getDb();
    const { name, notes, forecast_runs, accuracy, bias } = req.body;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();

    const totalUnits = (forecast_runs || []).reduce((s, r) => s + (r.value || 0), 0);
    const products = db.prepare(`SELECT * FROM product_master`).all();
    const priceMap = {};
    for (const p of products) priceMap[p.sku] = p.price;
    const revenue = Math.round((forecast_runs || []).reduce((s, r) => s + (r.value || 0) * (priceMap[r.sku] || 20000), 0) / 1e5);

    const result = db.prepare(`INSERT INTO forecast_scenarios (cycle_id, name, algorithm_mix, accuracy, bias, revenue, total_units, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      cycle.cycle_id, name, 'SARIMAX', accuracy || 86.5, bias || 4.1, revenue, totalUnits || 124850, 'draft', notes || '', new Date().toISOString()
    );

    if (forecast_runs && forecast_runs.length > 0) {
      const insertRun = db.prepare(`INSERT INTO forecast_runs (cycle_id, scenario_id, branch, sku, category, month, value, algorithm) VALUES (?,?,?,?,?,?,?,?)`);
      for (const r of forecast_runs) {
        insertRun.run(cycle.cycle_id, result.lastInsertRowid, r.branch, r.sku, r.category, r.month, r.value, r.algorithm || 'SARIMAX');
      }
    }

    db.close();
    res.json({ scenario_id: result.lastInsertRowid, message: 'Scenario saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/live-summary', (req, res) => {
  const db = getDb();
  try {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    const cycle = db.prepare(
      `SELECT cycle_id, status FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`
    ).get();
    const cycleId = cycle?.cycle_id;

    const finalized = db.prepare(
      `SELECT scenario_id FROM forecast_scenarios WHERE status='finalized' LIMIT 1`
    ).get();

    if (!finalized || !cycleId) {
      return res.json({ total_units: 0, branches_submitted: 0, conflicts_pending: 0, cycle_status: 'not_started', total_branches: 8, branch_statuses: {} });
    }

    const total = db.prepare(
      `SELECT SUM(value) as total FROM forecast_runs WHERE scenario_id=?`
    ).get(finalized.scenario_id);

    // Count all branches that have any override (submitted OR resolved) in this cycle
    const submitted = db.prepare(
      `SELECT COUNT(DISTINCT branch) as cnt FROM branch_overrides WHERE cycle_id=? AND status IN ('submitted','resolved')`
    ).get(cycleId);

    // Count unresolved conflicts (still 'submitted' with >10% deviation)
    const conflicts = db.prepare(
      `SELECT COUNT(*) as cnt FROM branch_overrides WHERE cycle_id=? AND status='submitted' AND ai_forecast > 0 AND CAST(ABS(COALESCE(override_value,0) - ai_forecast) AS FLOAT) / ai_forecast > 0.10`
    ).get(cycleId);

    const BRANCHES_ALL = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
    const branch_statuses = {};
    for (const branch of BRANCHES_ALL) {
      const bovs = db.prepare(
        `SELECT override_value, ai_forecast, status FROM branch_overrides WHERE cycle_id=? AND branch=?`
      ).all(cycleId, branch);

      const hasActivity = bovs.some(o => o.status === 'submitted' || o.status === 'resolved');
      if (!hasActivity) {
        branch_statuses[branch] = 'pending';
      } else {
        // Only flag as conflict if there are UNRESOLVED (submitted) overrides with >20% deviation
        const hasConflict = bovs.some(o =>
          o.status === 'submitted' && o.ai_forecast > 0 &&
          Math.abs((o.override_value - o.ai_forecast) / o.ai_forecast) > 0.20
        );
        branch_statuses[branch] = hasConflict ? 'conflict' : 'submitted_clean';
      }
    }

    res.json({
      total_units:        total?.total    || 0,
      branches_submitted: submitted?.cnt  || 0,
      conflicts_pending:  conflicts?.cnt  || 0,
      cycle_status:       cycle?.status   || 'unknown',
      total_branches:     8,
      branch_statuses,
    });
  } catch (err) {
    console.error('live-summary error:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    db.close();
  }
});

module.exports = router;
