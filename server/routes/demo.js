const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.post('/reset', (req, res) => {
  try {
    const db = getDb();

    db.prepare('DELETE FROM branch_overrides').run();
    db.prepare('DELETE FROM demand_sensing_log').run();
    db.prepare('UPDATE forecast_cycles SET status = ? WHERE cycle_id = 1').run('overrides_pending');

    const insertOverride = db.prepare(`INSERT INTO branch_overrides
      (cycle_id,branch,sku,month,ai_forecast,override_value,reason,override_by,override_on,override_version,status)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'),?,?)`);

    insertOverride.run(1,'Kolkata','REF_240L_FrostFree','Mar 2026',520,580,'E: Seasonality effects','Holly',1,'submitted');
    insertOverride.run(1,'Chennai','REF_190L_DirectCool','Feb 2026',1232,1800,'B: New Promo/Activity','James',1,'submitted');
    insertOverride.run(1,'Hyderabad','AC_1.5T_Inverter','Apr 2026',380,510,'A: Increase in ranging','Kavitha',1,'submitted');

    db.prepare(`INSERT INTO demand_sensing_log (cycle_id,filename,file_type,applied,created_at) VALUES(?,?,?,?,datetime('now'))`)
      .run(1,'Q2_Trade_Promo_Brief.pdf','pdf',0);

    res.json({ success: true, message: 'Demo reset complete' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
