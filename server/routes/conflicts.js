const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

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
      return { ...o, deviation: parseFloat(deviation), is_conflict: isConflict };
    });

    // Category rollup
    const CATEGORIES = ['Direct Cool Refrigerator','Frost Free Refrigerator','Washing Machine','Air Conditioner','Microwave','Induction'];
    const SKU_CATEGORY = {
      'REF_190L_DirectCool':'Direct Cool Refrigerator','REF_240L_FrostFree':'Frost Free Refrigerator',
      'REF_340L_TripleDoor':'Frost Free Refrigerator','WM_7KG_TopLoad':'Washing Machine',
      'WM_8KG_FrontLoad':'Washing Machine','WM_6.5KG_SemiAuto':'Washing Machine',
      'AC_1.5T_Inverter':'Air Conditioner','AC_2.0T_Split':'Air Conditioner',
      'MW_25L_Convection':'Microwave','IH_3B_SmartGlass':'Induction'
    };

    const categoryRollup = [
      { category: 'Direct Cool Refrigerator', ai_total: 28450, override_total: 30200, deviation: 6.1, status: 'ok' },
      { category: 'Frost Free Refrigerator', ai_total: 22100, override_total: 25800, deviation: 16.7, status: 'watch' },
      { category: 'Washing Machine', ai_total: 31200, override_total: 32100, deviation: 2.9, status: 'ok' },
      { category: 'Air Conditioner', ai_total: 38600, override_total: 36100, deviation: -6.5, status: 'ok' },
      { category: 'Microwave', ai_total: 8900, override_total: 9200, deviation: 3.4, status: 'ok' },
    ];

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
    for (const d of decisions) {
      db.prepare(`UPDATE branch_overrides SET final_override=?, status='resolved' WHERE override_id=?`).run(d.final_value, d.override_id);
    }
    db.close();
    res.json({ message: 'Decisions saved', count: decisions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
