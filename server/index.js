require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/forecast', require('./routes/forecast'));
app.use('/api/scenarios', require('./routes/scenarios'));
app.use('/api/collaboration', require('./routes/collaboration'));
app.use('/api/conflicts', require('./routes/conflicts'));
app.use('/api/demand-sensing', require('./routes/demandSensing'));
app.use('/api/npi', require('./routes/npi'));
app.use('/api/report', require('./routes/report'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/demo',  require('./routes/demo'));
app.use('/api/cycles', require('./routes/cycles'));
app.use('/api/supply', require('./routes/supply'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'WhirlCast', version: '1.0.0' }));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../client/build/index.html')));
}

app.listen(PORT, () => {
  console.log(`WhirlCast API running on http://localhost:${PORT}`);

  // === TEMP DIAGNOSTIC: Railway DB check (remove after diagnosis) ===
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'db', 'demandiq.db');
  const dbExists = fs.existsSync(dbPath);
  console.log('[DIAG] DB path:', dbPath);
  console.log('[DIAG] DB file exists:', dbExists);
  if (dbExists) {
    try {
      const Database = require('better-sqlite3');
      const diagDb = new Database(dbPath, { readonly: true });
      try {
        const row = diagDb.prepare('SELECT COUNT(*) as cnt FROM planning_orders').get();
        console.log('[DIAG] planning_orders row count:', row.cnt);
      } catch (qErr) {
        console.log('[DIAG] planning_orders query failed:', qErr.message);
      }
      diagDb.close();
    } catch (dbErr) {
      console.log('[DIAG] better-sqlite3 open failed:', dbErr.message);
    }
  }
  // === END TEMP DIAGNOSTIC ===
});
