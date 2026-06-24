const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getDb } = require('../db/schema');

const upload = multer({ storage: multer.memoryStorage() });

const SEED_PRODUCTS = [
  { sku: 'REF_240L_FrostFree',    category: 'Refrigerator',   segment: 'Double Door',  subsegment: 'Frost Free',   price: 28000, star_rating: 4, active: 1 },
  { sku: 'REF_190L_DirectCool',   category: 'Refrigerator',   segment: 'Single Door',  subsegment: 'Direct Cool',  price: 14500, star_rating: 3, active: 1 },
  { sku: 'REF_340L_SideBySide',   category: 'Refrigerator',   segment: 'Side-by-Side', subsegment: 'Multi-Door',   price: 58000, star_rating: 5, active: 1 },
  { sku: 'WM_6kg_TopLoad',        category: 'Washing Machine', segment: 'Top Load',    subsegment: 'Semi-Auto',    price: 12000, star_rating: 3, active: 1 },
  { sku: 'WM_8kg_FrontLoad',      category: 'Washing Machine', segment: 'Front Load',  subsegment: 'Fully Auto',   price: 34000, star_rating: 5, active: 1 },
  { sku: 'WM_7kg_TopLoad_FA',     category: 'Washing Machine', segment: 'Top Load',    subsegment: 'Fully Auto',   price: 22000, star_rating: 4, active: 1 },
  { sku: 'AC_1.5T_Inverter',      category: 'Air Conditioner', segment: 'Split',       subsegment: 'Inverter',     price: 42000, star_rating: 5, active: 1 },
  { sku: 'AC_1T_WindowUnit',      category: 'Air Conditioner', segment: 'Window',      subsegment: 'Fixed Speed',  price: 24000, star_rating: 3, active: 1 },
  { sku: 'MW_25L_Convection',     category: 'Microwave',       segment: 'Convection',  subsegment: 'Solo+Grill',   price: 11500, star_rating: 4, active: 1 },
  { sku: 'DW_12Place_BuiltIn',    category: 'Dishwasher',      segment: 'Built-In',    subsegment: 'Freestanding', price: 68000, star_rating: 5, active: 1 },
];

router.get('/products', (req, res) => {
  try {
    const db = getDb();
    const { category, active } = req.query;
    let query = `SELECT * FROM product_master WHERE 1=1`;
    const params = [];
    if (category) { query += ` AND category=?`; params.push(category); }
    if (active !== undefined) { query += ` AND active=?`; params.push(active === 'true' ? 1 : 0); }
    let products = db.prepare(query).all(...params);
    if (!products.length) products = SEED_PRODUCTS;
    db.close();
    res.json({ products });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/products/add', (req, res) => {
  try {
    const db = getDb();
    const { sku, category, segment, subsegment, price, star_rating } = req.body;
    if (!sku || !category) { db.close(); return res.status(400).json({ error: 'SKU and category are required' }); }
    db.prepare(`INSERT OR REPLACE INTO product_master (sku, category, segment, subsegment, price, star_rating, active) VALUES (?,?,?,?,?,?,1)`)
      .run(sku, category, segment || '', subsegment || '', parseInt(price) || 0, parseInt(star_rating) || 3);
    db.close();
    res.json({ message: 'Product added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/products/:sku', (req, res) => {
  try {
    const db = getDb();
    const { category, segment, subsegment, price, star_rating } = req.body;
    db.prepare(`UPDATE product_master SET category=?, segment=?, subsegment=?, price=?, star_rating=? WHERE sku=?`)
      .run(category, segment, subsegment, parseInt(price) || 0, parseInt(star_rating) || 3, req.params.sku);
    db.close();
    res.json({ message: 'Product updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/products/:sku', (req, res) => {
  try {
    const db = getDb();
    db.prepare(`UPDATE product_master SET active=0 WHERE sku=?`).run(req.params.sku);
    db.close();
    res.json({ message: 'Product deactivated' });
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
        db.prepare(`INSERT OR REPLACE INTO product_master (sku, category, segment, subsegment, price, star_rating, active) VALUES (?,?,?,?,?,?,1)`)
          .run(sku, category, segment, subsegment, parseInt(price), parseInt(star_rating));
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
    const mappings = db.prepare(`
      SELECT lfl.*, pm.category
      FROM lfl_master lfl
      LEFT JOIN product_master pm ON lfl.new_sku = pm.sku
      ORDER BY lfl.effective_date DESC
    `).all();
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
    db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`)
      .run(old_sku, new_sku, effective_date, reason, 'Admin');
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
        db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`)
          .run(old_sku, new_sku, effective_date, reason, 'Admin');
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
    db.prepare(`INSERT INTO users (name, email, role, branch_access, active) VALUES (?,?,?,?,1)`)
      .run(name, email, role, branch_access || 'All');
    db.close();
    res.json({ message: 'User added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/users/:id/deactivate', (req, res) => {
  try {
    const db = getDb();
    const active = req.body.active !== undefined ? (req.body.active ? 1 : 0) : 0;
    db.prepare(`UPDATE users SET active=? WHERE user_id=?`).run(active, req.params.id);
    db.close();
    res.json({ message: 'User updated' });
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
