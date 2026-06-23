const { getDb, initSchema } = require('./schema');

const BRANCHES = ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai', 'Bangalore', 'Hyderabad', 'Pune', 'Ahmedabad'];

const PRODUCTS = [
  { sku: 'REF_190L_DirectCool', category: 'Direct Cool Refrigerator', segment: '180-200L', subsegment: 'Single Door', price: 12500, star_rating: 3 },
  { sku: 'REF_240L_FrostFree', category: 'Frost Free Refrigerator', segment: '240L', subsegment: 'Double Door', price: 22000, star_rating: 3 },
  { sku: 'REF_340L_TripleDoor', category: 'Frost Free Refrigerator', segment: '340L', subsegment: 'Triple Door', price: 32000, star_rating: 4 },
  { sku: 'WM_7KG_TopLoad', category: 'Washing Machine', segment: '7KG', subsegment: 'Top Load', price: 18000, star_rating: 4 },
  { sku: 'WM_8KG_FrontLoad', category: 'Washing Machine', segment: '8KG', subsegment: 'Front Load', price: 28000, star_rating: 5 },
  { sku: 'WM_6.5KG_SemiAuto', category: 'Washing Machine', segment: '6.5KG', subsegment: 'Semi-Automatic', price: 9500, star_rating: 3 },
  { sku: 'AC_1.5T_Inverter', category: 'Air Conditioner', segment: '1.5 Ton', subsegment: 'Inverter Split', price: 35000, star_rating: 3 },
  { sku: 'AC_2.0T_Split', category: 'Air Conditioner', segment: '2.0 Ton', subsegment: 'Split', price: 42000, star_rating: 4 },
  { sku: 'MW_25L_Convection', category: 'Microwave', segment: '25L', subsegment: 'Convection', price: 11000, star_rating: 4 },
  { sku: 'IH_3B_SmartGlass', category: 'Induction', segment: '3 Burner', subsegment: 'Smart Glass', price: 8500, star_rating: 4 },
];

// Jun–Nov 2026 forecast period (cycle is May 2026, forecasting NEXT 6 months)
const MONTHS_2026_FWD = ['06-2026','07-2026','08-2026','09-2026','10-2026','11-2026'];
const MONTHS_2025     = ['01-2025','02-2025','03-2025','04-2025','05-2025','06-2025','07-2025','08-2025','09-2025','10-2025','11-2025','12-2025'];

// Base AI forecast values per SKU × month index (Jun=0 … Nov=5)
const FWD_BASE = {
  'REF_190L_DirectCool': [320,280,260,290,310,340],
  'REF_240L_FrostFree':  [210,195,185,200,215,230],
  'REF_340L_TripleDoor': [140,130,120,135,145,155],
  'WM_7KG_TopLoad':      [260,245,240,255,270,285],
  'WM_8KG_FrontLoad':    [160,150,145,155,165,175],
  'WM_6.5KG_SemiAuto':   [190,175,170,180,195,205],
  'AC_1.5T_Inverter':    [580,620,680,520,380,290],
  'AC_2.0T_Split':       [340,370,410,310,230,175],
  'MW_25L_Convection':   [95, 88, 82, 90, 98, 105],
  'IH_3B_SmartGlass':    [72, 68, 65, 70, 75, 80],
};

const BRANCH_FACTOR = {
  'Mumbai':    1.25,
  'New Delhi': 1.22,
  'Kolkata':   0.95,
  'Chennai':   1.05,
  'Bangalore': 1.08,
  'Hyderabad': 0.98,
  'Pune':      0.88,
  'Ahmedabad': 0.85,
};

// Historical base for 2025 (per-branch seasonal generation)
function pseudoRand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return 0.85 + (x - Math.floor(x)) * 0.3;
}
function hist2025Value(sku, branch, monthStr) {
  const SKUS = PRODUCTS.map(p => p.sku);
  const monthNum = parseInt(monthStr.split('-')[0]);
  const base = (FWD_BASE[sku] || [100])[0]; // use Jun base as proxy
  const bFactor = BRANCH_FACTOR[branch] || 1.0;
  const seed = (BRANCHES.indexOf(branch) + 1) * 100 + SKUS.indexOf(sku) * 10 + monthNum;
  const variance = pseudoRand(seed);
  // Seasonal for 2025 actuals
  let seasonal = 1.0;
  if ((sku === 'AC_1.5T_Inverter' || sku === 'AC_2.0T_Split') && monthNum >= 4 && monthNum <= 6) seasonal = 2.8;
  if ((sku === 'AC_1.5T_Inverter' || sku === 'AC_2.0T_Split') && (monthNum >= 11 || monthNum <= 2)) seasonal = 0.15;
  if (sku === 'REF_190L_DirectCool' && monthNum >= 4 && monthNum <= 6) seasonal = 1.35;
  return Math.max(10, Math.round(base * bFactor * seasonal * variance));
}

function seed() {
  initSchema();
  const db = getDb();

  // Disable FK enforcement for the delete phase so supply-planning tables
  // that reference product_master don't block the wipe on subsequent deploys.
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('DELETE FROM npi_forecasts');
  db.exec('DELETE FROM exception_log');
  db.exec('DELETE FROM demand_sensing_log');
  db.exec('DELETE FROM branch_overrides');
  db.exec('DELETE FROM forecast_runs');
  db.exec('DELETE FROM forecast_scenarios');
  db.exec('DELETE FROM forecast_cycles');
  db.exec('DELETE FROM lfl_master');
  db.exec('DELETE FROM product_master');
  db.exec('DELETE FROM users');
  db.exec('PRAGMA foreign_keys = ON');

  // Products
  const insertProduct = db.prepare(`INSERT OR REPLACE INTO product_master (sku, category, segment, subsegment, price, star_rating, active, launch_date) VALUES (?,?,?,?,?,?,1,'2023-01-01')`);
  for (const p of PRODUCTS) insertProduct.run(p.sku, p.category, p.segment, p.subsegment, p.price, p.star_rating);

  // LFL
  db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`).run('REF_185L_DirectCool','REF_190L_DirectCool','2024-04-01','Upgraded model','Priya Sharma');
  db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`).run('REF_230L_FrostFree','REF_240L_FrostFree','2024-07-01','Capacity upgrade','Priya Sharma');
  db.prepare(`INSERT INTO lfl_master (old_sku, new_sku, effective_date, reason, added_by) VALUES (?,?,?,?,?)`).run('WM_6KG_TopLoad','WM_7KG_TopLoad','2024-01-01','New model launch','Priya Sharma');

  // Users
  const insertUser = db.prepare(`INSERT INTO users (name, email, role, branch_access, last_login, active) VALUES (?,?,?,?,?,1)`);
  insertUser.run('Priya Sharma','priya@whirlpool.in','demand_planning','All','2026-05-14 09:30:00');
  insertUser.run('Rahul Mehta','rahul@whirlpool.in','branch_sales','Mumbai','2026-05-14 11:15:00');
  insertUser.run('Anjali Singh','anjali@whirlpool.in','category_team','All','2026-05-13 16:45:00');
  insertUser.run('Admin User','admin@whirlpool.in','admin','All','2026-05-14 08:00:00');

  // Active cycle — May 2026 cycle forecasts Jun–Nov 2026
  const cycleResult = db.prepare(`INSERT INTO forecast_cycles (month, year, status, created_by, created_at) VALUES (?,?,?,?,?)`).run('May', 2026, 'overrides_pending', 'Priya Sharma', '2026-05-14 08:00:00');
  const cycleId = cycleResult.lastInsertRowid;

  // Scenarios
  const s1Result = db.prepare(`INSERT INTO forecast_scenarios (cycle_id, name, algorithm_mix, accuracy, bias, revenue, total_units, status, notes, created_at, finalized_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    cycleId, 'Baseline SARIMAX', 'SARIMAX', 87.3, 3.6, 14820, 124850, 'finalized',
    'Conservative baseline using SARIMAX across all SKU segments', '2026-05-14 10:00:00', '2026-05-14 14:30:00'
  );
  const s1Id = s1Result.lastInsertRowid;

  const s2Result = db.prepare(`INSERT INTO forecast_scenarios (cycle_id, name, algorithm_mix, accuracy, bias, revenue, total_units, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    cycleId, 'High Growth RF', 'Random Forest + XGBoost', 84.1, 5.2, 16240, 136200, 'draft',
    'Optimistic scenario using ensemble methods', '2026-05-14 11:00:00'
  );
  const s2Id = s2Result.lastInsertRowid;

  const insertRun = db.prepare(`INSERT INTO forecast_runs (cycle_id, scenario_id, branch, sku, category, month, value, algorithm) VALUES (?,?,?,?,?,?,?,?)`);

  // Historical 2025 runs
  for (const month of MONTHS_2025) {
    for (const branch of BRANCHES) {
      for (const product of PRODUCTS) {
        const val = hist2025Value(product.sku, branch, month);
        insertRun.run(cycleId, s1Id, branch, product.sku, product.category, month, val, 'SARIMAX');
      }
    }
  }

  // Forward forecast Jun–Nov 2026 (deterministic per spec)
  for (let mi = 0; mi < MONTHS_2026_FWD.length; mi++) {
    const month = MONTHS_2026_FWD[mi];
    for (const branch of BRANCHES) {
      const bFactor = BRANCH_FACTOR[branch] || 1.0;
      for (const product of PRODUCTS) {
        const base = (FWD_BASE[product.sku] || [])[mi] || 100;
        const val = Math.round(base * bFactor);
        insertRun.run(cycleId, s1Id, branch, product.sku, product.category, month, val, 'SARIMAX');
        const s2val = Math.round(val * 1.08);
        insertRun.run(cycleId, s2Id, branch, product.sku, product.category, month, s2val, 'Random Forest');
      }
    }
  }

  // Seed branch_overrides for the demo (use new Jun–Nov 2026 months)
  // Values derived from FWD_BASE × BRANCH_FACTOR
  const insertOverride = db.prepare(`INSERT INTO branch_overrides (cycle_id, branch, sku, month, ai_forecast, override_value, reason, override_by, override_on, override_version, status, final_override) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  // Kolkata REF_240L Jul 2026: base 195×0.95=185, override 210
  insertOverride.run(cycleId,'Kolkata','REF_240L_FrostFree','07-2026',185,210,'E: Seasonality effects','Holly','2026-05-13 14:20:00',1,'submitted',null);
  // Chennai REF_190L Jun 2026: base 320×1.05=336, override 420
  insertOverride.run(cycleId,'Chennai','REF_190L_DirectCool','06-2026',336,420,'B: New Promo/Activity','James','2026-05-13 16:00:00',1,'submitted',null);
  // Mumbai AC_1.5T Aug 2026: base 680×1.25=850, override 950
  insertOverride.run(cycleId,'Mumbai','AC_1.5T_Inverter','08-2026',850,950,'A: Increase in ranging','Rahul','2026-05-14 09:45:00',1,'submitted',null);
  // New Delhi REF_340L Jul 2026: base 130×1.22=159, override 175, resolved
  insertOverride.run(cycleId,'New Delhi','REF_340L_TripleDoor','07-2026',159,175,'B: New Promo/Activity','Harry','2026-05-13 11:30:00',1,'resolved',175);
  // Bangalore WM_7KG Sep 2026: base 255×1.08=275, override 310
  insertOverride.run(cycleId,'Bangalore','WM_7KG_TopLoad','09-2026',275,310,'C: Pricing Change','Suresh','2026-05-14 10:20:00',1,'submitted',null);
  // Hyderabad AC_1.5T Sep 2026: base 520×0.98=510, override 580
  insertOverride.run(cycleId,'Hyderabad','AC_1.5T_Inverter','09-2026',510,580,'E: Seasonality effects','Kavitha','2026-05-14 08:50:00',1,'submitted',null);

  // Exception log
  const insertException = db.prepare(`INSERT INTO exception_log (branch, sku, exception_type, original_value, corrected_value, acknowledged) VALUES (?,?,?,?,?,?)`);
  insertException.run('New Delhi','REF_190L_DirectCool','Extreme Outlier High',4500,450,0);
  insertException.run('Mumbai','AC_1.5T_Inverter','Zero Value Anomaly',0,380,1);
  insertException.run('Chennai','WM_8KG_FrontLoad','Z-Score Violation',2800,280,0);
  insertException.run('Kolkata','REF_240L_FrostFree','Negative Value Error',-42,201,1);
  insertException.run('New Delhi','MW_25L_Convection','Null Data Point',0,114,0);
  insertException.run('Mumbai','REF_340L_TripleDoor','Sudden Volume Drop',12,179,1);

  // Demand sensing log
  db.prepare(`INSERT INTO demand_sensing_log (cycle_id, filename, file_type, insights_json, applied, applied_at, created_at) VALUES (?,?,?,?,?,?,?)`).run(
    cycleId, 'Q2_Trade_Promo_Brief.pdf', 'application/pdf',
    JSON.stringify([
      {impact_level:'high', insight_text:'Trade promotion budget for AC increased 22% for Q2 2026', affected_skus:['AC_1.5T_Inverter','AC_2.0T_Split'], affected_branches:['New Delhi','Mumbai','Bangalore'], suggested_adjustment_percent:16, confidence:85},
      {impact_level:'medium', insight_text:'IMD forecast: above-normal temperatures through June', affected_skus:['REF_190L_DirectCool'], affected_branches:['Chennai','Hyderabad'], suggested_adjustment_percent:10, confidence:78},
    ]),
    1, '2026-05-14 12:00:00', '2026-05-14 11:45:00'
  );

  db.close();
  console.log('Seed data inserted successfully (Jun–Nov 2026 forecast period)');
}

seed();
