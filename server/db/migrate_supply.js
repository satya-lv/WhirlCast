'use strict';
const { getDb } = require('./schema');

function runMigration() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      location_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT UNIQUE NOT NULL,
      region        TEXT NOT NULL,
      state         TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plants (
      plant_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      name      TEXT UNIQUE NOT NULL,
      city      TEXT NOT NULL,
      state     TEXT NOT NULL,
      region    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS production_lines (
      line_id              INTEGER PRIMARY KEY AUTOINCREMENT,
      plant_id             INTEGER NOT NULL,
      name                 TEXT NOT NULL,
      line_category        TEXT NOT NULL,
      hours_per_shift      REAL NOT NULL DEFAULT 8,
      shifts_per_day       INTEGER NOT NULL DEFAULT 2,
      working_days_per_week INTEGER NOT NULL DEFAULT 6,
      FOREIGN KEY (plant_id) REFERENCES plants(plant_id)
    );

    CREATE TABLE IF NOT EXISTS work_centers (
      wc_id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      line_id                  INTEGER NOT NULL,
      name                     TEXT NOT NULL,
      hours_available_per_week REAL NOT NULL,
      FOREIGN KEY (line_id) REFERENCES production_lines(line_id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      supplier_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name              TEXT UNIQUE NOT NULL,
      city              TEXT NOT NULL,
      otif_pct          REAL NOT NULL DEFAULT 92.0,
      lead_time_days    INTEGER NOT NULL DEFAULT 21,
      payment_terms_days INTEGER NOT NULL DEFAULT 45
    );

    CREATE TABLE IF NOT EXISTS components (
      component_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      code          TEXT UNIQUE NOT NULL,
      name          TEXT NOT NULL,
      category      TEXT NOT NULL,
      supplier_id   INTEGER NOT NULL,
      unit_cost     REAL NOT NULL,
      on_hand_qty   INTEGER NOT NULL DEFAULT 0,
      reorder_point INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    );

    CREATE TABLE IF NOT EXISTS bom_lines (
      bom_id       INTEGER PRIMARY KEY AUTOINCREMENT,
      sku          TEXT NOT NULL,
      component_id INTEGER NOT NULL,
      qty_per      REAL NOT NULL,
      FOREIGN KEY (sku) REFERENCES product_master(sku),
      FOREIGN KEY (component_id) REFERENCES components(component_id),
      UNIQUE(sku, component_id)
    );

    CREATE TABLE IF NOT EXISTS sku_planning_params (
      sku               TEXT PRIMARY KEY,
      hours_per_unit    REAL NOT NULL,
      safety_stock_weeks REAL NOT NULL DEFAULT 2.0,
      line_category     TEXT NOT NULL,
      FOREIGN KEY (sku) REFERENCES product_master(sku)
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT UNIQUE NOT NULL,
      priority_tier INTEGER NOT NULL DEFAULT 3,
      channel       TEXT NOT NULL,
      region        TEXT NOT NULL DEFAULT 'All'
    );

    CREATE TABLE IF NOT EXISTS plant_location_routing (
      plant_id    INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      PRIMARY KEY (plant_id, location_id),
      FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
      FOREIGN KEY (location_id) REFERENCES locations(location_id)
    );

    CREATE TABLE IF NOT EXISTS scenario_supply_plans (
      scenario_id  INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      description  TEXT,
      action_type  TEXT NOT NULL,
      status       TEXT DEFAULT 'draft',
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS planning_orders (
      order_id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sku                  TEXT NOT NULL,
      location_id          INTEGER NOT NULL,
      plant_id             INTEGER NOT NULL,
      production_line_id   INTEGER NOT NULL,
      week_number          INTEGER NOT NULL,
      year                 INTEGER NOT NULL DEFAULT 2026,
      scenario_id          INTEGER NOT NULL DEFAULT 1,
      -- Demand
      forecast_demand      REAL NOT NULL,
      customer_orders      REAL NOT NULL,
      priority_demand      REAL NOT NULL,
      -- Supply
      beginning_inventory  REAL NOT NULL,
      planned_production   REAL NOT NULL,
      firm_production_orders REAL NOT NULL DEFAULT 0,
      purchase_orders      REAL NOT NULL DEFAULT 0,
      transfer_orders      REAL NOT NULL DEFAULT 0,
      ending_inventory     REAL NOT NULL,
      -- Constraints
      capacity_available   REAL NOT NULL,
      capacity_required    REAL NOT NULL,
      material_availability REAL NOT NULL DEFAULT 999,
      shortage_qty         REAL NOT NULL DEFAULT 0,
      supply_gap           REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sku) REFERENCES product_master(sku),
      FOREIGN KEY (location_id) REFERENCES locations(location_id),
      FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
      FOREIGN KEY (production_line_id) REFERENCES production_lines(line_id),
      FOREIGN KEY (scenario_id) REFERENCES scenario_supply_plans(scenario_id)
    );

    CREATE TABLE IF NOT EXISTS firm_production_orders (
      fpo_id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sku                TEXT NOT NULL,
      plant_id           INTEGER NOT NULL,
      production_line_id INTEGER NOT NULL,
      week_number        INTEGER NOT NULL,
      year               INTEGER NOT NULL DEFAULT 2026,
      qty                INTEGER NOT NULL,
      status             TEXT DEFAULT 'firm',
      notes              TEXT,
      FOREIGN KEY (sku) REFERENCES product_master(sku),
      FOREIGN KEY (plant_id) REFERENCES plants(plant_id),
      FOREIGN KEY (production_line_id) REFERENCES production_lines(line_id)
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      po_id        INTEGER PRIMARY KEY AUTOINCREMENT,
      component_id INTEGER NOT NULL,
      supplier_id  INTEGER NOT NULL,
      qty          INTEGER NOT NULL,
      unit_cost    REAL NOT NULL,
      ordered_date TEXT NOT NULL,
      due_date     TEXT NOT NULL,
      week_due     INTEGER NOT NULL,
      year_due     INTEGER NOT NULL DEFAULT 2026,
      status       TEXT DEFAULT 'open',
      FOREIGN KEY (component_id) REFERENCES components(component_id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
    );

    CREATE TABLE IF NOT EXISTS transfer_orders (
      to_id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sku              TEXT NOT NULL,
      from_location_id INTEGER NOT NULL,
      to_location_id   INTEGER NOT NULL,
      qty              INTEGER NOT NULL,
      week_number      INTEGER NOT NULL,
      year             INTEGER NOT NULL DEFAULT 2026,
      reason           TEXT,
      status           TEXT DEFAULT 'planned',
      FOREIGN KEY (sku) REFERENCES product_master(sku),
      FOREIGN KEY (from_location_id) REFERENCES locations(location_id),
      FOREIGN KEY (to_location_id) REFERENCES locations(location_id)
    );
  `);

  // Extend product_master with lead time fields (idempotent)
  for (const col of [
    'ALTER TABLE product_master ADD COLUMN lead_time_days INTEGER DEFAULT 21',
    'ALTER TABLE product_master ADD COLUMN lead_time_variability_days INTEGER DEFAULT 5',
  ]) {
    try { db.exec(col); } catch (_) { /* column already exists */ }
  }

  db.close();
  console.log('Supply planning migration complete.');
}

runMigration();
