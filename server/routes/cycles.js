const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.post('/signoff', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE forecast_cycles SET status='signed_off', closed_at=datetime('now') WHERE cycle_id=1`).run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
