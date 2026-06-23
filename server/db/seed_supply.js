'use strict';
/**
 * seed_supply.js — Supply Planning synthetic data
 *
 * Run AFTER seed.js (product_master, users, etc.) and migrate_supply.js.
 *
 * Math invariants guaranteed:
 *   (1) ending_inventory  = max(0, beginning_inventory + planned_production − forecast_demand)
 *   (2) capacity_required = planned_production × hours_per_unit
 *   (3) beginning_inventory[w] = ending_inventory[w−1]  for w > 1
 *   (4) shortage_qty = max(0, forecast_demand − beginning_inventory − planned_production)
 *
 * on_hand quantities for components are NOT hard-coded — they are derived from
 * actual planned_production volumes after the 52-week roll-forward is computed.
 * This ensures material_availability reflects real draw rates.
 */
const { getDb } = require('./schema');

// ── Mirrors of existing seed constants ────────────────────────────────────

const BRANCHES = ['Mumbai','New Delhi','Kolkata','Chennai','Bangalore','Hyderabad','Pune','Ahmedabad'];

const BRANCH_FACTOR = {
  Mumbai:1.25, 'New Delhi':1.22, Kolkata:0.95, Chennai:1.05,
  Bangalore:1.08, Hyderabad:0.98, Pune:0.88, Ahmedabad:0.85,
};

const FWD_BASE = {
  'REF_190L_DirectCool': [320,280,260,290,310,340],
  'REF_240L_FrostFree':  [210,195,185,200,215,230],
  'REF_340L_TripleDoor': [140,130,120,135,145,155],
  'WM_7KG_TopLoad':      [260,245,240,255,270,285],
  'WM_8KG_FrontLoad':    [160,150,145,155,165,175],
  'WM_6.5KG_SemiAuto':   [190,175,170,180,195,205],
  'AC_1.5T_Inverter':    [580,620,680,520,380,290],
  'AC_2.0T_Split':       [340,370,410,310,230,175],
  'MW_25L_Convection':   [95, 88, 82, 90, 98,105],
  'IH_3B_SmartGlass':    [72, 68, 65, 70, 75, 80],
};

// Seasonal multipliers (index 0=Jan … 11=Dec), relative to Jun base
const SEASONAL = {
  'REF_190L_DirectCool': [0.82,0.82,0.90,1.02,1.12,1.00,0.875,0.813,0.906,0.969,1.063,0.90],
  'REF_240L_FrostFree':  [0.82,0.82,0.90,1.02,1.12,1.00,0.929,0.881,0.952,1.024,1.095,0.90],
  'REF_340L_TripleDoor': [0.82,0.82,0.90,1.02,1.10,1.00,0.929,0.857,0.964,1.036,1.107,0.90],
  'WM_7KG_TopLoad':      [0.90,0.90,0.97,1.00,1.03,1.00,0.942,0.923,0.981,1.038,1.096,0.95],
  'WM_8KG_FrontLoad':    [0.90,0.90,0.97,1.00,1.03,1.00,0.938,0.906,0.969,1.031,1.094,0.95],
  'WM_6.5KG_SemiAuto':   [0.90,0.90,0.97,1.00,1.03,1.00,0.921,0.895,0.947,1.026,1.079,0.95],
  'AC_1.5T_Inverter':    [0.12,0.12,0.30,0.75,1.10,1.00,1.069,1.172,0.897,0.655,0.500,0.30],
  'AC_2.0T_Split':       [0.12,0.12,0.30,0.75,1.10,1.00,1.088,1.206,0.912,0.676,0.515,0.30],
  'MW_25L_Convection':   [0.88,0.88,0.90,0.92,0.94,1.00,0.926,0.863,0.947,1.032,1.105,1.10],
  'IH_3B_SmartGlass':    [0.88,0.88,0.90,0.92,0.94,1.00,0.944,0.903,0.972,1.042,1.111,1.10],
};

// Week→month: [4,4,5,4,4,5,4,5,4,5,4,4] = 52 weeks
const WEEKS_PER_MONTH = [4,4,5,4,4,5,4,5,4,5,4,4];
const WEEK_TO_MONTH = new Array(53);
{ let wk = 1; for (let m=0;m<12;m++) for (let w=0;w<WEEKS_PER_MONTH[m];w++) WEEK_TO_MONTH[wk++]=m+1; }

function getWeeklyDemand(sku, branch, week) {
  const month = WEEK_TO_MONTH[week];
  const wim   = WEEKS_PER_MONTH[month - 1];
  let monthly;
  if (month >= 6 && month <= 11) {
    monthly = (FWD_BASE[sku]||[])[month-6] * (BRANCH_FACTOR[branch]||1);
  } else {
    const junBase  = (FWD_BASE[sku]||[100])[0];
    const seasonal = (SEASONAL[sku]||Array(12).fill(1))[month-1];
    monthly = junBase * (BRANCH_FACTOR[branch]||1) * seasonal;
  }
  return Math.max(2, monthly / wim);
}

// ── Production engineering constants ──────────────────────────────────────

const HOURS_PER_UNIT = {
  'REF_190L_DirectCool':0.40, 'REF_240L_FrostFree':0.45, 'REF_340L_TripleDoor':0.50,
  'WM_7KG_TopLoad':0.35,      'WM_8KG_FrontLoad':0.40,   'WM_6.5KG_SemiAuto':0.30,
  'AC_1.5T_Inverter':0.50,    'AC_2.0T_Split':0.55,
  'MW_25L_Convection':0.25,   'IH_3B_SmartGlass':0.20,
};
const SKU_LINE_CAT = {
  'REF_190L_DirectCool':'REF_DC', 'REF_240L_FrostFree':'REF_FF', 'REF_340L_TripleDoor':'REF_FF',
  'WM_7KG_TopLoad':'WM',          'WM_8KG_FrontLoad':'WM',       'WM_6.5KG_SemiAuto':'WM',
  'AC_1.5T_Inverter':'AC',        'AC_2.0T_Split':'AC',
  'MW_25L_Convection':'SMALL_APPL','IH_3B_SmartGlass':'SMALL_APPL',
};
const SAFETY_STOCK_WEEKS = {
  'REF_190L_DirectCool':2.0, 'REF_240L_FrostFree':2.0, 'REF_340L_TripleDoor':2.5,
  // WM: reduced 2.0/1.5→0.5 — same mismatch fix as AC.
  // ratio = (1+ssWks)/(1+ssWks/10); at ssWks=0.5: 1.5/1.05 = 1.43 → ~143%.
  'WM_7KG_TopLoad':0.5,      'WM_8KG_FrontLoad':0.5,   'WM_6.5KG_SemiAuto':0.5,
  // AC: reduced 3.0→0.5 — same fix.
  'AC_1.5T_Inverter':0.5,    'AC_2.0T_Split':0.5,
  'MW_25L_Convection':1.5,   'IH_3B_SmartGlass':1.5,
};

// ── Master data definitions ────────────────────────────────────────────────

const LOCATION_DATA = [
  {name:'Mumbai',    region:'West',  state:'Maharashtra'},
  {name:'Pune',      region:'West',  state:'Maharashtra'},
  {name:'Ahmedabad', region:'West',  state:'Gujarat'},
  {name:'New Delhi', region:'North', state:'Delhi'},
  {name:'Kolkata',   region:'East',  state:'West Bengal'},
  {name:'Chennai',   region:'South', state:'Tamil Nadu'},
  {name:'Bangalore', region:'South', state:'Karnataka'},
  {name:'Hyderabad', region:'South', state:'Telangana'},
];
const PLANT_DATA = [
  {name:'Pune Manufacturing Complex', city:'Pune',      state:'Maharashtra',region:'West'},
  {name:'Faridabad Technology Park',  city:'Faridabad', state:'Haryana',    region:'North'},
  {name:'Chennai Production Hub',     city:'Chennai',   state:'Tamil Nadu', region:'South'},
];
const LINE_CATEGORIES = [
  {cat:'REF_DC',     name:'Direct Cool Refrigerator Line', hrsShift:8,shifts:2,days:6},
  {cat:'REF_FF',     name:'Frost Free Refrigerator Line',  hrsShift:8,shifts:2,days:6},
  {cat:'WM',         name:'Washing Machine Line',          hrsShift:8,shifts:2,days:6},
  {cat:'AC',         name:'Air Conditioner Line',          hrsShift:8,shifts:2,days:6},
  {cat:'SMALL_APPL', name:'Small Appliances Line',         hrsShift:8,shifts:2,days:6},
];
const PLANT_TO_LOCS = {
  'Pune Manufacturing Complex':  ['Mumbai','Pune','Ahmedabad'],
  'Faridabad Technology Park':   ['New Delhi'],
  'Chennai Production Hub':      ['Chennai','Bangalore','Hyderabad','Kolkata'],
};
const SUPPLIER_DATA = [
  {name:'Tecumseh Products India', city:'Mumbai',   otif:91.5,ltd:28,pt:45},
  {name:'Wolong Electric India',   city:'Pune',     otif:93.0,ltd:21,pt:30},
  {name:'JSW Steel Ltd',           city:'Mumbai',   otif:95.2,ltd:14,pt:30},
  {name:'Havells India Ltd',       city:'Noida',    otif:94.0,ltd:21,pt:45},
  {name:'UNO Minda Group',         city:'Gurugram', otif:92.8,ltd:18,pt:30},
  {name:'Vidarbha Industries',     city:'Nagpur',   otif:90.0,ltd:10,pt:30},
];

// on_hand is filled in at runtime (derived from annualDraw after planning computation)
const COMPONENT_DATA = [
  {code:'COMP_COMP_STD',  name:'Standard Compressor',          cat:'COMPRESSOR',  supplier:'Tecumseh Products India', cost:2800, on_hand:0, rop:0},
  {code:'COMP_COMP_INV',  name:'Inverter Compressor',           cat:'COMPRESSOR',  supplier:'Tecumseh Products India', cost:4200, on_hand:0, rop:0},
  {code:'COMP_MOTOR_WM',  name:'Washing Machine Drive Motor',   cat:'MOTOR',       supplier:'Wolong Electric India',   cost:1400, on_hand:0, rop:0},
  {code:'COMP_MOTOR_FAN', name:'Fan Motor',                     cat:'MOTOR',       supplier:'Wolong Electric India',   cost:650,  on_hand:0, rop:0},
  {code:'COMP_SHEET_MET', name:'Sheet Metal Panels (set)',       cat:'SHEET_METAL', supplier:'JSW Steel Ltd',           cost:800,  on_hand:0, rop:0},
  {code:'COMP_PCB_MAIN',  name:'Main PCB Assembly',             cat:'PCB',         supplier:'Havells India Ltd',       cost:950,  on_hand:0, rop:0},
  {code:'COMP_WIRE_HRN',  name:'Wiring Harness',                cat:'WIRING',      supplier:'UNO Minda Group',         cost:320,  on_hand:0, rop:0},
  {code:'COMP_PLAS_LNR',  name:'Inner Plastic Liner',           cat:'PLASTIC',     supplier:'Vidarbha Industries',     cost:280,  on_hand:0, rop:0},
  {code:'COMP_PLAS_TUB',  name:'Plastic Tub Assembly',          cat:'PLASTIC',     supplier:'Vidarbha Industries',     cost:420,  on_hand:0, rop:0},
  {code:'COMP_HX_COIL',   name:'Heat Exchanger Coil',           cat:'SHEET_METAL', supplier:'JSW Steel Ltd',           cost:1100, on_hand:0, rop:0},
  {code:'COMP_DRUM_ASSY', name:'Front Load Drum Assembly',       cat:'SHEET_METAL', supplier:'JSW Steel Ltd',           cost:1600, on_hand:0, rop:0},
  {code:'COMP_MAGNETRON', name:'Magnetron Unit',                 cat:'ELECTRONIC',  supplier:'Havells India Ltd',       cost:750,  on_hand:0, rop:0},
  {code:'COMP_IND_COIL',  name:'Induction Coil Set (3-burner)', cat:'ELECTRONIC',  supplier:'Havells India Ltd',       cost:520,  on_hand:0, rop:0},
  {code:'COMP_GLASS_TOP', name:'Toughened Glass Top',            cat:'PLASTIC',     supplier:'Vidarbha Industries',     cost:380,  on_hand:0, rop:0},
];

// BOM: sku → [{code, qty}]
const BOM_DATA = {
  'REF_190L_DirectCool': [{code:'COMP_COMP_STD',qty:1},{code:'COMP_SHEET_MET',qty:3},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_PLAS_LNR',qty:2},{code:'COMP_HX_COIL',qty:1}],
  'REF_240L_FrostFree':  [{code:'COMP_COMP_STD',qty:1},{code:'COMP_SHEET_MET',qty:4},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_PLAS_LNR',qty:3},{code:'COMP_HX_COIL',qty:2}],
  'REF_340L_TripleDoor': [{code:'COMP_COMP_STD',qty:1},{code:'COMP_SHEET_MET',qty:5},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_PLAS_LNR',qty:4},{code:'COMP_HX_COIL',qty:2}],
  'WM_7KG_TopLoad':      [{code:'COMP_MOTOR_WM',qty:1},{code:'COMP_SHEET_MET',qty:2},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_PLAS_TUB',qty:1}],
  'WM_8KG_FrontLoad':    [{code:'COMP_MOTOR_WM',qty:1},{code:'COMP_SHEET_MET',qty:3},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_PLAS_TUB',qty:1},{code:'COMP_DRUM_ASSY',qty:1}],
  'WM_6.5KG_SemiAuto':   [{code:'COMP_MOTOR_WM',qty:1},{code:'COMP_PLAS_TUB',qty:2},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1}],
  'AC_1.5T_Inverter':    [{code:'COMP_COMP_INV',qty:1},{code:'COMP_SHEET_MET',qty:3},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_MOTOR_FAN',qty:2},{code:'COMP_HX_COIL',qty:2}],
  'AC_2.0T_Split':       [{code:'COMP_COMP_INV',qty:1},{code:'COMP_SHEET_MET',qty:3},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_MOTOR_FAN',qty:2},{code:'COMP_HX_COIL',qty:2}],
  'MW_25L_Convection':   [{code:'COMP_MAGNETRON',qty:1},{code:'COMP_SHEET_MET',qty:2},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1},{code:'COMP_MOTOR_FAN',qty:1}],
  'IH_3B_SmartGlass':    [{code:'COMP_IND_COIL',qty:3},{code:'COMP_GLASS_TOP',qty:1},{code:'COMP_PCB_MAIN',qty:1},{code:'COMP_WIRE_HRN',qty:1}],
};

const CUSTOMER_DATA = [
  {name:'Vijay Sales',          tier:1,channel:'MODERN_TRADE',region:'South'},
  {name:'Reliance Digital',     tier:1,channel:'MODERN_TRADE',region:'All'},
  {name:'Croma (Infiniti)',      tier:1,channel:'MODERN_TRADE',region:'All'},
  {name:'D-Mart',               tier:2,channel:'MODERN_TRADE',region:'West'},
  {name:'Amazon India',         tier:2,channel:'ECOMM',        region:'All'},
  {name:'Flipkart',             tier:2,channel:'ECOMM',        region:'All'},
  {name:'Regional Distributors',tier:3,channel:'WHOLESALE',    region:'All'},
];

// ── Phase 1: Pure in-memory computation ───────────────────────────────────
// No DB operations. Returns planning rows + derived on_hand values.

function computeAllPlanning() {
  const SKUS = Object.keys(FWD_BASE);

  // demand[sku][branch][week]
  const demand = {};
  for (const sku of SKUS) {
    demand[sku] = {};
    for (const b of BRANCHES) {
      demand[sku][b] = {};
      for (let w=1;w<=52;w++) demand[sku][b][w] = getWeeklyDemand(sku,b,w);
    }
  }

  // Capacity scale factors per plant per line-category per week.
  // scale[plantName][lineCategory][week] — how much of unconstrained we can actually make.
  const scale = {};
  for (const [plantName, locs] of Object.entries(PLANT_TO_LOCS)) {
    scale[plantName] = {};
    for (const lc of LINE_CATEGORIES) {
      const lineSkus = SKUS.filter(s => SKU_LINE_CAT[s] === lc.cat);
      const lineCapHrs = lc.hrsShift * lc.shifts * lc.days;
      scale[plantName][lc.cat] = {};
      for (let w=1;w<=52;w++) {
        let hrsNeeded = 0;
        for (const b of locs)
          for (const sku of lineSkus)
            hrsNeeded += demand[sku][b][w] * (1 + SAFETY_STOCK_WEEKS[sku]/10) * HOURS_PER_UNIT[sku];
        scale[plantName][lc.cat][w] = hrsNeeded > 0 ? Math.min(1, lineCapHrs / hrsNeeded) : 1;
      }
    }
  }

  // Location → plant lookup
  const locToPlant = {};
  for (const [p,locs] of Object.entries(PLANT_TO_LOCS)) for (const l of locs) locToPlant[l] = p;

  // compDraw[code][week] — total component units consumed across all planning orders per week
  const compDraw = {};
  for (const c of COMPONENT_DATA) { compDraw[c.code]={}; for (let w=1;w<=52;w++) compDraw[c.code][w]=0; }

  // Build rows and accumulate compDraw
  // rows is indexed by [sku][branch] for the inventory roll-forward, then flattened
  const rows = [];

  for (const sku of SKUS) {
    for (const branch of BRANCHES) {
      const plantName = locToPlant[branch];
      const lc        = SKU_LINE_CAT[sku];
      const hpu       = HOURS_PER_UNIT[sku];
      const ssWks     = SAFETY_STOCK_WEEKS[sku];
      const lineCapHrs = LINE_CATEGORIES.find(l=>l.cat===lc).hrsShift * 2 * 6;

      let prevEndInv = demand[sku][branch][1] * ssWks;

      for (let w=1;w<=52;w++) {
        const d   = demand[sku][branch][w];
        const sf  = scale[plantName][lc][w];
        const beginInv = prevEndInv;

        const targetEnd     = d * ssWks;
        const unconstr      = Math.max(0, d + targetEnd - beginInv);
        const prod          = Math.round(unconstr * sf * 10) / 10;

        const endInv    = Math.round(Math.max(0, beginInv + prod - d) * 10) / 10;
        const shortage  = Math.round(Math.max(0, d - beginInv - prod) * 10) / 10;
        const gap       = Math.round(Math.max(0, d - prod) * 10) / 10;
        const capReq    = Math.round(prod * hpu * 10) / 10;
        const capAvail  = Math.round(lineCapHrs / hpu * 10) / 10;
        const firmProd  = (w>=22&&w<=25) ? Math.round(prod*0.95*10)/10 : 0;

        rows.push({
          sku, branch,
          location_id: null,   // filled after DB inserts
          plant_id: null,
          production_line_id: null,
          week_number: w, year: 2026,
          scenario_id: null,   // filled after first INSERT
          forecast_demand:      Math.round(d*10)/10,
          customer_orders:      Math.round(d*0.82*10)/10,
          priority_demand:      Math.round(d*0.62*10)/10,
          beginning_inventory:  Math.round(beginInv*10)/10,
          planned_production:   prod,
          firm_production_orders: firmProd,
          purchase_orders:      0,
          transfer_orders:      0,
          ending_inventory:     endInv,
          capacity_available:   capAvail,
          capacity_required:    capReq,
          material_availability: 999,
          shortage_qty:         shortage,
          supply_gap:           gap,
        });

        // Accumulate component draw from this week's production
        for (const bl of (BOM_DATA[sku]||[]))
          compDraw[bl.code][w] += prod * bl.qty;

        prevEndInv = endInv;
      }
    }
  }

  // Derive on_hand from actual annualDraw
  //   Most components: 26 weeks of average draw (no shortage during demo)
  //   Tight components: 8 weeks → creates a visible shortage during peak
  const TIGHT = { 'COMP_COMP_INV': 8, 'COMP_DRUM_ASSY': 10 };
  const computedOnHand = {};
  const quarterlyReceipt = {};

  for (const c of COMPONENT_DATA) {
    const annualDraw = Object.values(compDraw[c.code]).reduce((s,v)=>s+v,0);
    const avgWeekly  = annualDraw / 52;
    const cover      = TIGHT[c.code] || 26;

    computedOnHand[c.code]   = Math.round(avgWeekly * cover);
    // Quarterly replenishment: 90% of quarterly demand for standard, 70% for tight
    // (tight components deliberately under-replenish → shortage builds in peak)
    const rate = TIGHT[c.code] ? 0.70 : 0.92;
    quarterlyReceipt[c.code] = Math.round(annualDraw / 4 * rate);
  }

  // Quarterly PO receipt weeks: mid-Q1, mid-Q2, mid-Q3 (no Q4 — tests year-end pressure)
  const PO_RECEIPT_WEEKS = [13, 27, 40];

  // Running balance per component with quarterly replenishment
  const weeklyBalance = {};
  for (const c of COMPONENT_DATA) {
    weeklyBalance[c.code] = {};
    let running = computedOnHand[c.code];
    for (let w=1;w<=52;w++) {
      if (PO_RECEIPT_WEEKS.includes(w)) running += quarterlyReceipt[c.code];
      weeklyBalance[c.code][w] = Math.max(0, running);
      running = Math.max(0, running - compDraw[c.code][w]);
    }
  }

  // Fill material_availability into each row
  // = min days-of-cover across all BOM components for that SKU in that week
  for (const row of rows) {
    let minCover = 999;
    for (const bl of (BOM_DATA[row.sku]||[])) {
      const avail  = weeklyBalance[bl.code][row.week_number];
      const weekly = compDraw[bl.code][row.week_number];
      if (weekly > 0) {
        const days = (avail / weekly) * 7;
        if (days < minCover) minCover = days;
      }
    }
    row.material_availability = Math.round(Math.min(999, minCover) * 10) / 10;
  }

  return { rows, computedOnHand, compDraw, quarterlyReceipt };
}

// ── Phase 2: DB operations ─────────────────────────────────────────────────

function seedSupply(force = false) {
  if (!force) {
    const checkDb = getDb();
    let cnt = 0;
    try { cnt = checkDb.prepare('SELECT COUNT(*) as c FROM planning_orders').get().c; } catch (_) {}
    checkDb.close();
    if (cnt > 0) {
      console.log('[seed_supply] planning_orders already has data — skipping seed.');
      return;
    }
  }

  // Compute everything before touching the DB
  const { rows, computedOnHand, compDraw, quarterlyReceipt } = computeAllPlanning();

  const db = getDb();

  // Idempotent clear (children before parents)
  for (const t of [
    'transfer_orders','purchase_orders','firm_production_orders',
    'planning_orders','scenario_supply_plans','plant_location_routing',
    'bom_lines','sku_planning_params','components','suppliers',
    'work_centers','production_lines','plants','customers','locations',
  ]) db.exec(`DELETE FROM ${t}`);

  // 1. Locations
  const insLoc = db.prepare(`INSERT INTO locations (name,region,state) VALUES (?,?,?)`);
  for (const l of LOCATION_DATA) insLoc.run(l.name,l.region,l.state);
  const locId = {};
  for (const r of db.prepare('SELECT location_id,name FROM locations').all()) locId[r.name]=r.location_id;

  // 2. Plants
  const insPlant = db.prepare(`INSERT INTO plants (name,city,state,region) VALUES (?,?,?,?)`);
  for (const p of PLANT_DATA) insPlant.run(p.name,p.city,p.state,p.region);
  const plantId = {};
  for (const r of db.prepare('SELECT plant_id,name FROM plants').all()) plantId[r.name]=r.plant_id;

  // 3. Production lines (5 categories × 3 plants = 15)
  const insLine = db.prepare(`INSERT INTO production_lines (plant_id,name,line_category,hours_per_shift,shifts_per_day,working_days_per_week) VALUES (?,?,?,?,?,?)`);
  for (const pd of PLANT_DATA)
    for (const lc of LINE_CATEGORIES)
      insLine.run(plantId[pd.name], `${pd.city} ${lc.name}`, lc.cat, lc.hrsShift, lc.shifts, lc.days);
  const lineId = {};
  for (const r of db.prepare('SELECT line_id,plant_id,line_category FROM production_lines').all())
    lineId[`${r.plant_id}:${r.line_category}`] = r.line_id;

  // 4. Work centers (Fabrication 40%, Assembly 40%, Testing 20% of weekly hrs)
  const insWC = db.prepare(`INSERT INTO work_centers (line_id,name,hours_available_per_week) VALUES (?,?,?)`);
  for (const r of db.prepare('SELECT line_id,hours_per_shift,shifts_per_day,working_days_per_week FROM production_lines').all()) {
    const wh = r.hours_per_shift * r.shifts_per_day * r.working_days_per_week;
    insWC.run(r.line_id,'Fabrication', Math.round(wh*0.40));
    insWC.run(r.line_id,'Assembly',    Math.round(wh*0.40));
    insWC.run(r.line_id,'Testing',     Math.round(wh*0.20));
  }

  // 5. Plant–location routing
  const insRoute = db.prepare(`INSERT INTO plant_location_routing (plant_id,location_id) VALUES (?,?)`);
  const locToPlant = {};
  for (const [pName,locs] of Object.entries(PLANT_TO_LOCS)) {
    for (const l of locs) { insRoute.run(plantId[pName], locId[l]); locToPlant[l]=pName; }
  }

  // 6. Suppliers
  const insSupp = db.prepare(`INSERT INTO suppliers (name,city,otif_pct,lead_time_days,payment_terms_days) VALUES (?,?,?,?,?)`);
  for (const s of SUPPLIER_DATA) insSupp.run(s.name,s.city,s.otif,s.ltd,s.pt);
  const suppId = {};
  for (const r of db.prepare('SELECT supplier_id,name FROM suppliers').all()) suppId[r.name]=r.supplier_id;

  // 7. Components — with computed on_hand values
  const insComp = db.prepare(`INSERT INTO components (code,name,category,supplier_id,unit_cost,on_hand_qty,reorder_point) VALUES (?,?,?,?,?,?,?)`);
  for (const c of COMPONENT_DATA) {
    const oh  = computedOnHand[c.code] || 0;
    const rop = Math.round(oh * 0.15);  // 15% of on_hand as reorder point
    insComp.run(c.code, c.name, c.cat, suppId[c.supplier], c.cost, oh, rop);
  }
  const compId = {};
  for (const r of db.prepare('SELECT component_id,code FROM components').all()) compId[r.code]=r.component_id;

  // 8. BOM lines
  const insBom = db.prepare(`INSERT INTO bom_lines (sku,component_id,qty_per) VALUES (?,?,?)`);
  for (const [sku,lines] of Object.entries(BOM_DATA))
    for (const l of lines) insBom.run(sku, compId[l.code], l.qty);

  // 9. SKU planning params
  const insParam = db.prepare(`INSERT INTO sku_planning_params (sku,hours_per_unit,safety_stock_weeks,line_category) VALUES (?,?,?,?)`);
  for (const [sku,hpu] of Object.entries(HOURS_PER_UNIT))
    insParam.run(sku, hpu, SAFETY_STOCK_WEEKS[sku], SKU_LINE_CAT[sku]);

  // 10. Customers
  const insCust = db.prepare(`INSERT INTO customers (name,priority_tier,channel,region) VALUES (?,?,?,?)`);
  for (const c of CUSTOMER_DATA) insCust.run(c.name,c.tier,c.channel,c.region);

  // 11. Supply scenarios
  const insScen = db.prepare(`INSERT INTO scenario_supply_plans (name,description,action_type,status) VALUES (?,?,?,?)`);
  insScen.run('Baseline Plan','Current capacity, standard lead times','BASELINE','active');
  insScen.run('Add Weekend Overtime','Add 8hrs Saturday on AC lines during peak (weeks 22–35)','ADD_OVERTIME','draft');
  insScen.run('Expedite Compressor POs','Pull Tecumseh POs forward 2 weeks to bridge Aug shortage','EXPEDITE_PO','draft');
  const baseScenId = db.prepare(`SELECT scenario_id FROM scenario_supply_plans WHERE action_type='BASELINE'`).get().scenario_id;

  // 12. Bulk-insert planning orders (with resolved IDs)
  const insPO = db.prepare(`
    INSERT INTO planning_orders (
      sku,location_id,plant_id,production_line_id,week_number,year,scenario_id,
      forecast_demand,customer_orders,priority_demand,
      beginning_inventory,planned_production,firm_production_orders,
      purchase_orders,transfer_orders,ending_inventory,
      capacity_available,capacity_required,material_availability,
      shortage_qty,supply_gap
    ) VALUES (
      @sku,@location_id,@plant_id,@production_line_id,@week_number,@year,@scenario_id,
      @forecast_demand,@customer_orders,@priority_demand,
      @beginning_inventory,@planned_production,@firm_production_orders,
      @purchase_orders,@transfer_orders,@ending_inventory,
      @capacity_available,@capacity_required,@material_availability,
      @shortage_qty,@supply_gap
    )`);

  const insertAll = db.transaction((rs) => {
    for (const r of rs) {
      r.location_id       = locId[r.branch];
      r.plant_id          = plantId[locToPlant[r.branch]];
      r.production_line_id = lineId[`${r.plant_id}:${SKU_LINE_CAT[r.sku]}`];
      r.scenario_id       = baseScenId;
      insPO.run(r);
    }
  });
  insertAll(rows);

  // 13. Firm production orders (near-term locked: weeks 22–25)
  const insFPO = db.prepare(`INSERT INTO firm_production_orders (sku,plant_id,production_line_id,week_number,year,qty,status,notes) VALUES (?,?,?,?,?,?,?,?)`);
  const fpoData = [
    {sku:'AC_1.5T_Inverter',  plant:'Pune Manufacturing Complex',   wk:22, qty:820},
    {sku:'AC_1.5T_Inverter',  plant:'Faridabad Technology Park',    wk:22, qty:550},
    {sku:'AC_1.5T_Inverter',  plant:'Chennai Production Hub',       wk:22, qty:1100},
    {sku:'AC_2.0T_Split',     plant:'Pune Manufacturing Complex',   wk:22, qty:480},
    {sku:'AC_2.0T_Split',     plant:'Chennai Production Hub',       wk:22, qty:640},
    {sku:'REF_240L_FrostFree',plant:'Pune Manufacturing Complex',   wk:23, qty:950},
    {sku:'REF_240L_FrostFree',plant:'Chennai Production Hub',       wk:23, qty:1200},
    {sku:'WM_7KG_TopLoad',    plant:'Faridabad Technology Park',    wk:23, qty:720},
    {sku:'AC_1.5T_Inverter',  plant:'Pune Manufacturing Complex',   wk:24, qty:900},
    {sku:'AC_1.5T_Inverter',  plant:'Chennai Production Hub',       wk:24, qty:1150},
  ];
  for (const f of fpoData) {
    const pid = plantId[f.plant];
    const lid = lineId[`${pid}:${SKU_LINE_CAT[f.sku]}`];
    insFPO.run(f.sku, pid, lid, f.wk, 2026, f.qty, 'firm', `Pre-season build wk${f.wk}`);
  }

  // 14. Purchase orders (main supplier replenishments — reflecting the quarterly PO logic)
  const insPoOrd = db.prepare(`INSERT INTO purchase_orders (component_id,supplier_id,qty,unit_cost,ordered_date,due_date,week_due,year_due,status) VALUES (?,?,?,?,?,?,?,?,?)`);
  // Quarterly PO receipts mapped to DB records
  const poRecords = [
    // Inverter compressor — Tecumseh (tight, 70% quarterly, weeks 13/27/40)
    {code:'COMP_COMP_INV', supp:'Tecumseh Products India', wk:13, ord:'2026-01-20', due:'2026-03-26'},
    {code:'COMP_COMP_INV', supp:'Tecumseh Products India', wk:27, ord:'2026-04-10', due:'2026-07-01'},
    {code:'COMP_COMP_INV', supp:'Tecumseh Products India', wk:40, ord:'2026-07-15', due:'2026-09-30'},
    // Drum assembly — JSW Steel (semi-tight, 70%)
    {code:'COMP_DRUM_ASSY',supp:'JSW Steel Ltd',           wk:13, ord:'2026-01-15', due:'2026-03-26'},
    {code:'COMP_DRUM_ASSY',supp:'JSW Steel Ltd',           wk:27, ord:'2026-04-05', due:'2026-07-01'},
    {code:'COMP_DRUM_ASSY',supp:'JSW Steel Ltd',           wk:40, ord:'2026-07-10', due:'2026-09-30'},
    // Standard compressor — Tecumseh (92%)
    {code:'COMP_COMP_STD', supp:'Tecumseh Products India', wk:13, ord:'2026-01-20', due:'2026-03-26'},
    {code:'COMP_COMP_STD', supp:'Tecumseh Products India', wk:27, ord:'2026-04-10', due:'2026-07-01'},
    {code:'COMP_COMP_STD', supp:'Tecumseh Products India', wk:40, ord:'2026-07-15', due:'2026-09-30'},
    // Sheet metal — JSW Steel (92%)
    {code:'COMP_SHEET_MET',supp:'JSW Steel Ltd',           wk:13, ord:'2026-01-10', due:'2026-03-26'},
    {code:'COMP_SHEET_MET',supp:'JSW Steel Ltd',           wk:27, ord:'2026-04-01', due:'2026-07-01'},
    {code:'COMP_SHEET_MET',supp:'JSW Steel Ltd',           wk:40, ord:'2026-07-05', due:'2026-09-30'},
  ];
  for (const p of poRecords) {
    const qty = quarterlyReceipt[p.code] || 1000;
    const cd  = COMPONENT_DATA.find(c=>c.code===p.code);
    insPoOrd.run(compId[p.code], suppId[p.supp], qty, cd.cost, p.ord, p.due, p.wk, 2026, 'open');
  }

  // 15. Transfer orders (inter-branch stock balancing)
  const insTO = db.prepare(`INSERT INTO transfer_orders (sku,from_location_id,to_location_id,qty,week_number,year,reason,status) VALUES (?,?,?,?,?,?,?,?)`);
  const toData = [
    {sku:'AC_1.5T_Inverter',   from:'Ahmedabad', to:'Mumbai',    qty:120, wk:25, reason:'Rebalance surplus pre-peak'},
    {sku:'AC_1.5T_Inverter',   from:'Pune',      to:'Mumbai',    qty: 80, wk:26, reason:'Mumbai shortage cover'},
    {sku:'AC_2.0T_Split',      from:'Hyderabad', to:'Bangalore', qty: 60, wk:27, reason:'South rebalance'},
    {sku:'REF_240L_FrostFree', from:'Kolkata',   to:'Chennai',   qty: 90, wk:30, reason:'Kolkata over-supply → Chennai gap'},
    {sku:'WM_7KG_TopLoad',     from:'Ahmedabad', to:'Pune',      qty: 45, wk:32, reason:'Year-end rebalance'},
    {sku:'AC_1.5T_Inverter',   from:'Bangalore', to:'Hyderabad', qty: 75, wk:33, reason:'Post-peak de-stock'},
  ];
  for (const t of toData)
    insTO.run(t.sku, locId[t.from], locId[t.to], t.qty, t.wk, 2026, t.reason, 'planned');

  db.close();

  // Summary
  const SKUS = Object.keys(FWD_BASE);
  console.log(`Supply seed complete:
  Locations:              ${LOCATION_DATA.length}
  Plants:                 ${PLANT_DATA.length}
  Production lines:       ${PLANT_DATA.length * LINE_CATEGORIES.length}
  Work centers:           ${PLANT_DATA.length * LINE_CATEGORIES.length * 3}
  Suppliers:              ${SUPPLIER_DATA.length}
  Components:             ${COMPONENT_DATA.length}
  BOM lines:              ${Object.values(BOM_DATA).flat().length}
  SKU planning params:    ${SKUS.length}
  Customers:              ${CUSTOMER_DATA.length}
  Planning orders:        ${rows.length}  (${SKUS.length} SKUs × ${BRANCHES.length} branches × 52 weeks)
  Firm production orders: ${fpoData.length}
  Purchase orders:        ${poRecords.length}
  Transfer orders:        ${toData.length}`);

  console.log('\nComponent on_hand values (derived from planned production):');
  for (const c of COMPONENT_DATA)
    console.log(`  ${c.code.padEnd(16)} ${String(computedOnHand[c.code]).padStart(8)}  quarterly_PO: ${quarterlyReceipt[c.code]}`);
}

if (require.main === module) seedSupply();
module.exports = seedSupply;
