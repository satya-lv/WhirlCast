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

const SKUS = PRODUCTS.map(p => p.sku);

function getBranchMultiplier(branch, category) {
  let m = 1.0;
  if (branch === 'Mumbai' || branch === 'New Delhi') m *= 1.25;
  if ((branch === 'Chennai' || branch === 'Hyderabad') && category === 'Air Conditioner') m *= 1.15;
  return m;
}

function getSeasonalMultiplier(sku, month) {
  const monthNum = parseInt(month.split('-')[0]);
  switch (sku) {
    case 'REF_190L_DirectCool':
      if (monthNum >= 4 && monthNum <= 6) return 1.4;
      if (monthNum >= 10 && monthNum <= 12) return 0.8;
      if (monthNum >= 1 && monthNum <= 2) return 0.8;
      return 1.0;
    case 'REF_240L_FrostFree':
      if (monthNum >= 4 && monthNum <= 7) return 1.3;
      return 1.0;
    case 'REF_340L_TripleDoor':
      return 1.0;
    case 'WM_7KG_TopLoad':
      if (monthNum >= 9 && monthNum <= 11) return 1.2;
      return 1.0;
    case 'WM_8KG_FrontLoad':
      return 1.0;
    case 'WM_6.5KG_SemiAuto':
      if (monthNum >= 2 && monthNum <= 4) return 1.25;
      return 1.0;
    case 'AC_1.5T_Inverter':
      if (monthNum >= 4 && monthNum <= 7) return 3.5;
      if (monthNum >= 11 && monthNum <= 2) return 0.1;
      if (monthNum === 3) return 1.5;
      if (monthNum === 8) return 1.2;
      return 0.6;
    case 'AC_2.0T_Split':
      if (monthNum >= 4 && monthNum <= 7) return 3.5;
      if (monthNum >= 11 && monthNum <= 2) return 0.1;
      if (monthNum === 3) return 1.5;
      return 0.6;
    case 'MW_25L_Convection':
      if (monthNum === 10 || monthNum === 11) return 1.3;
      return 1.0;
    case 'IH_3B_SmartGlass':
      if (monthNum >= 11 || monthNum <= 1) return 1.15;
      return 1.0;
    default:
      return 1.0;
  }
}

function getBase(sku) {
  const bases = {
    'REF_190L_DirectCool': 300,
    'REF_240L_FrostFree': 250,
    'REF_340L_TripleDoor': 120,
    'WM_7KG_TopLoad': 220,
    'WM_8KG_FrontLoad': 140,
    'WM_6.5KG_SemiAuto': 180,
    'AC_1.5T_Inverter': 200,
    'AC_2.0T_Split': 120,
    'MW_25L_Convection': 90,
    'IH_3B_SmartGlass': 70,
  };
  return bases[sku] || 100;
}

function randVariance(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return 0.85 + (x - Math.floor(x)) * 0.3;
}

function generateValue(sku, branch, monthStr, seedOffset = 0) {
  const product = PRODUCTS.find(p => p.sku === sku);
  const category = product ? product.category : '';
  const base = getBase(sku);
  const branchM = getBranchMultiplier(branch, category);
  const seasonM = getSeasonalMultiplier(sku, monthStr);
  const seed = (BRANCHES.indexOf(branch) + 1) * 100 + SKUS.indexOf(sku) * 10 + seedOffset;
  const variance = randVariance(seed);
  return Math.max(10, Math.round(base * branchM * seasonM * variance));
}

const MONTHS_2025 = ['01-2025','02-2025','03-2025','04-2025','05-2025','06-2025','07-2025','08-2025','09-2025','10-2025','11-2025','12-2025'];
const MONTHS_2026_FWD = ['02-2026','03-2026','04-2026','05-2026','06-2026','07-2026'];

function seed() {
  initSchema();
  const db = getDb();

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

  // Products
  const insertProduct = db.prepare(`INSERT OR REPLACE INTO product_master (sku, category, segment, subsegment, price, star_rating, active, launch_date) VALUES (?,?,?,?,?,?,1,'2023-01-01')`);
  for (const p of PRODUCTS) {
    insertProduct.run(p.sku, p.category, p.segment, p.subsegment, p.price, p.star_rating);
  }

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

  // Active cycle
  const cycleResult = db.prepare(`INSERT INTO forecast_cycles (month, year, status, created_by, created_at) VALUES (?,?,?,?,?)`).run('May', 2026, 'overrides_pending', 'Priya Sharma', '2026-05-14 08:00:00');
  const cycleId = cycleResult.lastInsertRowid;

  // Scenarios
  const s1Result = db.prepare(`INSERT INTO forecast_scenarios (cycle_id, name, algorithm_mix, accuracy, bias, revenue, total_units, status, notes, created_at, finalized_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
    cycleId, 'Baseline SARIMAX', 'SARIMAX', 87.3, 3.6, 14820, 124850, 'finalized', 'Conservative baseline using SARIMAX across all SKU segments', '2026-05-14 10:00:00', '2026-05-14 14:30:00'
  );
  const s1Id = s1Result.lastInsertRowid;

  const s2Result = db.prepare(`INSERT INTO forecast_scenarios (cycle_id, name, algorithm_mix, accuracy, bias, revenue, total_units, status, notes, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    cycleId, 'High Growth RF', 'Random Forest + XGBoost', 84.1, 5.2, 16240, 136200, 'draft', 'Optimistic scenario using ensemble methods', '2026-05-14 11:00:00'
  );
  const s2Id = s2Result.lastInsertRowid;

  // Historical runs (2025)
  const insertRun = db.prepare(`INSERT INTO forecast_runs (cycle_id, scenario_id, branch, sku, category, month, value, algorithm) VALUES (?,?,?,?,?,?,?,?)`);
  for (const month of MONTHS_2025) {
    for (const branch of BRANCHES) {
      for (const product of PRODUCTS) {
        const val = generateValue(product.sku, branch, month, 0);
        insertRun.run(cycleId, s1Id, branch, product.sku, product.category, month, val, 'SARIMAX');
      }
    }
  }

  // Specific overridden values from wireframes
  const specificValues = {
    'New Delhi|REF_190L_DirectCool': [191, 490, 365, 195, 145, 108],
    'Kolkata|REF_240L_FrostFree': [215, 520, 305, 425, 510, 175],
    'Chennai|REF_340L_TripleDoor': [430, 188, 222, 370, 440, 550],
    'Mumbai|WM_7KG_TopLoad': [510, 445, 285, 340, 255, 520],
    'New Delhi|WM_8KG_FrontLoad': [375, 108, 345, 530, 145, 570],
  };

  // Forward forecast runs (Feb-Jul 2026)
  for (let mi = 0; mi < MONTHS_2026_FWD.length; mi++) {
    const month = MONTHS_2026_FWD[mi];
    for (const branch of BRANCHES) {
      for (const product of PRODUCTS) {
        const key = `${branch}|${product.sku}`;
        let val;
        if (specificValues[key]) {
          val = specificValues[key][mi];
        } else {
          val = generateValue(product.sku, branch, month, 1);
        }
        // Scenario 1
        insertRun.run(cycleId, s1Id, branch, product.sku, product.category, month, val, 'SARIMAX');
        // Scenario 2 (higher)
        const s2val = Math.round(val * (1 + 0.05 + Math.random() * 0.07));
        insertRun.run(cycleId, s2Id, branch, product.sku, product.category, month, s2val, 'Random Forest');
      }
    }
  }

  // Branch overrides
  const insertOverride = db.prepare(`INSERT INTO branch_overrides (cycle_id, branch, sku, month, ai_forecast, override_value, reason, override_by, override_on, override_version, status, final_override) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`);
  insertOverride.run(cycleId, 'Kolkata', 'REF_240L_FrostFree', '03-2026', 520, 580, 'E: Seasonality effects', 'Holly', '2026-05-13 14:20:00', 1, 'submitted', null);
  insertOverride.run(cycleId, 'Chennai', 'REF_190L_DirectCool', '02-2026', 1232, 1800, 'B: New Promo/Activity', 'James', '2026-05-13 16:00:00', 1, 'submitted', null);
  insertOverride.run(cycleId, 'Mumbai', 'AC_1.5T_Inverter', '04-2026', 467, 510, 'A: Increase in ranging', 'Rahul', '2026-05-14 09:45:00', 1, 'submitted', null);
  insertOverride.run(cycleId, 'New Delhi', 'REF_340L_TripleDoor', '03-2026', 210, 220, 'B: New Promo/Activity', 'Harry', '2026-05-13 11:30:00', 1, 'resolved', 220);
  insertOverride.run(cycleId, 'Bangalore', 'WM_7KG_TopLoad', '04-2026', 310, 355, 'C: Pricing Change', 'Suresh', '2026-05-14 10:20:00', 1, 'submitted', null);
  insertOverride.run(cycleId, 'Hyderabad', 'AC_1.5T_Inverter', '05-2026', 380, 420, 'E: Seasonality effects', 'Kavitha', '2026-05-14 08:50:00', 1, 'submitted', null);

  // Exception log
  const insertException = db.prepare(`INSERT INTO exception_log (branch, sku, exception_type, original_value, corrected_value, acknowledged) VALUES (?,?,?,?,?,?)`);
  insertException.run('New Delhi', 'REF_190L_DirectCool', 'Extreme Outlier High', 4500, 450, 0);
  insertException.run('Mumbai', 'AC_1.5T_Inverter', 'Zero Value Anomaly', 0, 380, 1);
  insertException.run('Chennai', 'WM_8KG_FrontLoad', 'Z-Score Violation', 2800, 280, 0);
  insertException.run('Kolkata', 'REF_240L_FrostFree', 'Negative Value Error', -42, 201, 1);
  insertException.run('New Delhi', 'MW_25L_Convection', 'Null Data Point', 0, 114, 0);
  insertException.run('Mumbai', 'REF_340L_TripleDoor', 'Sudden Volume Drop', 12, 179, 1);

  // Demand sensing log
  db.prepare(`INSERT INTO demand_sensing_log (cycle_id, filename, file_type, insights_json, applied, applied_at, created_at) VALUES (?,?,?,?,?,?,?)`).run(
    cycleId,
    'Q2_Promo_Brief.pdf',
    'application/pdf',
    JSON.stringify([
      {impact_level:'high', insight_text:'Trade promotion budget for AC category increased 22% for Q2 2026 — expected 15-18% demand uplift on AC_1.5T_Inverter across Delhi, Mumbai, Bangalore', affected_skus:['AC_1.5T_Inverter','AC_2.0T_Split'], affected_branches:['New Delhi','Mumbai','Bangalore'], suggested_adjustment_percent:16, confidence:85},
      {impact_level:'medium', insight_text:'IMD forecast: above-normal temperatures across South India through June — positive signal for Direct Cool refrigerators in Chennai and Hyderabad', affected_skus:['REF_190L_DirectCool'], affected_branches:['Chennai','Hyderabad'], suggested_adjustment_percent:10, confidence:78},
      {impact_level:'medium', insight_text:'WM_6.5KG_SemiAuto listed for exclusive Q2 promotion on Flipkart — modest 8% online channel uplift expected', affected_skus:['WM_6.5KG_SemiAuto'], affected_branches:['Mumbai','New Delhi','Bangalore'], suggested_adjustment_percent:8, confidence:72},
      {impact_level:'low', insight_text:'Competitor LG launching 1.5T inverter AC at Rs 26,499 in May — potential 5% demand pressure on AC_1.5T_Inverter in tier-1 cities', affected_skus:['AC_1.5T_Inverter'], affected_branches:['Mumbai','New Delhi','Bangalore','Hyderabad'], suggested_adjustment_percent:-5, confidence:65}
    ]),
    1,
    '2026-05-14 12:00:00',
    '2026-05-14 11:45:00'
  );

  db.close();
  console.log('Seed data inserted successfully');
}

seed();
