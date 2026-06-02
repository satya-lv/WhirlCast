const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

const SKU_CATEGORY = {
  'REF_190L_DirectCool':'Direct Cool Refrigerator','REF_240L_FrostFree':'Frost Free Refrigerator',
  'REF_340L_TripleDoor':'Frost Free Refrigerator','WM_7KG_TopLoad':'Washing Machine',
  'WM_8KG_FrontLoad':'Washing Machine','WM_6.5KG_SemiAuto':'Washing Machine',
  'AC_1.5T_Inverter':'Air Conditioner','AC_2.0T_Split':'Air Conditioner',
  'MW_25L_Convection':'Microwave','IH_3B_SmartGlass':'Induction',
};

const MONTHS_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];

function fmtMonth(mm_yyyy) {
  const [mm, yyyy] = mm_yyyy.split('-');
  const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[parseInt(mm)]}'${yyyy.slice(2)}`;
}

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const overrides = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=? AND status != 'pending'`).all(cycle.cycle_id);

    const enriched = overrides.map(o => {
      const deviation = o.override_value && o.ai_forecast
        ? ((o.override_value - o.ai_forecast) / o.ai_forecast * 100).toFixed(1)
        : '0.0';
      const isConflict = Math.abs(parseFloat(deviation)) > 20;
      return { ...o, deviation: parseFloat(deviation), is_conflict: isConflict, month_label: fmtMonth(o.month || '06-2026') };
    });

    // Dynamic category rollup from forecast_runs + overrides
    const sid = db.prepare(`SELECT scenario_id FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id)?.scenario_id;
    const catTotals = {};
    if (sid) {
      const runs = db.prepare(`SELECT sku, SUM(value) as total FROM forecast_runs WHERE scenario_id=? AND month IN ('06-2026','07-2026','08-2026','09-2026','10-2026','11-2026') GROUP BY sku`).all(sid);
      for (const r of runs) {
        const cat = SKU_CATEGORY[r.sku] || 'Other';
        catTotals[cat] = (catTotals[cat] || 0) + r.total;
      }
    }

    const ovByCategory = {};
    for (const o of overrides) {
      const cat = SKU_CATEGORY[o.sku] || 'Other';
      if (!ovByCategory[cat]) ovByCategory[cat] = { ai: 0, override: 0 };
      ovByCategory[cat].ai       += o.ai_forecast   || 0;
      ovByCategory[cat].override += o.override_value || 0;
    }

    const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
    const categoryRollup = CATEGORIES.map(cat => {
      const ai_total       = catTotals[cat]    || 0;
      const ov             = ovByCategory[cat] || {};
      // override_total: replace overridden cells in AI total with override values
      const override_total = ai_total - (ov.ai || 0) + (ov.override || 0);
      const deviation      = ai_total > 0 ? parseFloat(((override_total - ai_total) / ai_total * 100).toFixed(1)) : 0;
      const status         = Math.abs(deviation) > 15 ? 'watch' : 'ok';
      return { category: cat, ai_total, override_total, deviation, status };
    }).filter(r => r.ai_total > 0);

    db.close();
    res.json({ overrides: enriched, categoryRollup, cycle });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resolve', (req, res) => {
  try {
    const db = getDb();
    const { decisions } = req.body;
    const scenarioId = db.prepare(`SELECT scenario_id FROM forecast_scenarios WHERE status='finalized' ORDER BY finalized_at DESC LIMIT 1`).get()?.scenario_id;

    for (const d of decisions) {
      db.prepare(`UPDATE branch_overrides SET final_override=?, status='resolved' WHERE override_id=?`).run(d.final_value, d.override_id);
      if (scenarioId && d.final_value != null) {
        const ov = db.prepare(`SELECT branch, sku, month FROM branch_overrides WHERE override_id=?`).get(d.override_id);
        if (ov) {
          db.prepare(`UPDATE forecast_runs SET value=? WHERE branch=? AND sku=? AND month=? AND scenario_id=?`).run(d.final_value, ov.branch, ov.sku, ov.month, scenarioId);
        }
      }
    }

    // Check if all submitted overrides are now resolved → update cycle status
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const pending = db.prepare(`SELECT COUNT(*) as cnt FROM branch_overrides WHERE cycle_id=? AND status='submitted'`).get(cycle.cycle_id);
    if (pending.cnt === 0) {
      db.prepare(`UPDATE forecast_cycles SET status='resolved' WHERE cycle_id=?`).run(cycle.cycle_id);
    }

    db.close();
    res.json({ message: 'Decisions saved', count: decisions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/category-override', (req, res) => {
  try {
    const db = getDb();
    const { overrides } = req.body;
    if (!overrides?.length) return res.json({ success: true, updated: 0 });

    const cycle    = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const sid      = scenario?.scenario_id;

    for (const ov of overrides) {
      const val = Math.max(0, Math.round(ov.value));
      const existing = db.prepare(`SELECT * FROM branch_overrides WHERE cycle_id=? AND branch=? AND sku=? AND month=?`).get(cycle.cycle_id, ov.branch, ov.sku, ov.month);

      if (existing) {
        db.prepare(`UPDATE branch_overrides SET override_value=?, reason='Category override', override_by='Category Team', override_on=datetime('now'), override_version=override_version+1, status='submitted' WHERE override_id=?`).run(val, existing.override_id);
      } else {
        const aiVal = sid ? (db.prepare(`SELECT value FROM forecast_runs WHERE scenario_id=? AND branch=? AND sku=? AND month=? LIMIT 1`).get(sid, ov.branch, ov.sku, ov.month)?.value || 0) : 0;
        db.prepare(`INSERT INTO branch_overrides (cycle_id, branch, sku, month, ai_forecast, override_value, reason, override_by, override_on, override_version, status) VALUES (?,?,?,?,?,?,?,?,datetime('now'),1,'submitted')`).run(cycle.cycle_id, ov.branch, ov.sku, ov.month, aiVal, val, 'Category override', 'Category Team');
      }

      if (sid) {
        db.prepare(`UPDATE forecast_runs SET value=? WHERE branch=? AND sku=? AND month=? AND scenario_id=?`).run(val, ov.branch, ov.sku, ov.month, sid);
      }
    }

    db.close();
    res.json({ success: true, updated: overrides.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
