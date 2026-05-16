const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'demandiq.db');

function getDb() {
  return new Database(DB_PATH);
}

function initSchema() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS forecast_cycles (
      cycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT DEFAULT 'in_progress',
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS forecast_runs (
      run_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      scenario_id INTEGER,
      branch TEXT NOT NULL,
      sku TEXT NOT NULL,
      category TEXT,
      month TEXT NOT NULL,
      value INTEGER NOT NULL,
      algorithm TEXT DEFAULT 'SARIMAX',
      is_npi INTEGER DEFAULT 0,
      demand_sensing_adjusted INTEGER DEFAULT 0,
      FOREIGN KEY (cycle_id) REFERENCES forecast_cycles(cycle_id)
    );

    CREATE TABLE IF NOT EXISTS forecast_scenarios (
      scenario_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      algorithm_mix TEXT,
      accuracy REAL,
      bias REAL,
      revenue REAL,
      total_units INTEGER,
      status TEXT DEFAULT 'draft',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finalized_at DATETIME,
      FOREIGN KEY (cycle_id) REFERENCES forecast_cycles(cycle_id)
    );

    CREATE TABLE IF NOT EXISTS branch_overrides (
      override_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER NOT NULL,
      branch TEXT NOT NULL,
      sku TEXT NOT NULL,
      month TEXT NOT NULL,
      ai_forecast INTEGER NOT NULL,
      override_value INTEGER,
      reason TEXT,
      override_by TEXT,
      override_on DATETIME,
      override_version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      final_override INTEGER,
      FOREIGN KEY (cycle_id) REFERENCES forecast_cycles(cycle_id)
    );

    CREATE TABLE IF NOT EXISTS demand_sensing_log (
      log_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER,
      filename TEXT,
      file_type TEXT,
      insights_json TEXT,
      adjustments_json TEXT,
      applied INTEGER DEFAULT 0,
      applied_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exception_log (
      exception_id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER,
      branch TEXT,
      sku TEXT,
      exception_type TEXT,
      original_value INTEGER,
      corrected_value INTEGER,
      acknowledged INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS product_master (
      sku TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      segment TEXT,
      subsegment TEXT,
      price INTEGER,
      star_rating INTEGER,
      active INTEGER DEFAULT 1,
      launch_date TEXT
    );

    CREATE TABLE IF NOT EXISTS lfl_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      old_sku TEXT NOT NULL,
      new_sku TEXT NOT NULL,
      effective_date TEXT,
      reason TEXT,
      added_by TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      branch_access TEXT DEFAULT 'All',
      last_login DATETIME,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS npi_forecasts (
      npi_id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_id INTEGER,
      sku TEXT NOT NULL,
      category TEXT,
      lookalike_skus TEXT,
      branch TEXT,
      month TEXT,
      value INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.close();
  console.log('Schema initialized');
}

module.exports = { getDb, initSchema, DB_PATH };
