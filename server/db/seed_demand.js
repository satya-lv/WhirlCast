'use strict';
const { getDb } = require('./schema');

// ─── Catalog ─────────────────────────────────────────────────────────────────
// Weekly base = monthly FWD_BASE[sku][0] / 4.33 (52 weeks / 12 months).
// Must stay in sync with seed.js PRODUCTS + FWD_BASE.
const SKUS = [
  { sku: 'REF_190L_DirectCool', weeklyBase: 74,  price: 12500 },
  { sku: 'REF_240L_FrostFree',  weeklyBase: 49,  price: 22000 },
  { sku: 'REF_340L_TripleDoor', weeklyBase: 32,  price: 32000 },
  { sku: 'WM_7KG_TopLoad',      weeklyBase: 60,  price: 18000 },
  { sku: 'WM_8KG_FrontLoad',    weeklyBase: 37,  price: 28000 },
  { sku: 'WM_6.5KG_SemiAuto',   weeklyBase: 44,  price:  9500 },
  { sku: 'AC_1.5T_Inverter',    weeklyBase: 134, price: 35000 },
  { sku: 'AC_2.0T_Split',       weeklyBase: 79,  price: 42000 },
  { sku: 'MW_25L_Convection',   weeklyBase: 22,  price: 11000 },
  { sku: 'IH_3B_SmartGlass',    weeklyBase: 17,  price:  8500 },
];

// location_id values must match migrate_supply.js locations seeding order.
// Branch factors match seed.js BRANCH_FACTOR keyed by name.
const LOCATIONS = [
  { locationId: 1, branchFactor: 1.25 }, // Mumbai
  { locationId: 2, branchFactor: 0.88 }, // Pune
  { locationId: 3, branchFactor: 0.85 }, // Ahmedabad
  { locationId: 4, branchFactor: 1.22 }, // New Delhi
  { locationId: 5, branchFactor: 0.95 }, // Kolkata
  { locationId: 6, branchFactor: 1.05 }, // Chennai
  { locationId: 7, branchFactor: 1.08 }, // Bangalore
  { locationId: 8, branchFactor: 0.98 }, // Hyderabad
];

// Same deterministic PRNG as seed.js — keeps outputs reproducible across runs.
function pseudoRand(seed) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return 0.85 + (x - Math.floor(x)) * 0.3; // [0.85, 1.15]
}

// Weekly seasonal factor. Same big-picture shape as hist2025Value() seasonal logic,
// with shoulder weeks (months 3 and 7) and a sine wobble for natural week-to-week texture.
function getSeasonalW(sku, weekNumber) {
  const month = Math.ceil(weekNumber * 12 / 52); // 1–12
  const isAC    = sku === 'AC_1.5T_Inverter' || sku === 'AC_2.0T_Split';
  const isDCRef = sku === 'REF_190L_DirectCool';
  let s = 1.0;
  if (isAC) {
    if      (month >= 4 && month <= 6)        s = 2.8;  // Apr–Jun peak
    else if (month === 3 || month === 7)       s = 1.6;  // shoulder
    else if (month >= 11 || month <= 2)        s = 0.15; // deep off-season
    // months 8–10 remain at 1.0
  } else if (isDCRef) {
    if      (month >= 4 && month <= 6)        s = 1.35;
    else if (month === 3 || month === 7)       s = 1.15;
  }
  // ±8% week-to-week sine wobble to avoid flat repeated monthly values
  return s * (1 + 0.08 * Math.sin((weekNumber - 1) * Math.PI / 4));
}

// ─── Override rows ────────────────────────────────────────────────────────────
// Three demo planner_adjustment rows seeded with non-zero values so the
// large_override exception category has real data to show in the Exceptions tab.
const DEMO_OVERRIDES = [
  // Mumbai, AC_1.5T, week 20 (May peak) — upward promo adjustment
  { sku: 'AC_1.5T_Inverter',    locationId: 1, weekNumber: 20, adj: 180 },
  // New Delhi, AC_2.0T, week 18 (April onset) — upward ranging adjustment
  { sku: 'AC_2.0T_Split',       locationId: 4, weekNumber: 18, adj: 100 },
  // Bangalore, REF_190L, week 5 (Feb) — downward correction
  { sku: 'REF_190L_DirectCool', locationId: 7, weekNumber:  5, adj: -20 },
];

// ─── ABC/XYZ Classification ───────────────────────────────────────────────────
// Exported so the future "Recalculate Classification" API button can call it
// independently without re-seeding all weekly data.
function computeAbcXyzClassification(db) {
  // National monthly totals per SKU from 2025 actuals in forecast_runs
  const rows = db.prepare(`
    SELECT sku, month, SUM(value) AS national_total
    FROM forecast_runs
    WHERE month LIKE '%-2025'
    GROUP BY sku, month
    ORDER BY sku, month
  `).all();

  const skuData = {};
  for (const r of rows) {
    if (!skuData[r.sku]) skuData[r.sku] = [];
    skuData[r.sku].push(r.national_total);
  }

  const stats = [];
  for (const [sku, values] of Object.entries(skuData)) {
    const n = values.length;
    const totalVolume = values.reduce((a, b) => a + b, 0);
    const mean = totalVolume / n;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const cov = mean > 0 ? Math.sqrt(variance) / mean : 0;
    stats.push({ sku, totalVolume, cov });
  }

  // ABC: rank high→low by total volume; assign by cumulative share.
  // Thresholds: A ≤ 80%, B ≤ 95%, C > 95% of total portfolio volume.
  stats.sort((a, b) => b.totalVolume - a.totalVolume);
  const grandTotal = stats.reduce((s, r) => s + r.totalVolume, 0);
  let cumShare = 0;
  for (const s of stats) {
    cumShare += s.totalVolume / grandTotal;
    s.abc_class = cumShare <= 0.80 ? 'A' : cumShare <= 0.95 ? 'B' : 'C';
  }

  // XYZ: by CoV. X = stable (< 0.5), Y = variable (0.5–1.0), Z = erratic (≥ 1.0).
  for (const s of stats) {
    s.xyz_class = s.cov < 0.5 ? 'X' : s.cov < 1.0 ? 'Y' : 'Z';
  }

  const now = new Date().toISOString();
  const update = db.prepare(
    'UPDATE product_master SET abc_class=?, xyz_class=?, cov=?, classification_updated_at=? WHERE sku=?'
  );
  db.transaction(() => {
    for (const s of stats) update.run(s.abc_class, s.xyz_class, s.cov, now, s.sku);
  })();

  console.log('[seed_demand] ABC/XYZ classification result:');
  for (const s of stats) {
    console.log(`  ${s.abc_class}/${s.xyz_class}  CoV=${s.cov.toFixed(3)}  vol=${Math.round(s.totalVolume).toLocaleString().padStart(8)}  ${s.sku}`);
  }
  return stats;
}

// ─── Main seed ────────────────────────────────────────────────────────────────
function seedDemand(force = false) {
  const db = getDb();

  if (!force) {
    let cnt = 0;
    try { cnt = db.prepare('SELECT COUNT(*) AS c FROM demand_weekly_data').get().c; } catch (_) {}
    if (cnt > 0) {
      console.log('[seed_demand] demand_weekly_data already has data — skipping seed.');
      db.close();
      return;
    }
  }

  try { db.exec('DELETE FROM demand_exceptions'); }  catch (_) {}
  try { db.exec('DELETE FROM demand_weekly_data'); } catch (_) {}

  const YEAR = 2025;

  const overrideKey = (sku, locationId, weekNumber) => `${sku}|${locationId}|${weekNumber}`;
  const overrideMap = {};
  for (const o of DEMO_OVERRIDES) overrideMap[overrideKey(o.sku, o.locationId, o.weekNumber)] = o.adj;

  const insertRow = db.prepare(`
    INSERT INTO demand_weekly_data
      (sku, location_id, week_number, year, actual_sales, system_forecast, planner_adjustment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // allRows held in memory for exception computation below.
  const allRows = [];

  db.transaction(() => {
    let skuIdx = 0;
    for (const { sku, weeklyBase, price } of SKUS) {
      let locIdx = 0;
      for (const { locationId, branchFactor } of LOCATIONS) {
        for (let wk = 1; wk <= 52; wk++) {
          const seasonal  = getSeasonalW(sku, wk);
          const actualSeed = skuIdx * 10000 + locIdx * 100 + wk;
          const actual    = Math.max(1, Math.round(weeklyBase * branchFactor * seasonal * pseudoRand(actualSeed)));

          // Forecast error: wider during seasonal extremes so MAPE exceptions trigger naturally.
          const fcastSeed  = actualSeed + 50000;
          const errorRange = (seasonal > 2.0 || seasonal < 0.2) ? 0.40 : 0.27;
          const fcastError = Math.min(1.30, Math.max(0.70, 0.88 + pseudoRand(fcastSeed) * errorRange));
          const forecast   = Math.max(1, Math.round(actual * fcastError));

          const plannerAdj = overrideMap[overrideKey(sku, locationId, wk)] || 0;

          insertRow.run(sku, locationId, wk, YEAR, actual, forecast, plannerAdj);
          allRows.push({ sku, locationId, weekNumber: wk, actual, forecast, plannerAdj, price, seasonal });
        }
        locIdx++;
      }
      skuIdx++;
    }
  })();
  console.log(`[seed_demand] Inserted ${allRows.length} weekly demand rows (${SKUS.length} SKUs × ${LOCATIONS.length} locations × 52 weeks).`);

  // ── ABC/XYZ ──────────────────────────────────────────────────────────────
  computeAbcXyzClassification(db);

  // ── Exceptions ───────────────────────────────────────────────────────────
  const insertExc = db.prepare(`
    INSERT INTO demand_exceptions
      (sku, location_id, week_number, year, category, severity, financial_impact, title, detail, recommendation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    // ── 1. Forecast accuracy degradation ─────────────────────────────────
    // Compute MAPE and MAE per SKU-location from the seeded actuals vs system_forecast.
    const accData = {};
    for (const r of allRows) {
      const k = `${r.sku}|${r.locationId}`;
      if (!accData[k]) accData[k] = { sku: r.sku, locationId: r.locationId, price: r.price, mapeErrors: [], absErrors: [], rows: [] };
      if (r.actual > 0) {
        accData[k].mapeErrors.push(Math.abs(r.actual - r.forecast) / r.actual);
        accData[k].absErrors.push(Math.abs(r.actual - r.forecast));
        accData[k].rows.push(r);
      }
    }
    const accList = Object.values(accData).map(d => {
      const n = d.mapeErrors.length;
      return {
        ...d,
        mape: n > 0 ? d.mapeErrors.reduce((a, b) => a + b, 0) / n : 0,
        mae:  n > 0 ? d.absErrors.reduce((a, b) => a + b, 0) / n : 0,
      };
    }).sort((a, b) => b.mape - a.mape);

    for (const m of accList.slice(0, 4)) {
      if (m.mape < 0.10) continue;
      const severity = m.mape > 0.20 ? 'high' : m.mape > 0.15 ? 'medium' : 'low';
      const impact   = Math.round(m.mae * 52 * m.price);
      const worstRow = m.rows.sort((a, b) => Math.abs(b.actual - b.forecast) / b.actual - Math.abs(a.actual - a.forecast) / a.actual)[0];
      const pctStr   = (m.mape * 100).toFixed(1);
      const skuShort = m.sku.split('_').slice(0, 2).join(' ');
      insertExc.run(
        m.sku, m.locationId, worstRow.weekNumber, YEAR,
        'accuracy_degradation', severity, impact,
        `Forecast accuracy degradation — ${skuShort} @ loc ${m.locationId}`,
        `MAPE is ${pctStr}% over 52 weeks. System forecast consistently misses actual demand by a wide margin.`,
        'Review algorithm selection for this SKU-location. Consider raising safety stock until accuracy improves.'
      );
    }

    // ── 2. Large unexplained planner override ─────────────────────────────
    for (const r of allRows.filter(a => Math.abs(a.plannerAdj) > 0)) {
      if (r.forecast === 0) continue;
      const pct = Math.abs(r.plannerAdj) / r.forecast;
      if (pct < 0.15) continue;
      const severity  = pct > 0.40 ? 'high' : pct > 0.25 ? 'medium' : 'low';
      const impact    = Math.round(Math.abs(r.plannerAdj) * r.price);
      const direction = r.plannerAdj > 0 ? 'upward' : 'downward';
      const skuShort  = r.sku.split('_').slice(0, 2).join(' ');
      insertExc.run(
        r.sku, r.locationId, r.weekNumber, YEAR,
        'large_override', severity, impact,
        `Large ${direction} planner override — ${skuShort} Wk ${r.weekNumber}`,
        `Planner adjusted system forecast by ${(pct * 100).toFixed(0)}% (${r.plannerAdj > 0 ? '+' : ''}${r.plannerAdj} units) with no documented reason captured.`,
        'Review and document the justification for this override before the planning cycle closes.'
      );
    }

    // ── 3. Demand pattern shift ───────────────────────────────────────────
    // Flag AC SKUs at high-volume locations where H1 (wk 1–26) mean demand
    // differs from H2 (wk 27–52) mean by > 2.0×, signalling a structural seasonal shift.
    const AC_SKUS    = ['AC_1.5T_Inverter', 'AC_2.0T_Split'];
    const HV_LOCS    = [1, 4, 7]; // Mumbai, New Delhi, Bangalore
    for (const sku of AC_SKUS) {
      for (const locationId of HV_LOCS) {
        const rows = allRows.filter(r => r.sku === sku && r.locationId === locationId);
        const h1   = rows.filter(r => r.weekNumber <= 26).map(r => r.actual);
        const h2   = rows.filter(r => r.weekNumber > 26).map(r => r.actual);
        const m1   = h1.reduce((a, b) => a + b, 0) / h1.length;
        const m2   = h2.reduce((a, b) => a + b, 0) / h2.length;
        if (m1 === 0 || m2 === 0) continue;
        const ratio = Math.max(m1, m2) / Math.min(m1, m2);
        if (ratio < 2.0) continue;
        const priceLookup = SKUS.find(s => s.sku === sku).price;
        const impact = Math.round(Math.abs(m1 - m2) * 26 * priceLookup);
        const skuShort = sku.split('_').slice(0, 2).join(' ');
        insertExc.run(
          sku, locationId, 27, YEAR,
          'pattern_shift', 'medium', impact,
          `Demand pattern shift — ${skuShort} H1 vs H2 seasonal swing`,
          `H1 avg demand (${Math.round(m1)}/wk) differs from H2 avg (${Math.round(m2)}/wk) by ${ratio.toFixed(1)}×. Seasonal planning assumptions from H1 no longer represent current demand structure.`,
          'Update the planning strategy for this SKU-location. Consider a split seasonality model for the next planning cycle.'
        );
      }
    }

    // ── 4. New-product risk ───────────────────────────────────────────────
    // REF_190L and REF_240L are renovated SKUs (present in lfl_master). Flag them
    // at lower-volume locations where < 2 yrs of post-renovation actuals reduce
    // baseline confidence.
    const NPI_SKUS  = ['REF_190L_DirectCool', 'REF_240L_FrostFree'];
    const LV_LOCS   = [2, 3]; // Pune (0.88), Ahmedabad (0.85) — two lowest branch factors
    for (const sku of NPI_SKUS) {
      for (const locationId of LV_LOCS) {
        const rows = allRows.filter(r => r.sku === sku && r.locationId === locationId);
        const totalActual = rows.reduce((a, r) => a + r.actual, 0);
        const priceLookup = SKUS.find(s => s.sku === sku).price;
        const skuShort = sku.split('_').slice(0, 2).join(' ');
        insertExc.run(
          sku, locationId, 1, YEAR,
          'npi_risk', 'low', Math.round(totalActual * 0.10 * priceLookup / 52),
          `NPI risk — renovated SKU, limited post-launch history`,
          `${skuShort} is a recently renovated model (LFL successor). This location has < 24 months of post-renovation actuals, limiting forecast confidence in low-volume markets.`,
          'Monitor weekly actuals closely for the next 8 weeks. Apply a statistical safety buffer until the post-renovation demand pattern stabilises.'
        );
      }
    }
  })();

  db.close();
  console.log('[seed_demand] Exception seeding complete.');
}

if (require.main === module) seedDemand();
module.exports = { seedDemand, computeAbcXyzClassification };
