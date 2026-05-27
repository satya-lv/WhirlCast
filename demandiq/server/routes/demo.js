const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.post('/reset', (req, res) => {
  try {
    const db = getDb();

    // Step 1: Clear only override and sensing data
    db.prepare('DELETE FROM branch_overrides WHERE cycle_id = 1').run();
    db.prepare('DELETE FROM demand_sensing_log WHERE cycle_id = 1').run();

    // Step 2: Reset cycle status only
    db.prepare(`UPDATE forecast_cycles SET status = 'overrides_pending', closed_at = NULL WHERE cycle_id = 1`).run();

    // Step 4: Re-insert exactly 3 seed overrides
    const insertOverride = db.prepare(`
      INSERT INTO branch_overrides
      (cycle_id, branch, sku, month, ai_forecast, override_value, reason, override_by, override_on, override_version, status)
      VALUES (?,?,?,?,?,?,?,?,datetime('now'),?,?)
    `);
    insertOverride.run(1,'Kolkata',  'REF_240L_FrostFree', '06-2026', 201, 225, 'E: Seasonality effects', 'Holly',   1, 'submitted');
    insertOverride.run(1,'Chennai',  'REF_190L_DirectCool','06-2026', 336, 390, 'B: New Promo/Activity',  'James',   1, 'submitted');
    insertOverride.run(1,'Hyderabad','AC_1.5T_Inverter',   '06-2026', 568, 640, 'A: Increase in ranging', 'Kavitha', 1, 'submitted');

    // Step 5: Insert one demand sensing history row
    db.prepare(`INSERT INTO demand_sensing_log (cycle_id, filename, file_type, applied, created_at) VALUES (?,?,?,?,datetime('now'))`)
      .run(1, 'Q2_Trade_Promo_Brief.pdf', 'pdf', 0);

    db.close();

    // Step 6: Return
    res.json({
      success: true,
      message: 'Demo reset to default state',
      state: {
        overrides_cleared:      true,
        cycle_status:           'overrides_pending',
        seed_overrides_inserted: 3,
        core_data_unchanged:    true,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
