'use strict';
/**
 * demand_planning.js — Demand Planning Workbench API (Step A.2 + A.3.5)
 *
 * Endpoints:
 *   GET   /api/demand-planning/filters
 *   GET   /api/demand-planning/kpis
 *   GET   /api/demand-planning/grid
 *   PATCH /api/demand-planning/grid/adjustment
 *   GET   /api/demand-planning/patterns
 *   POST  /api/demand-planning/patterns/recalculate-classification
 *   GET   /api/demand-planning/exceptions
 *   PATCH /api/demand-planning/exceptions/:id/acknowledge
 *   POST  /api/demand-planning/whatif
 *   GET   /api/demand-planning/npi/predecessor-stats
 *   POST  /api/demand-planning/model/recalculate
 *   POST  /api/demand-planning/model/finalize
 */
const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/schema');
const { computeAbcXyzClassification } = require('../db/seed_demand');

const EDITABLE_FROM_WEEK = 24;
const DEMAND_YEAR        = 2025;

// ── Shared helpers ─────────────────────────────────────────────────────────

// SKU family → member SKUs (mirrors seed.js PRODUCTS categories)
const SKU_FAMILIES = {
  'Air Conditioner':          ['AC_1.5T_Inverter', 'AC_2.0T_Split'],
  'Direct Cool Refrigerator': ['REF_190L_DirectCool'],
  'Frost Free Refrigerator':  ['REF_240L_FrostFree', 'REF_340L_TripleDoor'],
  'Washing Machine':          ['WM_7KG_TopLoad', 'WM_8KG_FrontLoad', 'WM_6.5KG_SemiAuto'],
  'Microwave':                ['MW_25L_Convection'],
  'Induction':                ['IH_3B_SmartGlass'],
};

// Builds a WHERE clause + params array for demand_weekly_data (alias dwd)
// joined to product_master (alias pm). All filters are optional.
function buildDemandWhere(query) {
  const conds  = [`dwd.year = ${DEMAND_YEAR}`];
  const params = [];

  if (query.locationId) {
    conds.push('dwd.location_id = ?');
    params.push(parseInt(query.locationId));
  }
  if (query.sku) {
    conds.push('dwd.sku = ?');
    params.push(query.sku);
  }
  if (query.skuFamily && SKU_FAMILIES[query.skuFamily]) {
    const skus = SKU_FAMILIES[query.skuFamily];
    conds.push(`dwd.sku IN (${skus.map(() => '?').join(',')})`);
    params.push(...skus);
  }
  if (query.abcClass) {
    conds.push('pm.abc_class = ?');
    params.push(query.abcClass);
  }
  if (query.xyzClass) {
    conds.push('pm.xyz_class = ?');
    params.push(query.xyzClass);
  }

  return { where: conds.join(' AND '), params };
}

// Linear regression slope (units per week) over an ordered array of values.
function regressionSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// Classify a SKU's demand pattern from its 52 ordered weekly national totals.
// Priority when multiple rules fire: Seasonal > Trend > Random > Stable.
// Thresholds:
//   Seasonal = max(H1_mean, H2_mean) / min > 2.0
//   Trend    = |regression slope| > 5% of overall mean per week
//   Random   = CoV >= 0.5 and not Seasonal
//   Stable   = remainder
function classifyPattern(weeklyTotals) {
  const n = weeklyTotals.length;
  if (n < 4) return { patternType: 'Intermittent', h1h2Ratio: 1, slopePctOfMean: 0 };

  const h1Mean = weeklyTotals.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  const h2Mean = weeklyTotals.slice(26, 52).reduce((a, b) => a + b, 0) / 26;
  const h1h2Ratio = (h1Mean > 0 && h2Mean > 0)
    ? parseFloat((Math.max(h1Mean, h2Mean) / Math.min(h1Mean, h2Mean)).toFixed(2))
    : 1;

  const overall = weeklyTotals.reduce((a, b) => a + b, 0) / n;
  const slope   = regressionSlope(weeklyTotals);
  const slopePctOfMean = overall > 0
    ? parseFloat(Math.abs((slope / overall)).toFixed(4))
    : 0;

  const variance = weeklyTotals.reduce((s, v) => s + (v - overall) ** 2, 0) / n;
  const cov      = overall > 0 ? Math.sqrt(variance) / overall : 0;

  let patternType;
  if      (h1h2Ratio > 2.0)       patternType = 'Seasonal';
  else if (slopePctOfMean > 0.05)  patternType = 'Trend';
  else if (cov >= 0.5)             patternType = 'Random';
  else                             patternType = 'Intermittent';

  return { patternType, h1h2Ratio, slopePctOfMean };
}

// ── Model forecasting helpers ──────────────────────────────────────────────

const FORECAST_MODELS = [
  'Auto Selected',
  'SARIMAX', 'Prophet', 'VAR/VARMAX', 'GARCH', 'LSTM', 'Encoder-Decoder',
  'Multi-Linear Regression', 'Decision Trees', 'Random Forest', 'Boosting-XGB', 'SVM', 'ANN',
];
const PROPHET_PHI = 0.90;  // damping factor (Gardner & McKenzie 1985)

// OLS linear regression: returns { alpha, beta } or null if n < 2
function computeOLSLinearFit(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const xMean = xs.reduce((s, x) => s + x, 0) / n;
  const yMean = ys.reduce((s, y) => s + y, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const beta  = den === 0 ? 0 : num / den;
  const alpha = yMean - beta * xMean;
  return { alpha, beta };
}

// Prophet-style forecast with damped trend (phi = PROPHET_PHI).
// Decomposition: de-seasonalize historical actuals → OLS trend fit → re-seasonalize.
// Seasonal factors S(w) derived from SARIMAX system_forecast as ratio-to-mean.
// Returns { [weekNumber]: forecastValue } or null (fall back to SARIMAX if <3 hist weeks).
function computeProphetForecast(weekData, phi) {
  // Step 1: seasonal factors from system_forecast
  const meanForecast = weekData.reduce((s, r) => s + r.systemForecast, 0) / weekData.length;
  if (meanForecast === 0) return null;

  const S = {};
  for (const r of weekData) S[r.weekNumber] = r.systemForecast / meanForecast;

  // Step 2: de-seasonalize historical actuals (weeks 1-23, non-zero)
  const histRows = weekData.filter(r => r.weekNumber < 24 && r.actualSales > 0);
  if (histRows.length < 3) return null;  // insufficient history

  const xs = histRows.map(r => r.weekNumber);
  const ys = histRows.map(r => {
    const s = S[r.weekNumber] || 1;
    return s > 0 ? r.actualSales / s : r.actualSales;
  });

  // Step 3: OLS on de-seasonalized actuals
  const fit = computeOLSLinearFit(xs, ys);
  if (!fit) return null;
  const { alpha, beta } = fit;

  // Level at end of history (week 23)
  const L = alpha + beta * 23;

  // Step 4: project with damped trend and re-seasonalize
  const results = {};
  for (const r of weekData) {
    const t = r.weekNumber;
    let trendDS;
    if (t <= 23) {
      trendDS = alpha + beta * t;
    } else {
      // Damped trend: accumulated slope = β × φ × (1 - φ^h) / (1 - φ)
      const h = t - 23;
      const accSlope = beta * phi * (1 - Math.pow(phi, h)) / (1 - phi);
      trendDS = L + accSlope;
    }
    results[t] = Math.max(0, Math.round(trendDS * (S[t] || 1)));
  }
  return results;
}

// ── GET /api/demand-planning/filters ──────────────────────────────────────

router.get('/filters', (req, res) => {
  try {
    const db = getDb();
    const locations = db.prepare(`
      SELECT location_id AS locationId, name, region
      FROM locations
      ORDER BY region, name
    `).all();
    const skus = db.prepare(`
      SELECT sku, category, abc_class AS abcClass, xyz_class AS xyzClass
      FROM product_master
      WHERE active = 1
      ORDER BY category, sku
    `).all();
    db.close();
    res.json({
      locations,
      skuFamilies: Object.keys(SKU_FAMILIES),
      skus,
      abcClasses: ['A', 'B', 'C'],
      xyzClasses: ['X', 'Y', 'Z'],
      weekRange:  { min: 1, max: 52, editableFrom: EDITABLE_FROM_WEEK, year: DEMAND_YEAR },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/demand-planning/kpis ─────────────────────────────────────────
// All 8 KPI bar values. Query params apply the same filters as /grid.
// Each KPI includes a `source` field tracing the number back to its table/column.

router.get('/kpis', (req, res) => {
  try {
    const db = getDb();
    const { where, params } = buildDemandWhere(req.query);

    // Single-pass aggregate for most KPIs
    const agg = db.prepare(`
      SELECT
        SUM(dwd.final_consensus)                                                                  AS totalForecastDemand,
        SUM(dwd.final_consensus * pm.price)                                                       AS revenueForecast,
        COUNT(CASE WHEN dwd.planner_adjustment != 0 THEN 1 END)                                  AS openPlannerAdjustments,
        AVG(CASE WHEN dwd.actual_sales > 0
              THEN ABS(dwd.actual_sales - dwd.system_forecast) * 1.0 / dwd.actual_sales
              ELSE NULL END)                                                                       AS mape,
        AVG(CASE WHEN dwd.actual_sales > 0
              THEN (dwd.system_forecast - dwd.actual_sales) * 1.0 / dwd.actual_sales
              ELSE NULL END)                                                                       AS bias,
        SUM(CASE WHEN pm.abc_class = 'A' THEN dwd.final_consensus ELSE 0 END)                   AS aClassDemand
      FROM demand_weekly_data dwd
      JOIN product_master pm ON dwd.sku = pm.sku
      WHERE ${where} AND dwd.week_number >= ${EDITABLE_FROM_WEEK}
    `).get(...params);

    // Inventory days: demand-weighted average of safety_stock_weeks × 7 per SKU.
    // Joining to planning_orders would misalign years (2026 supply vs 2025 demand),
    // so sku_planning_params.safety_stock_weeks is the cleanest available proxy.
    const invRows = db.prepare(`
      SELECT dwd.sku,
             spp.safety_stock_weeks,
             AVG(dwd.final_consensus) AS meanWeeklyDemand
      FROM demand_weekly_data dwd
      JOIN sku_planning_params spp ON dwd.sku = spp.sku
      JOIN product_master pm       ON dwd.sku = pm.sku
      WHERE ${where} AND dwd.week_number >= ${EDITABLE_FROM_WEEK}
      GROUP BY dwd.sku
    `).all(...params);

    let weightedDays = 0, totalWeight = 0;
    for (const r of invRows) {
      weightedDays += r.safety_stock_weeks * 7 * r.meanWeeklyDemand;
      totalWeight  += r.meanWeeklyDemand;
    }
    const inventoryDays = totalWeight > 0
      ? parseFloat((weightedDays / totalWeight).toFixed(1))
      : 0;

    // Open exceptions count is portfolio-wide (not filtered by SKU/location)
    const openExcCount = db.prepare(
      'SELECT COUNT(*) AS c FROM demand_exceptions WHERE acknowledged = 0'
    ).get().c;

    db.close();

    const totalDemand  = agg.totalForecastDemand || 0;
    const aClassDemand = agg.aClassDemand        || 0;
    const mape         = agg.mape                || 0;
    const bias         = agg.bias                || 0;

    res.json({
      kpis: {
        totalForecastDemand: {
          value:  Math.round(totalDemand),
          unit:   'units',
          label:  'Total Forecast Demand',
          source: `SUM(final_consensus) — demand_weekly_data, weeks ${EDITABLE_FROM_WEEK}–52 (current planning horizon), filtered set`,
        },
        forecastAccuracyPct: {
          value:  parseFloat(((1 - mape) * 100).toFixed(1)),
          unit:   '%',
          label:  'Forecast Accuracy %',
          source: '(1 − MAPE) × 100, MAPE = mean(|actual_sales − system_forecast| / actual_sales) WHERE actual_sales > 0',
        },
        biasPct: {
          value:  parseFloat((bias * 100).toFixed(1)),
          unit:   '%',
          label:  'Bias %',
          source: 'mean((system_forecast − actual_sales) / actual_sales) × 100; positive = systematic over-forecast',
        },
        openPlannerAdjustments: {
          value:  agg.openPlannerAdjustments || 0,
          unit:   'count',
          label:  'Open Planner Adjustments',
          source: 'COUNT(rows WHERE planner_adjustment ≠ 0) — demand_weekly_data, filtered set',
        },
        revenueForecast: {
          value:  Math.round(agg.revenueForecast || 0),
          unit:   'INR',
          label:  'Revenue Forecast',
          source: 'SUM(final_consensus × price) — demand_weekly_data JOIN product_master, filtered set',
        },
        inventoryDays: {
          value:  inventoryDays,
          unit:   'days',
          label:  'Target Inventory Coverage',
          source: 'Demand-weighted avg of (safety_stock_weeks × 7) from sku_planning_params; proxy for target coverage days since no ending_inventory exists in demand_weekly_data',
        },
        aClassCoveragePct: {
          value:  totalDemand > 0
            ? parseFloat((aClassDemand / totalDemand * 100).toFixed(1))
            : 0,
          unit:   '%',
          label:  'A-Class Coverage %',
          source: "SUM(final_consensus WHERE abc_class='A') / SUM(final_consensus) × 100 — demand_weekly_data JOIN product_master",
        },
        openExceptions: {
          value:  openExcCount,
          unit:   'count',
          label:  'Open Exceptions',
          source: 'COUNT(*) FROM demand_exceptions WHERE acknowledged = 0 (portfolio-wide, not filtered)',
        },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/demand-planning/grid ─────────────────────────────────────────
// 52-week planning grid. Rows = sku × location combos; cells keyed by week_number.
// Query params: locationId, skuFamily, sku, abcClass, xyzClass,
//               weekStart (def 1), weekEnd (def 52), page (def 1), pageSize (def 20)

router.get('/grid', (req, res) => {
  try {
    const db       = getDb();
    const weekStart = Math.max(1,  Math.min(52, parseInt(req.query.weekStart) || 1));
    const rawEnd    = parseInt(req.query.weekEnd) || 52;
    const weekEnd   = Math.max(weekStart, Math.min(52, rawEnd));
    const page      = Math.max(1, parseInt(req.query.page)     || 1);
    const pageSize  = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));

    const { where, params } = buildDemandWhere(req.query);

    // Total distinct sku-location combos for pagination metadata
    const { n: total } = db.prepare(`
      SELECT COUNT(DISTINCT dwd.sku || '|' || dwd.location_id) AS n
      FROM demand_weekly_data dwd
      JOIN product_master pm ON dwd.sku = pm.sku
      WHERE ${where}
    `).get(...params);

    // All cells in [weekStart, weekEnd] for the filtered set
    const cells = db.prepare(`
      SELECT dwd.sku, dwd.location_id, dwd.week_number,
             dwd.actual_sales, dwd.system_forecast,
             dwd.planner_adjustment, dwd.branch_adjustment, dwd.category_adjustment,
             dwd.final_consensus,
             l.name AS location_name, l.region,
             pm.category AS sku_family, pm.abc_class, pm.xyz_class
      FROM demand_weekly_data dwd
      JOIN locations l     ON dwd.location_id = l.location_id
      JOIN product_master pm ON dwd.sku = pm.sku
      WHERE ${where} AND dwd.week_number BETWEEN ? AND ?
      ORDER BY pm.category, dwd.sku, l.region, l.name, dwd.week_number
    `).all(...params, weekStart, weekEnd);

    // Group cells into rows keyed by sku|locationId
    const rowMap = new Map();
    for (const c of cells) {
      const key = `${c.sku}|${c.location_id}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          sku:          c.sku,
          skuFamily:    c.sku_family,
          abcClass:     c.abc_class,
          xyzClass:     c.xyz_class,
          locationId:   c.location_id,
          locationName: c.location_name,
          region:       c.region,
          cells:        {},
        });
      }
      rowMap.get(key).cells[c.week_number] = {
        actualSales:         c.actual_sales,
        systemForecast:      c.system_forecast,
        marketingAdjustment: c.planner_adjustment,
        branchAdjustment:    c.branch_adjustment,
        categoryAdjustment:  c.category_adjustment,
        finalConsensus:      c.final_consensus,
        editable:            c.week_number >= EDITABLE_FROM_WEEK,
      };
    }

    const allRows  = [...rowMap.values()];
    const pageRows = allRows.slice((page - 1) * pageSize, page * pageSize);

    db.close();
    res.json({
      weeks:      Array.from({ length: weekEnd - weekStart + 1 }, (_, i) => weekStart + i),
      weekRange:  { start: weekStart, end: weekEnd, editableFrom: EDITABLE_FROM_WEEK },
      year:       DEMAND_YEAR,
      rows:       pageRows,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/demand-planning/grid/adjustment ────────────────────────────
// Update a single adjustment cell and recompute final_consensus.
//
// New format:  { sku, locationId, weekNumber, year?, measureKey, value }
//   measureKey: 'marketingAdjustment' | 'branchAdjustment' | 'categoryAdjustment'
//
// Legacy format (What-If apply — always writes Marketing Adjustment):
//   { sku, locationId, weekNumber, year?, plannerAdjustment }

const ADJUSTMENT_COLUMN_MAP = {
  marketingAdjustment: 'planner_adjustment',
  branchAdjustment:    'branch_adjustment',
  categoryAdjustment:  'category_adjustment',
};

router.patch('/grid/adjustment', (req, res) => {
  try {
    const { sku, locationId, weekNumber, measureKey, value, plannerAdjustment } = req.body;
    const year = parseInt(req.body.year) || DEMAND_YEAR;

    let colName, adjValue;
    if (measureKey && ADJUSTMENT_COLUMN_MAP[measureKey] !== undefined) {
      colName  = ADJUSTMENT_COLUMN_MAP[measureKey];
      adjValue = parseFloat(value);
    } else if (plannerAdjustment !== undefined && plannerAdjustment !== null) {
      colName  = 'planner_adjustment';
      adjValue = parseFloat(plannerAdjustment);
    } else {
      return res.status(400).json({ error: 'measureKey+value or plannerAdjustment required' });
    }

    if (!sku || locationId == null || weekNumber == null || isNaN(adjValue)) {
      return res.status(400).json({ error: 'sku, locationId, weekNumber, and a valid value are required' });
    }

    const wk    = parseInt(weekNumber);
    const locId = parseInt(locationId);

    if (wk < EDITABLE_FROM_WEEK) {
      return res.status(400).json({
        error: `Week ${wk} is a locked historical week (editable from week ${EDITABLE_FROM_WEEK})`,
      });
    }

    const db = getDb();

    const result = db.prepare(`
      UPDATE demand_weekly_data
      SET ${colName} = ?
      WHERE sku = ? AND location_id = ? AND week_number = ? AND year = ?
    `).run(adjValue, sku, locId, wk, year);

    if (result.changes === 0) {
      db.close();
      return res.status(404).json({ error: 'Row not found' });
    }

    // Recompute and persist final_consensus (no longer a GENERATED column)
    db.prepare(`
      UPDATE demand_weekly_data
      SET final_consensus = system_forecast + planner_adjustment + branch_adjustment + category_adjustment
      WHERE sku = ? AND location_id = ? AND week_number = ? AND year = ?
    `).run(sku, locId, wk, year);

    const updated = db.prepare(`
      SELECT sku,
             location_id         AS locationId,
             week_number         AS weekNumber,
             year,
             system_forecast     AS systemForecast,
             planner_adjustment  AS marketingAdjustment,
             branch_adjustment   AS branchAdjustment,
             category_adjustment AS categoryAdjustment,
             final_consensus     AS finalConsensus
      FROM demand_weekly_data
      WHERE sku = ? AND location_id = ? AND week_number = ? AND year = ?
    `).get(sku, locId, wk, year);

    db.close();
    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/demand-planning/patterns ─────────────────────────────────────
// Returns three sub-sections:
//   classificationDistribution — Trend/Seasonal/Stable/Random counts, per-SKU nationally
//   scatter                    — 10 points (one per SKU), x=volume, y=CoV
//   table                      — 80 rows (SKU × location), filtered; badge = per-SKU class

router.get('/patterns', (req, res) => {
  try {
    const db = getDb();

    // ── National weekly totals per SKU (full portfolio, no filters) ──────
    // Used for both classificationDistribution and scatter.
    const nationalRows = db.prepare(`
      SELECT sku, week_number, SUM(actual_sales) AS national_total
      FROM demand_weekly_data
      WHERE year = ${DEMAND_YEAR}
      GROUP BY sku, week_number
      ORDER BY sku, week_number
    `).all();

    // Build SKU → [52 weekly totals in order] map
    const skuWeekly = {};
    for (const r of nationalRows) {
      if (!skuWeekly[r.sku]) skuWeekly[r.sku] = [];
      skuWeekly[r.sku].push(r.national_total);
    }

    // National annual volume per SKU (for scatter x-axis)
    const annualNational = {};
    for (const [sku, weeks] of Object.entries(skuWeekly)) {
      annualNational[sku] = weeks.reduce((a, b) => a + b, 0);
    }

    // Product master (abc/xyz/cov for all SKUs)
    const pmAll = db.prepare(`
      SELECT sku, category, abc_class AS abcClass, xyz_class AS xyzClass, cov
      FROM product_master
      WHERE active = 1
      ORDER BY category, sku
    `).all();

    // Classify each SKU and collect results (always from full portfolio — needed for table patternType)
    const classificationBySku = {};
    for (const pm of pmAll) {
      const weekly = skuWeekly[pm.sku] || [];
      classificationBySku[pm.sku] = classifyPattern(weekly);
    }

    // Apply SKU-level filters to determine which SKUs appear in bar chart + scatter.
    // locationId is intentionally NOT applied here — pattern classification is per-SKU,
    // not per-location, so filtering by branch would give a misleading classification count.
    let visiblePm = pmAll;
    if (req.query.skuFamily && SKU_FAMILIES[req.query.skuFamily]) {
      const allowed = new Set(SKU_FAMILIES[req.query.skuFamily]);
      visiblePm = visiblePm.filter(pm => allowed.has(pm.sku));
    }
    if (req.query.sku) {
      visiblePm = visiblePm.filter(pm => pm.sku === req.query.sku);
    }
    if (req.query.abcClass) {
      visiblePm = visiblePm.filter(pm => pm.abcClass === req.query.abcClass);
    }
    if (req.query.xyzClass) {
      visiblePm = visiblePm.filter(pm => pm.xyzClass === req.query.xyzClass);
    }

    // ── classificationDistribution ───────────────────────────────────────
    const counts = { Seasonal: 0, Trend: 0, Random: 0, Intermittent: 0 };
    for (const pm of visiblePm) {
      const { patternType } = classificationBySku[pm.sku] || {};
      if (patternType && counts[patternType] !== undefined) counts[patternType]++;
    }

    const classificationDistribution = {
      counts,
      total: visiblePm.length,
      methodology:
        'Seasonal = H1/H2 demand ratio > 2.0; Trend = |regression slope| > 5% of mean/week; Random = CoV ≥ 0.5 and not Seasonal; Intermittent = remainder. Computed from national weekly totals (SUM across 8 locations) in demand_weekly_data.',
      bySku: visiblePm.map(pm => ({
        sku:            pm.sku,
        patternType:    classificationBySku[pm.sku].patternType,
        h1h2Ratio:      classificationBySku[pm.sku].h1h2Ratio,
        slopePctOfMean: classificationBySku[pm.sku].slopePctOfMean,
        cov:            parseFloat((pm.cov || 0).toFixed(3)),
      })),
    };

    // ── scatter ───────────────────────────────────────────────────────────
    const scatter = visiblePm.map(pm => ({
      sku:         pm.sku,
      category:    pm.category,
      abcClass:    pm.abcClass,
      xyzClass:    pm.xyzClass,
      patternType: classificationBySku[pm.sku].patternType,
      totalVolume: Math.round(annualNational[pm.sku] || 0),
      cov:         parseFloat((pm.cov || 0).toFixed(3)),
    }));

    // ── table (filtered) ─────────────────────────────────────────────────
    const { where, params } = buildDemandWhere(req.query);
    const tableRows = db.prepare(`
      SELECT dwd.sku, dwd.location_id,
             l.name AS locationName, l.region,
             pm.category, pm.abc_class AS abcClass, pm.xyz_class AS xyzClass, pm.cov,
             SUM(dwd.actual_sales)   AS annualVolume,
             AVG(dwd.actual_sales)   AS weeklyAvg,
             SQRT(MAX(0,
               AVG(dwd.actual_sales * dwd.actual_sales)
               - AVG(dwd.actual_sales) * AVG(dwd.actual_sales)
             ))                      AS weeklyStddev
      FROM demand_weekly_data dwd
      JOIN locations l     ON dwd.location_id = l.location_id
      JOIN product_master pm ON dwd.sku = pm.sku
      WHERE ${where}
      GROUP BY dwd.sku, dwd.location_id
      ORDER BY pm.category, dwd.sku, l.region, l.name
    `).all(...params);

    const table = tableRows.map(r => ({
      sku:          r.sku,
      locationId:   r.location_id,
      locationName: r.locationName,
      region:       r.region,
      category:     r.category,
      abcClass:     r.abcClass,
      xyzClass:     r.xyzClass,
      patternType:  (classificationBySku[r.sku] || {}).patternType || 'Intermittent',
      cov:          parseFloat((r.cov || 0).toFixed(3)),
      annualVolume: Math.round(r.annualVolume),
      weeklyAvg:    parseFloat((r.weeklyAvg  || 0).toFixed(1)),
      weeklyStddev: parseFloat((r.weeklyStddev || 0).toFixed(1)),
    }));

    db.close();
    res.json({ classificationDistribution, scatter, table });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/demand-planning/patterns/recalculate-classification ─────────
// Re-runs ABC/XYZ computation from forecast_runs 2025 monthly history
// and writes updated columns to product_master. Matches spec Section 7's
// "manual Recalculate button" requirement.

router.post('/patterns/recalculate-classification', (req, res) => {
  try {
    const db    = getDb();
    const stats = computeAbcXyzClassification(db);
    db.close();
    res.json({
      success:         true,
      updatedAt:       new Date().toISOString(),
      classifications: stats.map(s => ({
        sku:      s.sku,
        abcClass: s.abc_class,
        xyzClass: s.xyz_class,
        cov:      parseFloat(s.cov.toFixed(3)),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/demand-planning/exceptions ───────────────────────────────────
// Returns demand_exceptions rows with summary counts.
// Query params (all optional): severity, category, locationId, sku, acknowledged

router.get('/exceptions', (req, res) => {
  try {
    const db = getDb();

    const conds  = [];
    const params = [];

    if (req.query.severity)   { conds.push('de.severity = ?');    params.push(req.query.severity); }
    if (req.query.category)   { conds.push('de.category = ?');    params.push(req.query.category); }
    if (req.query.locationId) { conds.push('de.location_id = ?'); params.push(parseInt(req.query.locationId)); }
    if (req.query.sku)        { conds.push('de.sku = ?');          params.push(req.query.sku); }
    if (req.query.skuFamily && SKU_FAMILIES[req.query.skuFamily]) {
      const skus = SKU_FAMILIES[req.query.skuFamily];
      conds.push(`de.sku IN (${skus.map(() => '?').join(',')})`);
      params.push(...skus);
    }
    if (req.query.acknowledged !== undefined) {
      conds.push('de.acknowledged = ?');
      params.push(parseInt(req.query.acknowledged));
    }

    // Always restrict to current/future planning periods (week >= 24)
    conds.push(`de.week_number >= ${EDITABLE_FROM_WEEK}`);
    const whereClause = 'WHERE ' + conds.join(' AND ');

    const rows = db.prepare(`
      SELECT de.exception_id    AS exceptionId,
             de.sku,
             de.location_id     AS locationId,
             l.name             AS locationName,
             de.week_number     AS weekNumber,
             de.year,
             de.category,
             de.severity,
             de.financial_impact AS financialImpact,
             de.title,
             de.detail,
             de.recommendation,
             de.acknowledged,
             de.created_at      AS createdAt
      FROM demand_exceptions de
      JOIN locations l ON de.location_id = l.location_id
      ${whereClause}
      ORDER BY
        CASE de.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        de.financial_impact DESC
    `).all(...params);

    db.close();

    const bySeverity = { high: 0, medium: 0, low: 0 };
    const byCategory = {
      accuracy_degradation: 0,
      large_override:       0,
      pattern_shift:        0,
      npi_risk:             0,
    };
    for (const r of rows) {
      if (bySeverity[r.severity]  !== undefined) bySeverity[r.severity]++;
      if (byCategory[r.category] !== undefined)  byCategory[r.category]++;
    }

    res.json({
      total:      rows.length,
      openCount:  rows.filter(r => r.acknowledged === 0).length,
      bySeverity,
      byCategory,
      exceptions: rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/demand-planning/exceptions/:id/acknowledge ─────────────────
// Acknowledge (or un-acknowledge) a demand exception.
// Body: { acknowledged: 1 | 0 }

router.patch('/exceptions/:id/acknowledge', (req, res) => {
  try {
    const id           = parseInt(req.params.id);
    const { acknowledged } = req.body;

    if (acknowledged === undefined || acknowledged === null) {
      return res.status(400).json({ error: 'acknowledged field is required (0 or 1)' });
    }

    const db     = getDb();
    const result = db.prepare(
      'UPDATE demand_exceptions SET acknowledged = ? WHERE exception_id = ?'
    ).run(acknowledged ? 1 : 0, id);
    db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: `Exception ${id} not found` });
    }
    res.json({ success: true, exceptionId: id, acknowledged: acknowledged ? 1 : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/demand-planning/whatif ─────────────────────────────────────────
// What-If scenario simulation. Applies 3 slider inputs to the base forecast
// (final_consensus) for a selected SKU-location over forward weeks (27–52).
//
// Formula per forward week w:
//   promoLift_w = finalConsensus_w × d × 1.7 × m
//   priceLift_w = finalConsensus_w × (−2.0) × p
//   scenarioVol_w = max(0, finalConsensus_w + promoLift_w + priceLift_w)
//   scenarioRev_w = scenarioVol_w × unitPrice × (1 + p)
//
// Where: d = promotionDiscount (0–0.50), p = priceChange (−0.20–0.20),
//        m = marketingMultiplier (0.5–2.0). PROMO_COEFF = 1.7 (10% off → 17% lift).
//        ELASTICITY = −2.0 (own-price, durable appliances; range −1.5 to −2.5).

router.post('/whatif', (req, res) => {
  try {
    const {
      sku,
      locationId,
      promotionDiscount   = 0,
      priceChange         = 0,
      marketingMultiplier = 1.0,
    } = req.body || {};

    if (!sku || locationId == null) {
      return res.status(400).json({ error: 'sku and locationId are required' });
    }

    const d = parseFloat(promotionDiscount);
    const p = parseFloat(priceChange);
    const m = parseFloat(marketingMultiplier);

    if (isNaN(d) || d < 0 || d > 0.50)  return res.status(400).json({ error: 'promotionDiscount must be 0–0.50' });
    if (isNaN(p) || p < -0.20 || p > 0.20) return res.status(400).json({ error: 'priceChange must be −0.20–+0.20' });
    if (isNaN(m) || m < 0.5 || m > 2.0) return res.status(400).json({ error: 'marketingMultiplier must be 0.5–2.0' });

    const PROMO_COEFF = 1.7;   // approved: 10% discount → 17% volume lift
    const ELASTICITY  = -2.0;  // own-price elasticity for durable appliances

    const db = getDb();

    const pm = db.prepare('SELECT price, category FROM product_master WHERE sku = ?').get(sku);
    if (!pm) { db.close(); return res.status(404).json({ error: `SKU ${sku} not found` }); }

    const loc = db.prepare('SELECT name FROM locations WHERE location_id = ?').get(parseInt(locationId));
    if (!loc) { db.close(); return res.status(404).json({ error: `Location ${locationId} not found` }); }

    const rows = db.prepare(`
      SELECT week_number,
             system_forecast   AS systemForecast,
             final_consensus   AS baseVolume
      FROM   demand_weekly_data
      WHERE  sku = ? AND location_id = ? AND year = ? AND week_number >= ?
      ORDER  BY week_number
    `).all(sku, parseInt(locationId), DEMAND_YEAR, EDITABLE_FROM_WEEK);

    db.close();

    if (rows.length === 0) {
      return res.status(404).json({ error: `No forecast data for ${sku} at location ${locationId}` });
    }

    const weeks = rows.map(row => {
      const base      = row.baseVolume;
      const promoLift = base * d * PROMO_COEFF * m;
      const priceLift = base * ELASTICITY * p;
      const scenVol   = Math.max(0, Math.round(base + promoLift + priceLift));
      return {
        weekNumber:     row.week_number,
        systemForecast: Math.round(row.systemForecast),  // needed for apply: new_adj = scenarioVol - systemForecast
        baseVolume:     Math.round(base),
        scenarioVolume: scenVol,
        baseRevenue:    Math.round(base * pm.price),
        scenarioRevenue: Math.round(scenVol * pm.price * (1 + p)),
      };
    });

    const sumBase    = weeks.reduce((s, w) => s + w.baseVolume,     0);
    const sumScen    = weeks.reduce((s, w) => s + w.scenarioVolume, 0);
    const sumBaseRev = weeks.reduce((s, w) => s + w.baseRevenue,    0);
    const sumScenRev = weeks.reduce((s, w) => s + w.scenarioRevenue, 0);

    res.json({
      sku,
      locationName: loc.name,
      unitPrice:    pm.price,
      inputs:       { promotionDiscount: d, priceChange: p, marketingMultiplier: m },
      summary: {
        baseVolume:     sumBase,
        scenarioVolume: sumScen,
        volumeImpact:   sumScen - sumBase,
        volumeImpactPct: sumBase > 0
          ? +((sumScen - sumBase) / sumBase * 100).toFixed(1)
          : 0,
        baseRevenue:    sumBaseRev,
        scenarioRevenue: sumScenRev,
        revenueImpact:  sumScenRev - sumBaseRev,
      },
      weeks,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/demand-planning/npi/predecessor-stats ────────────────────────────
// Returns monthly demand stats for a SKU from demand_weekly_data (2025).
// Called by NPITab when an LFL predecessor is selected: the frontend passes
// the NEW sku (LFL replacement) because the old predecessor SKU has no rows
// in demand_weekly_data — the replacement's history is the LFL baseline.

router.get('/npi/predecessor-stats', (req, res) => {
  const { sku } = req.query;
  if (!sku) return res.status(400).json({ error: 'sku query param required' });
  try {
    const db  = getDb();
    const row = db.prepare(`
      SELECT
        sku,
        SUM(actual_sales)              AS totalAnnualUnits,
        COUNT(*)                       AS weeks,
        SUM(actual_sales) * 12.0 / 52  AS avgMonthlyUnits
      FROM demand_weekly_data
      WHERE sku = ? AND year = ?
    `).get(sku, DEMAND_YEAR);
    db.close();
    if (!row || row.totalAnnualUnits == null) {
      return res.status(404).json({ error: `No demand data found for SKU: ${sku}` });
    }
    res.json({
      sku:              row.sku,
      avgMonthlyUnits:  Math.round(row.avgMonthlyUnits),
      totalAnnualUnits: Math.round(row.totalAnnualUnits),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/demand-planning/model/recalculate ────────────────────────────
// Read-only preview: computes new forecast for current scope, returns comparison.
// Does NOT write to the database.

router.post('/model/recalculate', (req, res) => {
  try {
    const { modelName, filters = {} } = req.body;
    if (!modelName || !FORECAST_MODELS.includes(modelName)) {
      return res.status(400).json({ error: `Invalid modelName. Valid: ${FORECAST_MODELS.join(', ')}` });
    }

    const db = getDb();
    const { where, params } = buildDemandWhere(filters);

    const dbRows = db.prepare(`
      SELECT dwd.sku, dwd.location_id, dwd.week_number,
             dwd.actual_sales, dwd.system_forecast,
             l.name AS location_name
      FROM demand_weekly_data dwd
      JOIN locations l ON dwd.location_id = l.location_id
      JOIN product_master pm ON dwd.sku = pm.sku
      WHERE ${where}
      ORDER BY dwd.sku, dwd.location_id, dwd.week_number
    `).all(...params);
    db.close();

    // Group by sku-location
    const skuLocMap = new Map();
    for (const r of dbRows) {
      const key = `${r.sku}|${r.location_id}`;
      if (!skuLocMap.has(key)) {
        skuLocMap.set(key, {
          sku: r.sku, locationId: r.location_id, locationName: r.location_name, weeks: [],
        });
      }
      skuLocMap.get(key).weeks.push({
        weekNumber: r.week_number, actualSales: r.actual_sales, systemForecast: r.system_forecast,
      });
    }

    const isImplemented = modelName === 'Prophet' || modelName === 'SARIMAX' || modelName === 'Auto Selected';
    const weekTotals    = {};
    const rows          = [];
    let fallbackCount   = 0;

    for (const [, entry] of skuLocMap) {
      let proposed = null;
      if (modelName === 'Prophet') {
        proposed = computeProphetForecast(entry.weeks, PROPHET_PHI);
      }
      const usedFallback = modelName === 'Prophet' && !proposed;
      if (usedFallback) fallbackCount++;

      const cells = {};
      for (const w of entry.weeks) {
        const cur      = w.systemForecast;
        const prop     = proposed ? (proposed[w.weekNumber] ?? cur) : cur;
        cells[w.weekNumber] = { current: cur, proposed: prop };

        if (!weekTotals[w.weekNumber]) weekTotals[w.weekNumber] = { current: 0, proposed: 0 };
        weekTotals[w.weekNumber].current  += cur;
        weekTotals[w.weekNumber].proposed += prop;
      }

      rows.push({
        sku: entry.sku, locationId: entry.locationId, locationName: entry.locationName,
        usedFallback, cells,
      });
    }

    const weeklySummary = Object.entries(weekTotals)
      .map(([w, t]) => {
        const wk   = parseInt(w);
        const cur  = Math.round(t.current);
        const prop = Math.round(t.proposed);
        return {
          week:    wk,
          current: cur,
          proposed: prop,
          diff:    prop - cur,
          diffPct: cur > 0 ? parseFloat(((prop - cur) / cur * 100).toFixed(1)) : 0,
        };
      })
      .sort((a, b) => a.week - b.week);

    const futureWeeks = weeklySummary.filter(w => w.week >= EDITABLE_FROM_WEEK);
    const futCur  = futureWeeks.reduce((s, w) => s + w.current,  0);
    const futProp = futureWeeks.reduce((s, w) => s + w.proposed, 0);

    res.json({
      modelName,
      isImplemented,
      fallbackCount,
      summary: {
        totalCurrentFuture:  futCur,
        totalProposedFuture: futProp,
        diffUnits: futProp - futCur,
        diffPct:   futCur > 0 ? parseFloat(((futProp - futCur) / futCur * 100).toFixed(1)) : 0,
      },
      weeklySummary,
      rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/demand-planning/model/finalize ────────────────────────────────
// Deliberate commit: overwrites system_forecast + recomputes final_consensus.

router.post('/model/finalize', (req, res) => {
  try {
    const { modelName, filters = {} } = req.body;
    if (!modelName || !FORECAST_MODELS.includes(modelName)) {
      return res.status(400).json({ error: 'Invalid modelName' });
    }

    const db = getDb();
    const { where, params } = buildDemandWhere(filters);

    const dbRows = db.prepare(`
      SELECT dwd.sku, dwd.location_id, dwd.week_number,
             dwd.actual_sales, dwd.system_forecast
      FROM demand_weekly_data dwd
      JOIN product_master pm ON dwd.sku = pm.sku
      WHERE ${where}
      ORDER BY dwd.sku, dwd.location_id, dwd.week_number
    `).all(...params);

    // Group by sku-location
    const skuLocMap = new Map();
    for (const r of dbRows) {
      const key = `${r.sku}|${r.location_id}`;
      if (!skuLocMap.has(key)) {
        skuLocMap.set(key, { sku: r.sku, locationId: r.location_id, weeks: [] });
      }
      skuLocMap.get(key).weeks.push({
        weekNumber: r.week_number, actualSales: r.actual_sales, systemForecast: r.system_forecast,
      });
    }

    const stmt = db.prepare(`
      UPDATE demand_weekly_data
      SET system_forecast = ?,
          final_consensus = ? + planner_adjustment + branch_adjustment + category_adjustment
      WHERE sku = ? AND location_id = ? AND week_number = ? AND year = ?
    `);

    let updatedRows = 0;
    const finalizeAll = db.transaction(() => {
      for (const [, entry] of skuLocMap) {
        let proposed = null;
        if (modelName === 'Prophet') {
          proposed = computeProphetForecast(entry.weeks, PROPHET_PHI);
        }
        for (const w of entry.weeks) {
          const newSysFcst = proposed ? (proposed[w.weekNumber] ?? w.systemForecast) : w.systemForecast;
          stmt.run(newSysFcst, newSysFcst, entry.sku, entry.locationId, w.weekNumber, DEMAND_YEAR);
          updatedRows++;
        }
      }
    });

    finalizeAll();
    db.close();

    res.json({ success: true, modelName, updatedRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
