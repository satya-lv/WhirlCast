const express = require('express');
const router = express.Router();
const { getDb } = require('../db/schema');

router.get('/lookalikes', (req, res) => {
  try {
    const db = getDb();
    const { category, price } = req.query;
    const priceNum = parseFloat(price) || 20000;

    const products = db.prepare(`SELECT * FROM product_master WHERE active=1 AND category=?`).all(category || 'Direct Cool Refrigerator');
    const lookalikes = products.slice(0, 3).map((p, i) => {
      const priceDiff = Math.abs((p.price - priceNum) / priceNum * 100);
      const matchScore = Math.max(60, Math.round(98 - priceDiff * 0.5 - i * 4));
      const rampData = Array.from({ length: 12 }, (_, mi) => {
        const ramp = mi < 3 ? (mi + 1) * 0.3 : mi < 6 ? 0.8 + mi * 0.05 : 1.0;
        return { month: mi + 1, value: Math.round(800 * ramp + Math.random() * 100) };
      });
      return {
        sku: p.sku, category: p.category, price: p.price, matchScore,
        matchReasons: ['Same category', `Similar price (±${Math.round(priceDiff)}%)`, 'Same segment'],
        rampData,
        peak_month: 8, total_6m: Math.round(rampData.slice(0, 6).reduce((s, r) => s + r.value, 0)),
      };
    });

    db.close();
    res.json({ lookalikes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/save', (req, res) => {
  try {
    const db = getDb();
    const { sku, category, lookalike_skus, forecast_data } = req.body;
    const cycle = db.prepare(`SELECT * FROM forecast_cycles ORDER BY cycle_id DESC LIMIT 1`).get();

    const insertNpi = db.prepare(`INSERT INTO npi_forecasts (cycle_id, sku, category, lookalike_skus, branch, month, value) VALUES (?,?,?,?,?,?,?)`);
    for (const row of forecast_data || []) {
      insertNpi.run(cycle.cycle_id, sku, category, JSON.stringify(lookalike_skus), row.branch, row.month, row.value);
    }

    db.close();
    res.json({ message: 'NPI forecast saved', sku });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
