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
      branch_adjustment   REAL NOT NULL DEFAULT 0,
      category_adjustment REAL NOT NULL DEFAULT 0,
      final_consensus     REAL NOT NULL DEFAULT 0,
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

  // Rebuild demand_weekly_data if it still has the old GENERATED final_consensus column
  // (branch_adjustment absent = table predates this migration).
  const cols = db.prepare('PRAGMA table_info(demand_weekly_data)').all();
  const hasBranchAdj = cols.some(c => c.name === 'branch_adjustment');

  if (!hasBranchAdj) {
    const rebuild = db.transaction(() => {
      db.exec('DROP TABLE IF EXISTS demand_weekly_data_new');
      db.exec(`
        CREATE TABLE demand_weekly_data_new (
          row_id              INTEGER PRIMARY KEY AUTOINCREMENT,
          sku                 TEXT NOT NULL,
          location_id         INTEGER NOT NULL,
          week_number         INTEGER NOT NULL CHECK(week_number BETWEEN 1 AND 52),
          year                INTEGER NOT NULL,
          actual_sales        REAL NOT NULL DEFAULT 0,
          system_forecast     REAL NOT NULL DEFAULT 0,
          planner_adjustment  REAL NOT NULL DEFAULT 0,
          branch_adjustment   REAL NOT NULL DEFAULT 0,
          category_adjustment REAL NOT NULL DEFAULT 0,
          final_consensus     REAL NOT NULL DEFAULT 0,
          UNIQUE(sku, location_id, week_number, year),
          FOREIGN KEY (sku) REFERENCES product_master(sku),
          FOREIGN KEY (location_id) REFERENCES locations(location_id)
        )
      `);
      db.exec(`
        INSERT INTO demand_weekly_data_new
          (row_id, sku, location_id, week_number, year,
           actual_sales, system_forecast, planner_adjustment,
           branch_adjustment, category_adjustment, final_consensus)
        SELECT
          row_id, sku, location_id, week_number, year,
          actual_sales, system_forecast, planner_adjustment,
          0, 0, final_consensus
        FROM demand_weekly_data
      `);
      db.exec('DROP TABLE demand_weekly_data');
      db.exec('ALTER TABLE demand_weekly_data_new RENAME TO demand_weekly_data');
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_dwd_sku_loc_year
          ON demand_weekly_data(sku, location_id, year)
      `);
    });
    rebuild();
    console.log('[migrate_demand] Rebuilt demand_weekly_data: branch_adjustment + category_adjustment added, final_consensus converted from GENERATED to regular column.');
  }

  db.close();
  console.log('[migrate_demand] Demand planning tables created/verified.');
}

if (require.main === module) runDemandMigration();
module.exports = runDemandMigration;
