const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];
const MONTHS_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];

const FWD_BASE = {
  'REF_190L_DirectCool': [320,280,260,290,310,340],
  'REF_240L_FrostFree':  [210,195,185,200,215,230],
  'REF_340L_TripleDoor': [140,130,120,135,145,155],
  'WM_7KG_TopLoad':      [260,245,240,255,270,285],
  'WM_8KG_FrontLoad':    [160,150,145,155,165,175],
  'WM_6.5KG_SemiAuto':   [190,175,170,180,195,205],
  'AC_1.5T_Inverter':    [580,620,680,520,380,290],
  'AC_2.0T_Split':       [340,370,410,310,230,175],
  'MW_25L_Convection':   [95, 88, 82, 90, 98, 105],
  'IH_3B_SmartGlass':    [72, 68, 65, 70, 75, 80],
};

const BRANCH_FACTOR = {
  'Mumbai':1.25,'New Delhi':1.22,'Kolkata':0.95,'Chennai':1.05,
  'Bangalore':1.08,'Hyderabad':0.98,'Pune':0.88,'Ahmedabad':0.85,
};

router.post('/reset', (req, res) => {
  try {
    const db = getDb();

    const cycle    = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();
    const scenario = db.prepare(`SELECT * FROM forecast_scenarios WHERE cycle_id=? AND status='finalized' LIMIT 1`).get(cycle.cycle_id);
    const cycleId    = cycle.cycle_id;
    const scenarioId = scenario?.scenario_id;

    // 1. Reset cycle status
    db.prepare(`UPDATE forecast_cycles SET status='overrides_pending' WHERE cycle_id=?`).run(cycleId);

    // 2. Wipe overrides and demand sensing
    db.prepare('DELETE FROM branch_overrides').run();
    db.prepare('DELETE FROM demand_sensing_log').run();

    // 3. Restore every forward forecast_run to the original seed value
    if (scenarioId) {
      const products  = db.prepare(`SELECT sku FROM product_master WHERE active=1`).all();
      const updateRun = db.prepare(`UPDATE forecast_runs SET value=? WHERE scenario_id=? AND branch=? AND sku=? AND month=?`);
      for (let mi = 0; mi < MONTHS_FWD.length; mi++) {
        const month = MONTHS_FWD[mi];
        for (const branch of BRANCHES) {
          const bFactor = BRANCH_FACTOR[branch] || 1.0;
          for (const { sku } of products) {
            const val = Math.round(((FWD_BASE[sku] || [])[mi] || 100) * bFactor);
            updateRun.run(val, scenarioId, branch, sku, month);
          }
        }
      }
      // The one pre-resolved override (New Delhi REF_340L Jul-2026 → 175) is already "resolved"
      // in demo state, so reflect it in forecast_runs too
      db.prepare(`UPDATE forecast_runs SET value=175 WHERE scenario_id=? AND branch='New Delhi' AND sku='REF_340L_TripleDoor' AND month='07-2026'`).run(scenarioId);
    }

    // 4. Re-insert the 6 original demo overrides (exact copy of seed.js)
    const ins = db.prepare(`INSERT INTO branch_overrides
      (cycle_id,branch,sku,month,ai_forecast,override_value,reason,override_by,override_on,override_version,status,final_override)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);

    ins.run(cycleId,'Kolkata',   'REF_240L_FrostFree',  '07-2026', 185, 210, 'E: Seasonality effects', 'Holly',  '2026-05-13 14:20:00', 1, 'submitted', null);
    ins.run(cycleId,'Chennai',   'REF_190L_DirectCool', '06-2026', 336, 420, 'B: New Promo/Activity',  'James',  '2026-05-13 16:00:00', 1, 'submitted', null);
    ins.run(cycleId,'Mumbai',    'AC_1.5T_Inverter',    '08-2026', 850, 950, 'A: Increase in ranging', 'Rahul',  '2026-05-14 09:45:00', 1, 'submitted', null);
    ins.run(cycleId,'New Delhi', 'REF_340L_TripleDoor', '07-2026', 159, 175, 'B: New Promo/Activity',  'Harry',  '2026-05-13 11:30:00', 1, 'resolved',  175);
    ins.run(cycleId,'Bangalore', 'WM_7KG_TopLoad',      '09-2026', 275, 310, 'C: Pricing Change',      'Suresh', '2026-05-14 10:20:00', 1, 'submitted', null);
    ins.run(cycleId,'Hyderabad', 'AC_1.5T_Inverter',    '09-2026', 510, 580, 'E: Seasonality effects', 'Kavitha','2026-05-14 08:50:00', 1, 'submitted', null);

    // 5. Re-insert demand sensing log (same as seed.js)
    db.prepare(`INSERT INTO demand_sensing_log (cycle_id,filename,file_type,insights_json,applied,applied_at,created_at) VALUES (?,?,?,?,?,?,?)`)
      .run(cycleId, 'Q2_Trade_Promo_Brief.pdf', 'application/pdf',
        JSON.stringify([
          { impact_level:'high',   insight_text:'Trade promotion budget for AC increased 22% for Q2 2026', affected_skus:['AC_1.5T_Inverter','AC_2.0T_Split'], affected_branches:['New Delhi','Mumbai','Bangalore'], suggested_adjustment_percent:16, confidence:85 },
          { impact_level:'medium', insight_text:'IMD forecast: above-normal temperatures through June',   affected_skus:['REF_190L_DirectCool'],                affected_branches:['Chennai','Hyderabad'],             suggested_adjustment_percent:10, confidence:78 },
        ]),
        1, '2026-05-14 12:00:00', '2026-05-14 11:45:00'
      );

    db.close();
    res.json({ success: true, message: 'Demo reset to original state' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
