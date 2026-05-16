const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../db/schema');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/products', (req, res) => {
  try {
    const db = getDb();
    const { category, active } = req.query;
    let query = `SELECT * FROM product_master WHERE 1=1`;
    const params = [];
    if (category) { query += ` AND category=?`; params.push(category); }
    if (active !== undefined) { query += ` AND active=?`; params.push(active === 'true' ? 1 : 0); }
    const products = db.prepare(query).all(...params);
    db.close();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/upload', upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const csv = req.file?.buffer?.toString('utf8') || '';
    const lines = csv.split('\n').filter(l => l.trim() && !l.startsWith('SKU'));
    let count = 0;
    for (const line of lines) {
      const [sku, category, segment, subsegment, price, star_rating] = line.split(',').map(s => s.trim());
      if (sku && category) {
        db.prepare(`INSERT OR REPLACE INTO product_master (sku, category, segment, subsegment, price, star_rating, active) VALUES (?,?,?,?,?,?,1)`).run(sku, category, segment, subsegment, parseInt(price), parseInt(star_rating));
        count++;
      }
    }
    db.close();
    res.json({ message: `${count} products imported` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/update', (req, res) => {
  try {
    const db = getDb();
    const { sku, ...updates } = req.body;
    const fields = Object.keys(updates).map(k => `${k}=?`).join(',');
    db.prepare(`UPDATE product_master SET ${fields} WHERE sku=?`).run(...Object.values(updates), sku);
    db.close();
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/lfl', (req, res) => {
  try {
    const db = getDb();
    const mappings = db.prepare(`SELECT * FROM lfl_master ORDER BY effective_date DESC`).all();
    db.close();
    res.json({ mappings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lfl/add', (req, res) => {
  try {
    const db = getDb();
    const { old_sku, new_sku, effective_date, reason } = req.body;
    db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`).run(old_sku, new_sku, effective_date, reason, 'Admin');
    db.close();
    res.json({ message: 'LFL mapping added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/lfl/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`DELETE FROM lfl_master WHERE id=?`).run(req.params.id);
    db.close();
    res.json({ message: 'Mapping deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/lfl/upload', upload.single('file'), (req, res) => {
  try {
    const db = getDb();
    const csv = req.file?.buffer?.toString('utf8') || '';
    const lines = csv.split('\n').filter(l => l.trim() && !l.startsWith('Old'));
    let count = 0;
    for (const line of lines) {
      const [old_sku, new_sku, effective_date, reason] = line.split(',').map(s => s.trim());
      if (old_sku && new_sku) {
        db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`).run(old_sku, new_sku, effective_date, reason, 'Admin');
        count++;
      }
    }
    db.close();
    res.json({ message: `${count} mappings imported` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', (req, res) => {
  try {
    const db = getDb();
    const users = db.prepare(`SELECT * FROM users ORDER BY name`).all();
    db.close();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/add', (req, res) => {
  try {
    const db = getDb();
    const { name, email, role, branch_access } = req.body;
    db.prepare(`INSERT INTO users (name, email, role, branch_access, active) VALUES (?,?,?,?,1)`).run(name, email, role, branch_access || 'All');
    db.close();
    res.json({ message: 'User added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/users/update', (req, res) => {
  try {
    const db = getDb();
    const { user_id, active } = req.body;
    db.prepare(`UPDATE users SET active=? WHERE user_id=?`).run(active ? 1 : 0, user_id);
    db.close();
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
