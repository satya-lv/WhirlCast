'use strict';
const { getDb } = require('./schema');

function runDemandMigration() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS demand_weekly_data (
      row_id              INTEGER PRIMARY KEY AUTOINCREMENT,
      sku                 TEXT NOT NULL,
      location_id         INTEGER NOT NULL,
      week_number         INTEGER NOT NULL CHECK(week_number BETWEEN 1 AND 52),
      year                INTEGER NOT NULL,
      actual_sales        REAL NOT NULL DEFAULT 0,
      system_forecast     REAL NOT NULL DEFAULT 0,
      planner_adjustment  REAL NOT NULL DEFAULT 0,
      final_consensus     REAL GENERATED ALWAYS AS (system_forecast + planner_adjustment) STORED,
      UNIQUE(sku, location_id, week_number, year),
      FOREIGN KEY (sku) REFERENCES product_master(sku),
      FOREIGN KEY (location_id) REFERENCES locations(location_id)
    );

    CREATE INDEX IF NOT EXISTS idx_dwd_sku_loc_year
      ON demand_weekly_data(sku, location_id, year);

    CREATE TABLE IF NOT EXISTS demand_exceptions (
      exception_id      INTEGER PRIMARY KEY AUTOINCREMENT,
      sku               TEXT NOT NULL,
      location_id       INTEGER NOT NULL,
      week_number       INTEGER,
      year              INTEGER,
      category          TEXT NOT NULL,
      severity          TEXT NOT NULL,
      financial_impact  REAL,
      title             TEXT NOT NULL,
      detail            TEXT NOT NULL,
      recommendation    TEXT NOT NULL,
      acknowledged      INTEGER NOT NULL DEFAULT 0,
      created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sku) REFERENCES product_master(sku),
      FOREIGN KEY (location_id) REFERENCES locations(location_id)
    );
  `);

  // Add ABC/XYZ columns to product_master (idempotent ALTER TABLE, same pattern as migrate_supply.js)
  for (const col of [
    'ALTER TABLE product_master ADD COLUMN abc_class TEXT',
    'ALTER TABLE product_master ADD COLUMN xyz_class TEXT',
    'ALTER TABLE product_master ADD COLUMN cov REAL',
    'ALTER TABLE product_master ADD COLUMN classification_updated_at TEXT',
  ]) {
    try { db.exec(col); } catch (_) { /* column already exists */ }
  }

  db.close();
  console.log('[migrate_demand] Demand planning tables created/verified.');
}

if (require.main === module) runDemandMigration();
module.exports = runDemandMigration;
