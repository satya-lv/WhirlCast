const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.post('/reset', (req, res) => {
  try {
    const db = getDb();

    db.prepare(`UPDATE branch_overrides SET override_value = NULL, reason = NULL,
      override_by = NULL, override_on = NULL, status = 'pending', final_override = NULL`).run();

    db.prepare(`UPDATE branch_overrides SET override_value = 1800, reason = 'B: New Promo/Activity',
      override_by = 'James', status = 'submitted'
      WHERE branch = 'Chennai' AND sku = 'REF_190L_DirectCool'`).run();

    db.prepare(`UPDATE branch_overrides SET override_value = 580, reason = 'E: Seasonality effects',
      override_by = 'Holly', status = 'submitted'
      WHERE branch = 'Kolkata' AND sku = 'REF_240L_FrostFree'`).run();

    db.prepare(`UPDATE demand_sensing_log SET applied = 0 WHERE log_id > 1`).run();

    res.json({ success: true, message: 'Demo data reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
