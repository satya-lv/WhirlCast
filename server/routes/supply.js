'use strict';
/**
 * supply.js — Supply Planning Workbench API
 *
 * Endpoints:
 *   GET  /api/supply/filters                  — filter options for frontend
 *   GET  /api/supply/grid                     — 52-week planning grid (paginated + filtered)
 *   GET  /api/supply/kpis                     — 8 KPI cards (§3.2)
 *   GET  /api/supply/constraints              — capacity / material / demand-impact views (§3.6)
 *   GET  /api/supply/pegging                  — end-to-end dependency chain (§3.7)
 *   POST /api/supply/actions                  — apply planning action (§3.4)
 *   GET  /api/supply/recommendations          — ranked recommendations with before/after (§3.5/3.9)
 *   GET  /api/supply/scenarios                — list scenarios with KPI summaries
 *   POST /api/supply/scenarios                — create scenario (clone baseline)
 *   GET  /api/supply/scenarios/compare        — side-by-side KPI comparison
 */
const express = require('express');
const router  = express.Router();
const { getDb } = require('../db/schema');

// ── Shared helpers ─────────────────────────────────────────────────────────

function getBaseline(db) {
  return db.prepare(
    `SELECT scenario_id FROM scenario_supply_plans WHERE action_type='BASELINE' LIMIT 1`
  ).get()?.scenario_id ?? 1;
}

// Parse and validate week range query params (defaults to current 13-week planning horizon)
function weekRange(query) {
  const start = Math.max(1,  Math.min(52, parseInt(query.weekStart) || 22));
  const raw   = parseInt(query.weekEnd) || start + 12;
  const end   = Math.max(start, Math.min(52, raw));
  return { start, end };
}

// Map product_master.category patterns to filter-friendly short names
const FAMILY_PATTERNS = {
  'Refrigerator': ['REF_190L_DirectCool','REF_240L_FrostFree','REF_340L_TripleDoor'],
  'Washing Machine': ['WM_7KG_TopLoad','WM_8KG_FrontLoad','WM_6.5KG_SemiAuto'],
  'Air Conditioner': ['AC_1.5T_Inverter','AC_2.0T_Split'],
  'Microwave': ['MW_25L_Convection'],
  'Induction': ['IH_3B_SmartGlass'],
};

// Build a WHERE clause + params array from common grid filters
function buildGridWhere(db, query, scenarioId, start, end) {
  const conds  = ['po.scenario_id=?', 'po.year=?', 'po.week_number BETWEEN ? AND ?'];
  const params = [scenarioId, 2026, start, end];

  if (query.region) {
    conds.push('l.region=?'); params.push(query.region);
  }
  if (query.plant) {
    conds.push('po.plant_id=?'); params.push(parseInt(query.plant));
  }
  if (query.sku) {
    conds.push('po.sku=?'); params.push(query.sku);
  }
  if (query.locationId) {
    conds.push('po.location_id=?'); params.push(parseInt(query.locationId));
  }
  if (query.skuFamily && FAMILY_PATTERNS[query.skuFamily]) {
    const skus = FAMILY_PATTERNS[query.skuFamily];
    conds.push(`po.sku IN (${skus.map(()=>'?').join(',')})`);
    params.push(...skus);
  }
  return { where: conds.join(' AND '), params };
}

// ── GET /api/supply/actions-meta ──────────────────────────────────────────
// Returns reference data needed to populate the planning actions panel:
// production lines (grouped by plant), components, and suppliers.

router.get('/actions-meta', (req, res) => {
  try {
    const db         = getDb();
    const lines      = db.prepare('SELECT line_id, plant_id, name, line_category FROM production_lines ORDER BY plant_id, name').all();
    const components = db.prepare('SELECT component_id, code, name, supplier_id FROM components ORDER BY name').all();
    const suppliers  = db.prepare('SELECT supplier_id, name FROM suppliers ORDER BY name').all();
    db.close();
    res.json({ lines, components, suppliers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/filters ────────────────────────────────────────────────
// Returns drop-down options for the workbench filter bar.

router.get('/filters', (req, res) => {
  try {
    const db = getDb();
    const regions   = db.prepare('SELECT DISTINCT region FROM locations ORDER BY region').all().map(r=>r.region);
    const plants    = db.prepare('SELECT plant_id, name, city, region FROM plants ORDER BY name').all();
    const locations = db.prepare('SELECT location_id, name, region FROM locations ORDER BY region, name').all();
    const skus      = db.prepare('SELECT sku, category FROM product_master WHERE active=1 ORDER BY category, sku').all();
    const scenarios = db.prepare('SELECT scenario_id, name, action_type, status FROM scenario_supply_plans ORDER BY scenario_id').all();
    db.close();
    res.json({
      regions,
      plants,
      locations,
      skuFamilies: Object.keys(FAMILY_PATTERNS),
      skus,
      scenarios,
      weekRange: { min: 1, max: 52, defaultStart: 22, defaultEnd: 34 },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/grid ───────────────────────────────────────────────────
// Returns the time-phased planning grid, filtered and paginated.
// Rows = distinct (sku × location × plant × line) combinations.
// Cells = every measure for each week in [weekStart, weekEnd].
//
// Query params:
//   scenarioId, weekStart (def 22), weekEnd (def 34),
//   region, plant, sku, skuFamily, locationId,
//   page (def 1), pageSize (def 20, max 50)

router.get('/grid', (req, res) => {
  try {
    const db         = getDb();
    const scenarioId = parseInt(req.query.scenarioId) || getBaseline(db);
    const { start, end } = weekRange(req.query);
    const page       = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize   = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
    const { where, params } = buildGridWhere(db, req.query, scenarioId, start, end);

    // Count distinct sku-location combos (for pagination)
    const countSql = `
      SELECT COUNT(DISTINCT po.sku||'|'||po.location_id) AS n
      FROM planning_orders po
      JOIN locations l ON po.location_id=l.location_id
      JOIN product_master pm ON po.sku=pm.sku
      WHERE ${where}`;
    const { n: total } = db.prepare(countSql).get(...params);

    // Fetch all matching cells for the filtered sku-location set in the week range
    const sql = `
      SELECT po.order_id, po.sku, po.location_id, po.plant_id, po.production_line_id,
        po.week_number, po.year, po.scenario_id,
        COALESCE(dwd.final_consensus, po.forecast_demand) AS forecast_demand,
        po.customer_orders, po.priority_demand,
        po.beginning_inventory, po.planned_production, po.firm_production_orders,
        po.purchase_orders, po.transfer_orders, po.ending_inventory,
        po.capacity_available, po.capacity_required, po.material_availability,
        po.shortage_qty, po.supply_gap,
        l.name AS location_name, l.region,
        p.name AS plant_name,
        pl.line_category, pl.name AS line_name,
        pm.category AS sku_family,
        COALESCE(spp.safety_stock_weeks, 1.5) AS safety_stock_weeks
      FROM planning_orders po
      JOIN locations l  ON po.location_id=l.location_id
      JOIN plants p     ON po.plant_id=p.plant_id
      JOIN production_lines pl ON po.production_line_id=pl.line_id
      JOIN product_master pm ON po.sku=pm.sku
      LEFT JOIN sku_planning_params spp ON po.sku=spp.sku
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      WHERE ${where}
      ORDER BY pm.category, po.sku, l.region, l.name, po.week_number`;

    const raw = db.prepare(sql).all(...params);

    // Group into rows (sku-location), cells keyed by week_number
    const rowMap = new Map();
    for (const cell of raw) {
      const key = `${cell.sku}|${cell.location_id}`;
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          sku: cell.sku, skuFamily: cell.sku_family,
          locationId: cell.location_id, locationName: cell.location_name,
          region: cell.region, plantId: cell.plant_id, plantName: cell.plant_name,
          lineCategory: cell.line_category, lineName: cell.line_name,
          productionLineId: cell.production_line_id,
          safetyStockWeeks: cell.safety_stock_weeks,
          cells: {},
        });
      }
      const r = rowMap.get(key);
      r.cells[cell.week_number] = {
        orderId: cell.order_id,
        forecastDemand:       cell.forecast_demand,
        customerOrders:       cell.customer_orders,
        priorityDemand:       cell.priority_demand,
        beginningInventory:   cell.beginning_inventory,
        plannedProduction:    cell.planned_production,
        firmProductionOrders: cell.firm_production_orders,
        purchaseOrders:       cell.purchase_orders,
        transferOrders:       cell.transfer_orders,
        endingInventory:      cell.ending_inventory,
        capacityAvailable:    cell.capacity_available,
        capacityRequired:     cell.capacity_required,
        materialAvailability: cell.material_availability,
        shortageQty:          cell.shortage_qty,
        supplyGap:            cell.supply_gap,
      };
    }

    // Paginate on rows (not on cells)
    const allRows = [...rowMap.values()];
    const pageRows = allRows.slice((page-1)*pageSize, page*pageSize);

    db.close();
    res.json({
      weeks:      Array.from({length: end - start + 1}, (_, i) => start + i),
      rows:       pageRows,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
      weekRange:  { start, end },
      scenarioId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/kpis ───────────────────────────────────────────────────
// 8 KPI cards per spec §3.2 — all computed from live PlanningOrder data.
//
// Query params: scenarioId, weekStart, weekEnd, region, plant, sku, skuFamily

router.get('/kpis', (req, res) => {
  try {
    const db         = getDb();
    const scenarioId = parseInt(req.query.scenarioId) || getBaseline(db);
    const { start, end } = weekRange(req.query);
    const { where, params } = buildGridWhere(db, req.query, scenarioId, start, end);

    const agg = db.prepare(`
      SELECT
        SUM(COALESCE(dwd.final_consensus, po.forecast_demand))   AS totalDemand,
        SUM(po.planned_production)                               AS feasibleSupply,
        SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.planned_production))
                                                                 AS unconstrainedVsConstrainedGap,
        SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production))
                                                                 AS totalShortage,
        SUM(po.ending_inventory)                                 AS totalEndingInventory,
        SUM(po.capacity_required)                                AS totalCapRequired,
        SUM(po.capacity_available)                               AS totalCapAvailable,
        AVG(po.material_availability)                            AS avgMaterialCoverage,
        MIN(po.material_availability)                            AS minMaterialCoverage,
        COUNT(*)                                                 AS rowCount
      FROM planning_orders po
      JOIN locations l  ON po.location_id=l.location_id
      JOIN product_master pm ON po.sku=pm.sku
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      WHERE ${where}`).get(...params);

    const revRisk = db.prepare(`
      SELECT SUM(
        MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)
        * pm.price
      ) AS revenueAtRisk
      FROM planning_orders po
      JOIN product_master pm ON po.sku=pm.sku
      JOIN locations l ON po.location_id=l.location_id
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      WHERE ${where}
        AND (COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) > 0`).get(...params);

    // Total manufacturing hours available = distinct (line × week) combos × that line's hrs/week.
    // capacity_available in planning_orders is in units (line_hrs/hpu), so we can't sum it directly.
    const lineHrData = db.prepare(`
      SELECT ROUND(SUM(pl.hours_per_shift * pl.shifts_per_day * pl.working_days_per_week), 0) AS total_line_hrs
      FROM (
        SELECT DISTINCT po.production_line_id, po.week_number
        FROM planning_orders po
        JOIN locations l ON po.location_id=l.location_id
        JOIN product_master pm ON po.sku=pm.sku
        WHERE ${where}
      ) dw
      JOIN production_lines pl ON pl.line_id=dw.production_line_id`
    ).get(...params);

    const weeks = end - start + 1;
    const serviceLevel = agg.totalDemand > 0
      ? ((1 - agg.totalShortage / agg.totalDemand) * 100)
      : 100;
    const inventoryDays = agg.totalDemand > 0
      ? (agg.totalEndingInventory / agg.totalDemand) * 7 * weeks
      : 0;
    const totalLineHrs = lineHrData?.total_line_hrs || 0;
    const capUtilPct = totalLineHrs > 0
      ? (agg.totalCapRequired / totalLineHrs) * 100
      : 0;

    db.close();
    res.json({
      scenarioId, weekRange: { start, end },
      kpis: {
        totalDemand:              { value: Math.round(agg.totalDemand),            unit: 'units',   label: 'Total Demand' },
        feasibleSupply:           { value: Math.round(agg.feasibleSupply),          unit: 'units',   label: 'Feasible Supply' },
        unconstrainedVsConstrained:{ value: Math.round(agg.unconstrainedVsConstrainedGap), unit: 'units', label: 'Unconstrained vs Constrained Gap' },
        serviceLevel:             { value: parseFloat(serviceLevel.toFixed(1)),    unit: '%',       label: 'Service Level %' },
        revenueAtRisk:            { value: Math.round(revRisk?.revenueAtRisk || 0), unit: 'INR',     label: 'Revenue at Risk' },
        inventoryDays:            { value: parseFloat(inventoryDays.toFixed(1)),   unit: 'days',    label: 'Inventory Days' },
        capacityUtilization:      { value: parseFloat(capUtilPct.toFixed(1)),      unit: '%',       label: 'Capacity Utilization %' },
        materialCoverageDays:     { value: parseFloat((agg.avgMaterialCoverage||0).toFixed(1)), unit: 'days', label: 'Material Coverage Days' },
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/constraints ────────────────────────────────────────────
// Three sub-views: capacity | material | demand_impact   (§3.6)
//
// Query params: view (req), scenarioId, weekStart, weekEnd, region, plant

router.get('/constraints', (req, res) => {
  try {
    const db         = getDb();
    const view       = req.query.view || 'capacity';
    const scenarioId = parseInt(req.query.scenarioId) || getBaseline(db);
    const { start, end } = weekRange(req.query);

    // Build optional persona-scope filters (same pattern as buildGridWhere)
    const xConds  = [];
    const xParams = [];
    if (req.query.locationId) {
      xConds.push('po.location_id = ?');
      xParams.push(parseInt(req.query.locationId));
    }
    if (req.query.skuFamily && FAMILY_PATTERNS[req.query.skuFamily]) {
      const skus = FAMILY_PATTERNS[req.query.skuFamily];
      xConds.push(`po.sku IN (${skus.map(() => '?').join(',')})`);
      xParams.push(...skus);
    }
    const xWhere = xConds.length ? 'AND ' + xConds.join(' AND ') : '';

    if (view === 'capacity') {
      // Aggregate capacity at the plant+line level across the week window
      const rows = db.prepare(`
        SELECT p.plant_id, p.name AS plant_name, p.region,
          pl.line_id, pl.name AS line_name, pl.line_category,
          pl.hours_per_shift, pl.shifts_per_day, pl.working_days_per_week,
          (pl.hours_per_shift * pl.shifts_per_day * pl.working_days_per_week) AS hours_per_week,
          ROUND(SUM(po.capacity_required), 1) AS total_hrs_required,
          ROUND(SUM(po.capacity_required)
              * 100.0 / NULLIF((pl.hours_per_shift * pl.shifts_per_day * pl.working_days_per_week * (? - ? + 1)), 0),
              1) AS utilization_pct,
          ROUND(MAX(0,
            SUM(po.capacity_required)
            - (pl.hours_per_shift * pl.shifts_per_day * pl.working_days_per_week * (? - ? + 1))
          ), 1) AS overload_hrs,
          ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)), 1) AS total_shortage,
          ROUND(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)), 1) AS total_demand,
          COUNT(DISTINCT po.week_number) AS weeks_with_data
        FROM planning_orders po
        JOIN plants p  ON po.plant_id = p.plant_id
        JOIN production_lines pl ON po.production_line_id = pl.line_id
        LEFT JOIN demand_weekly_data dwd
               ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
        WHERE po.scenario_id=? AND po.year=2026
          AND po.week_number BETWEEN ? AND ?
          ${xWhere}
        GROUP BY po.plant_id, po.production_line_id
        ORDER BY utilization_pct DESC`
      ).all(end, start, end, start, scenarioId, start, end, ...xParams);

      db.close();
      return res.json({ view: 'capacity', weekRange: { start, end }, rows });
    }

    if (view === 'material') {
      // Per-component supply/demand in the window
      const rows = db.prepare(`
        SELECT c.component_id, c.code, c.name AS component_name, c.category,
          c.on_hand_qty, c.reorder_point,
          s.name AS supplier_name, s.otif_pct, s.lead_time_days,
          ROUND(SUM(po.planned_production * bl.qty_per), 1)  AS total_required,
          ROUND(
            c.on_hand_qty * 7.0
            / NULLIF(SUM(po.planned_production * bl.qty_per) / (? - ? + 1), 0),
            1
          ) AS coverage_days,
          (SELECT SUM(poo.qty)
           FROM purchase_orders poo
           WHERE poo.component_id = c.component_id
             AND poo.week_due BETWEEN ? AND ?
             AND poo.status = 'open') AS open_po_qty,
          ROUND(AVG(po.material_availability), 1) AS avg_sku_coverage,
          MIN(po.material_availability) AS min_sku_coverage
        FROM components c
        JOIN bom_lines bl ON bl.component_id = c.component_id
        JOIN planning_orders po ON po.sku = bl.sku
        JOIN suppliers s ON s.supplier_id = c.supplier_id
        WHERE po.scenario_id=? AND po.year=2026
          AND po.week_number BETWEEN ? AND ?
          ${xWhere}
        GROUP BY c.component_id
        ORDER BY coverage_days ASC`
      ).all(end, start, start, end, scenarioId, start, end, ...xParams);

      db.close();
      return res.json({ view: 'material', weekRange: { start, end }, rows });
    }

    if (view === 'demand_impact') {
      // Revenue at risk and customer-tier impact from shortages
      const rows = db.prepare(`
        SELECT po.sku, pm.category AS sku_family, pm.price,
          l.name AS location_name, l.region,
          po.week_number,
          ROUND(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production), 1) AS shortage_qty,
          ROUND(COALESCE(dwd.final_consensus, po.forecast_demand), 1) AS forecast_demand,
          ROUND(COALESCE(dwd.final_consensus, po.forecast_demand) * 0.62, 1) AS priority_demand,
          ROUND(COALESCE(dwd.final_consensus, po.forecast_demand) * 0.82, 1) AS customer_orders,
          ROUND(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) * pm.price, 0) AS revenue_at_risk,
          -- Estimated tier impact: Tier 3 absorbs shortage first, then Tier 2, then Tier 1
          ROUND(MIN(
            MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production),
            MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) * 0.82 - COALESCE(dwd.final_consensus, po.forecast_demand) * 0.62)
          ), 1) AS tier3_impact_units,
          ROUND(MAX(0,
            MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)
            - MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) * 0.82 - COALESCE(dwd.final_consensus, po.forecast_demand) * 0.62)
          ), 1) AS tier12_impact_units
        FROM planning_orders po
        JOIN product_master pm ON po.sku = pm.sku
        JOIN locations l ON po.location_id = l.location_id
        LEFT JOIN demand_weekly_data dwd
               ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
        WHERE po.scenario_id=? AND po.year=2026
          AND po.week_number BETWEEN ? AND ?
          ${xWhere}
          AND (COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) > 0
        ORDER BY revenue_at_risk DESC
        LIMIT 50`
      ).all(scenarioId, start, end, ...xParams);

      // Aggregate summary
      const summary = db.prepare(`
        SELECT
          COUNT(*) AS impacted_rows,
          SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) * pm.price) AS total_revenue_at_risk,
          SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)) AS total_shortage_units,
          COUNT(DISTINCT po.sku) AS impacted_skus,
          COUNT(DISTINCT po.location_id) AS impacted_locations
        FROM planning_orders po
        JOIN product_master pm ON po.sku = pm.sku
        LEFT JOIN demand_weekly_data dwd
               ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
        WHERE po.scenario_id=? AND po.year=2026
          AND po.week_number BETWEEN ? AND ?
          ${xWhere}
          AND (COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) > 0`
      ).get(scenarioId, start, end, ...xParams);

      db.close();
      return res.json({ view: 'demand_impact', weekRange: { start, end }, summary, rows });
    }

    db.close();
    res.status(400).json({ error: 'view must be capacity | material | demand_impact' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/pegging ────────────────────────────────────────────────
// End-to-end dependency chain for a specific cell. (§3.7)
// Customer Demand → Finished Goods → Production Order → Component Requirement → Supplier
//
// Query params: sku (req), locationId (req), weekNumber (req), scenarioId

router.get('/pegging', (req, res) => {
  try {
    const db         = getDb();
    const { sku, locationId, weekNumber, scenarioId: rawScenId } = req.query;
    if (!sku || !locationId || !weekNumber)
      return res.status(400).json({ error: 'sku, locationId, and weekNumber are required' });

    const scenarioId = parseInt(rawScenId) || getBaseline(db);
    const week       = parseInt(weekNumber);
    const locId      = parseInt(locationId);

    // 1. Planning order (the cell)
    const po = db.prepare(`
      SELECT po.*, l.name AS location_name, p.name AS plant_name, pl.name AS line_name
      FROM planning_orders po
      JOIN locations l ON po.location_id=l.location_id
      JOIN plants p ON po.plant_id=p.plant_id
      JOIN production_lines pl ON po.production_line_id=pl.line_id
      WHERE po.sku=? AND po.location_id=? AND po.week_number=? AND po.scenario_id=? AND po.year=2026
      LIMIT 1`).get(sku, locId, week, scenarioId);

    if (!po) {
      db.close();
      return res.status(404).json({ error: 'Planning order not found for the given cell' });
    }

    // 2. Firm production orders for this SKU/plant/week
    const fpos = db.prepare(`
      SELECT fpo.*, p.name AS plant_name, pl.name AS line_name
      FROM firm_production_orders fpo
      JOIN plants p ON fpo.plant_id=p.plant_id
      JOIN production_lines pl ON fpo.production_line_id=pl.line_id
      WHERE fpo.sku=? AND fpo.plant_id=? AND fpo.week_number=? AND fpo.year=2026`
    ).all(sku, po.plant_id, week);

    // 3. BOM requirements and component availability
    const bomReqs = db.prepare(`
      SELECT bl.qty_per,
        c.component_id, c.code, c.name AS component_name, c.category, c.on_hand_qty,
        ROUND(? * bl.qty_per, 1) AS qty_required,
        ROUND(c.on_hand_qty - (? * bl.qty_per), 1) AS qty_after_draw,
        s.name AS supplier_name, s.supplier_id, s.otif_pct, s.lead_time_days
      FROM bom_lines bl
      JOIN components c ON bl.component_id=c.component_id
      JOIN suppliers s ON c.supplier_id=s.supplier_id
      WHERE bl.sku=?
      ORDER BY c.category`
    ).all(po.planned_production, po.planned_production, sku);

    // 4. Open POs for each component (due in this week ±4 weeks)
    const compIds = bomReqs.map(b => b.component_id);
    const openPos = compIds.length ? db.prepare(`
      SELECT po.*, c.name AS component_name, s.name AS supplier_name
      FROM purchase_orders po
      JOIN components c ON po.component_id=c.component_id
      JOIN suppliers s ON po.supplier_id=s.supplier_id
      WHERE po.component_id IN (${compIds.map(()=>'?').join(',')})
        AND po.week_due BETWEEN ? AND ? AND po.status='open'
      ORDER BY po.week_due`
    ).all(...compIds, Math.max(1, week-2), Math.min(52, week+4)) : [];

    // 5. Transfer orders for this SKU/location/week
    const tos = db.prepare(`
      SELECT tor.*, lf.name AS from_location, lt.name AS to_location
      FROM transfer_orders tor
      JOIN locations lf ON tor.from_location_id=lf.location_id
      JOIN locations lt ON tor.to_location_id=lt.location_id
      WHERE tor.sku=? AND (tor.from_location_id=? OR tor.to_location_id=?)
        AND tor.week_number=? AND tor.year=2026`
    ).all(sku, locId, locId, week);

    // 6. Customer demand context (tier breakdown from customers)
    const customers = db.prepare(
      `SELECT name, priority_tier, channel FROM customers ORDER BY priority_tier LIMIT 7`
    ).all();
    const tier1Count = customers.filter(c=>c.priority_tier===1).length;
    const tier2Count = customers.filter(c=>c.priority_tier===2).length;

    db.close();

    res.json({
      cell: { sku, locationId: locId, locationName: po.location_name, weekNumber: week, scenarioId },
      chain: {
        customerDemand: {
          totalDemand:    po.forecast_demand,
          customerOrders: po.customer_orders,
          priorityDemand: po.priority_demand,
          tier1Customers: tier1Count,
          tier2Customers: tier2Count,
          shortageImpact: po.shortage_qty,
        },
        planningOrder: {
          orderId:            po.order_id,
          plant:              po.plant_name,
          line:               po.line_name,
          beginningInventory: po.beginning_inventory,
          plannedProduction:  po.planned_production,
          endingInventory:    po.ending_inventory,
          shortageQty:        po.shortage_qty,
          supplyGap:          po.supply_gap,
          capacityRequired:   po.capacity_required,
          capacityAvailable:  po.capacity_available,
        },
        firmProductionOrders: fpos.map(f => ({
          fpoId: f.fpo_id, plant: f.plant_name, line: f.line_name,
          qty: f.qty, status: f.status, notes: f.notes,
        })),
        componentRequirements: bomReqs.map(b => ({
          code:          b.code,
          name:          b.component_name,
          category:      b.category,
          qtyPer:        b.qty_per,
          qtyRequired:   b.qty_required,
          onHandQty:     b.on_hand_qty,
          qtyAfterDraw:  b.qty_after_draw,
          coverageOk:    b.qty_after_draw >= 0,
          supplier:      b.supplier_name,
          otifPct:       b.otif_pct,
          leadTimeDays:  b.lead_time_days,
        })),
        supplierPurchaseOrders: openPos.map(p => ({
          poId:      p.po_id,
          component: p.component_name,
          supplier:  p.supplier_name,
          qty:       p.qty,
          weekDue:   p.week_due,
          status:    p.status,
        })),
        transferOrders: tos.map(t => ({
          toId:         t.to_id,
          from:         t.from_location,
          to:           t.to_location,
          qty:          t.qty,
          reason:       t.reason,
          status:       t.status,
        })),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/supply/actions ───────────────────────────────────────────────
// Apply a planning action. Writes back to planning_orders / firm_production_orders.
//
// Body: { actionType, sku, locationId, weekNumber, scenarioId, params }
//
// actionType values and required params:
//   increase_production  — { deltaQty }
//   decrease_production  — { deltaQty }
//   pull_ahead           — { fromWeek, toWeek, qty } (move production earlier)
//   push_out             — { fromWeek, toWeek, qty } (defer production)
//   add_overtime         — { plantId, lineId, extraHoursPerWeek } (week-level)
//   expedite_supplier    — { componentId, supplierId, qty, newWeekDue }
//   change_plant         — { newPlantId }

router.post('/actions', (req, res) => {
  try {
    const db = getDb();
    const { actionType, sku, locationId, weekNumber, scenarioId: rawSc, params = {} } = req.body;
    if (!actionType) return res.status(400).json({ error: 'actionType is required' });

    const scenarioId = parseInt(rawSc) || getBaseline(db);
    const week       = parseInt(weekNumber);
    const locId      = parseInt(locationId);

    // Helper: fetch a planning order row
    const fetchRow = (s, l, w) => db.prepare(`
      SELECT * FROM planning_orders
      WHERE sku=? AND location_id=? AND week_number=? AND scenario_id=? AND year=2026 LIMIT 1`
    ).get(s, l, w, scenarioId);

    // Helper: recompute derived fields after production change and UPDATE the row
    const recomputeAndSave = (row, newProd) => {
      const hpu = db.prepare(`SELECT hours_per_unit FROM sku_planning_params WHERE sku=?`).get(row.sku)?.hours_per_unit ?? 0;
      newProd = Math.max(0, newProd);
      const endInv   = Math.round(Math.max(0, row.beginning_inventory + newProd - row.forecast_demand) * 10) / 10;
      const shortage = Math.round(Math.max(0, row.forecast_demand - row.beginning_inventory - newProd) * 10) / 10;
      const gap      = Math.round(Math.max(0, row.forecast_demand - newProd) * 10) / 10;
      const capReq   = Math.round(newProd * hpu * 10) / 10;
      db.prepare(`
        UPDATE planning_orders SET
          planned_production=?, ending_inventory=?, shortage_qty=?,
          supply_gap=?, capacity_required=?
        WHERE order_id=?`
      ).run(newProd, endInv, shortage, gap, capReq, row.order_id);
      return { ...row, planned_production: newProd, ending_inventory: endInv, shortage_qty: shortage, supply_gap: gap, capacity_required: capReq };
    };

    let result = {};

    const txn = db.transaction(() => {
      if (actionType === 'increase_production' || actionType === 'decrease_production') {
        const row = fetchRow(sku, locId, week);
        if (!row) throw new Error('Planning order not found');
        const delta   = parseFloat(params.deltaQty) || 0;
        const newProd = actionType === 'increase_production'
          ? row.planned_production + delta
          : row.planned_production - delta;
        result = { updatedRows: [recomputeAndSave(row, newProd)] };
      }

      else if (actionType === 'pull_ahead' || actionType === 'push_out') {
        const fromWeek = parseInt(params.fromWeek) || week;
        const toWeek   = parseInt(params.toWeek)   || week;
        const qty      = parseFloat(params.qty)    || 0;
        const srcWeek  = actionType === 'pull_ahead' ? fromWeek : toWeek;
        const dstWeek  = actionType === 'pull_ahead' ? toWeek   : fromWeek;

        const srcRow = fetchRow(sku, locId, srcWeek);
        const dstRow = fetchRow(sku, locId, dstWeek);
        if (!srcRow || !dstRow) throw new Error('Source or destination planning order not found');
        if (qty > srcRow.planned_production)
          throw new Error(`Cannot move ${qty} units — only ${srcRow.planned_production} planned in source week`);

        const srcUpdated = recomputeAndSave(srcRow, srcRow.planned_production - qty);
        const dstUpdated = recomputeAndSave(dstRow, dstRow.planned_production + qty);
        result = { updatedRows: [srcUpdated, dstUpdated], note: 'Inventory continuity for intermediate weeks not auto-updated; re-plan to propagate.' };
      }

      else if (actionType === 'add_overtime') {
        const { plantId, lineId, extraHoursPerWeek } = params;
        if (!plantId || !lineId || !extraHoursPerWeek)
          throw new Error('add_overtime requires plantId, lineId, extraHoursPerWeek');

        // Find all rows for this plant+line+week, increase capacity_available
        const affectedRows = db.prepare(`
          SELECT po.*, spp.hours_per_unit
          FROM planning_orders po
          JOIN sku_planning_params spp ON po.sku=spp.sku
          WHERE po.plant_id=? AND po.production_line_id=? AND po.week_number=? AND po.scenario_id=? AND po.year=2026`
        ).all(parseInt(plantId), parseInt(lineId), week, scenarioId);

        const updated = [];
        for (const row of affectedRows) {
          const extraUnits   = Math.round(extraHoursPerWeek / row.hours_per_unit * 10) / 10;
          const newCapAvail  = row.capacity_available + extraUnits;
          const newProd      = Math.min(newCapAvail, row.planned_production + extraUnits);
          db.prepare(`UPDATE planning_orders SET capacity_available=? WHERE order_id=?`).run(newCapAvail, row.order_id);
          updated.push(recomputeAndSave(row, newProd));
        }
        result = { updatedRows: updated, extraHoursPerWeek };
      }

      else if (actionType === 'expedite_supplier') {
        const { componentId, supplierId, qty, newWeekDue } = params;
        if (!componentId || !supplierId || !qty || !newWeekDue)
          throw new Error('expedite_supplier requires componentId, supplierId, qty, newWeekDue');

        const comp = db.prepare(`SELECT * FROM components WHERE component_id=?`).get(parseInt(componentId));
        if (!comp) throw new Error('Component not found');

        const poId = db.prepare(`
          INSERT INTO purchase_orders (component_id,supplier_id,qty,unit_cost,ordered_date,due_date,week_due,year_due,status)
          VALUES (?,?,?,?,date('now'),date('now'),?,2026,'open')`
        ).run(parseInt(componentId), parseInt(supplierId), parseInt(qty), comp.unit_cost, parseInt(newWeekDue)).lastInsertRowid;

        // Update material_availability for affected planning_orders (any row using this component,
        // in the weeks after the PO due date, where material was previously tight)
        const bomRows = db.prepare(`SELECT sku FROM bom_lines WHERE component_id=?`).all(parseInt(componentId));
        const affectedSkus = bomRows.map(b => b.sku);
        if (affectedSkus.length && newWeekDue <= 52) {
          // Simple heuristic: add 7 days of coverage for each affected row in weeks >= newWeekDue
          db.prepare(`
            UPDATE planning_orders
            SET material_availability = MIN(999, material_availability + 14)
            WHERE sku IN (${affectedSkus.map(()=>'?').join(',')})
              AND week_number >= ? AND scenario_id=? AND year=2026`
          ).run(...affectedSkus, parseInt(newWeekDue), scenarioId);
        }
        result = { poId, componentId, supplierId, qty, newWeekDue, affectedSkus };
      }

      else if (actionType === 'change_plant') {
        const row = fetchRow(sku, locId, week);
        if (!row) throw new Error('Planning order not found');
        const { newPlantId } = params;
        if (!newPlantId) throw new Error('change_plant requires newPlantId');

        const lineCategory = db.prepare(`SELECT line_category FROM sku_planning_params WHERE sku=?`).get(sku)?.line_category;
        const newLine = db.prepare(`SELECT line_id, hours_per_shift, shifts_per_day, working_days_per_week FROM production_lines WHERE plant_id=? AND line_category=? LIMIT 1`).get(parseInt(newPlantId), lineCategory);
        if (!newLine) throw new Error('New plant does not have a compatible production line for this SKU');

        const newCapAvail = (newLine.hours_per_shift * newLine.shifts_per_day * newLine.working_days_per_week) /
          (db.prepare(`SELECT hours_per_unit FROM sku_planning_params WHERE sku=?`).get(sku)?.hours_per_unit ?? 1);

        db.prepare(`
          UPDATE planning_orders SET plant_id=?, production_line_id=?, capacity_available=?
          WHERE order_id=?`
        ).run(parseInt(newPlantId), newLine.line_id, newCapAvail, row.order_id);

        result = { updatedRows: [{ ...row, plant_id: parseInt(newPlantId), production_line_id: newLine.line_id, capacity_available: newCapAvail }] };
      }

      else {
        throw new Error(`Unknown actionType: ${actionType}`);
      }
    });

    txn();
    db.close();
    res.json({ success: true, actionType, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/supply/recommendations ───────────────────────────────────────
// Ranked recommendations with computed before/after impact. (§3.5/3.9)
// Numbers are derived from actual PlanningOrder/BOM/capacity state.
//
// Query params: scenarioId, weekStart, weekEnd

router.get('/recommendations', (req, res) => {
  try {
    const db         = getDb();
    const scenarioId = parseInt(req.query.scenarioId) || getBaseline(db);
    const { start, end } = weekRange(req.query);
    const recs = [];

    // Persona-scope filters
    const rConds  = [];
    const rParams = [];
    if (req.query.locationId) {
      rConds.push('po.location_id = ?');
      rParams.push(parseInt(req.query.locationId));
    }
    if (req.query.skuFamily && FAMILY_PATTERNS[req.query.skuFamily]) {
      const skus = FAMILY_PATTERNS[req.query.skuFamily];
      rConds.push(`po.sku IN (${skus.map(() => '?').join(',')})`);
      rParams.push(...skus);
    }
    const rWhere = rConds.length ? 'AND ' + rConds.join(' AND ') : '';

    // Load hours_per_unit map once
    const hpuRows = db.prepare(`SELECT sku, hours_per_unit FROM sku_planning_params`).all();
    const HPU = Object.fromEntries(hpuRows.map(r => [r.sku, r.hours_per_unit]));

    // ── A. Capacity overloads ────────────────────────────────────────────
    // Aggregate capacity at the plant+line+week level (hours basis)
    const capIssues = db.prepare(`
      SELECT po.plant_id, po.production_line_id, po.week_number,
        p.name AS plant_name, pl.name AS line_name, pl.line_category,
        (pl.hours_per_shift * pl.shifts_per_day * pl.working_days_per_week) AS line_cap_hrs,
        ROUND(SUM(po.capacity_required), 1) AS total_req_hrs,
        ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)), 1) AS total_shortage,
        ROUND(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)), 1) AS total_demand,
        ROUND(SUM(po.planned_production), 1) AS total_prod
      FROM planning_orders po
      JOIN plants p  ON po.plant_id=p.plant_id
      JOIN production_lines pl ON po.production_line_id=pl.line_id
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      WHERE po.scenario_id=? AND po.year=2026 AND po.week_number BETWEEN ? AND ?
        ${rWhere}
      GROUP BY po.plant_id, po.production_line_id, po.week_number
      HAVING total_req_hrs > line_cap_hrs AND total_shortage > 0
      ORDER BY total_shortage DESC
      LIMIT 8`
    ).all(scenarioId, start, end, ...rParams);

    for (const ci of capIssues) {
      const overloadHrs  = ci.total_req_hrs - ci.line_cap_hrs;
      const overloadPct  = (overloadHrs / ci.line_cap_hrs * 100).toFixed(1);
      // Average hpu for this line category
      const lineHpu      = hpuRows.find(r => r.sku.startsWith(ci.line_category === 'AC' ? 'AC' : ci.line_category === 'WM' ? 'WM' : 'REF'))?.hours_per_unit ?? 0.4;
      const extraHrs     = 8; // one Saturday shift
      const extraUnits   = Math.round(extraHrs / lineHpu);
      const newShortage  = Math.max(0, ci.total_shortage - extraUnits);
      const svcBefore    = ci.total_demand > 0 ? (1 - ci.total_shortage / ci.total_demand) * 100 : 100;
      const svcAfter     = ci.total_demand > 0 ? (1 - newShortage / ci.total_demand) * 100 : 100;

      recs.push({
        id:       `cap-${ci.plant_id}-${ci.production_line_id}-w${ci.week_number}`,
        priority: parseFloat(overloadPct) > 50 ? 'HIGH' : 'MEDIUM',
        type:     'CAPACITY',
        issue:    `${ci.line_name} at ${ci.plant_name} overloaded by ${overloadPct}% in week ${ci.week_number}`,
        recommendedActions: [
          `Add Saturday overtime shift on ${ci.line_name} (week ${ci.week_number}) — +${extraUnits} units`,
          `Shift ${Math.round(overloadHrs / lineHpu)} units of ${ci.line_category} production to alternate plant`,
        ],
        impact: {
          before: { utilizationPct: +(ci.total_req_hrs / ci.line_cap_hrs * 100).toFixed(1), shortageQty: ci.total_shortage, serviceLevelPct: +svcBefore.toFixed(1) },
          after:  { utilizationPct: +((ci.total_req_hrs - extraHrs) / ci.line_cap_hrs * 100).toFixed(1), shortageQty: newShortage, serviceLevelPct: +svcAfter.toFixed(1) },
        },
        actionParams: {
          actionType: 'add_overtime',
          weekNumber: ci.week_number,
          params: { plantId: ci.plant_id, lineId: ci.production_line_id, extraHoursPerWeek: extraHrs },
        },
      });
    }

    // ── B. Material shortages ────────────────────────────────────────────
    const matIssues = db.prepare(`
      SELECT po.sku, po.week_number, po.location_id, po.planned_production,
        po.shortage_qty, po.forecast_demand, po.material_availability,
        l.name AS location_name
      FROM planning_orders po
      JOIN locations l ON po.location_id=l.location_id
      WHERE po.scenario_id=? AND po.year=2026 AND po.week_number BETWEEN ? AND ?
        ${rWhere}
        AND po.material_availability < 14
      ORDER BY po.material_availability ASC
      LIMIT 6`
    ).all(scenarioId, start, end, ...rParams);

    for (const mi of matIssues) {
      const tightComp = db.prepare(`
        SELECT c.component_id, c.name AS comp_name, c.code, c.on_hand_qty, c.unit_cost,
          s.supplier_id, s.name AS supplier_name, s.lead_time_days, bl.qty_per
        FROM bom_lines bl
        JOIN components c ON bl.component_id=c.component_id
        JOIN suppliers s ON c.supplier_id=s.supplier_id
        WHERE bl.sku=?
        ORDER BY c.on_hand_qty / bl.qty_per ASC
        LIMIT 1`
      ).get(mi.sku);

      if (!tightComp) continue;

      const weeklyDraw   = mi.planned_production * tightComp.qty_per;
      const expediteQty  = Math.round(weeklyDraw * 2);
      const costImpact   = expediteQty * tightComp.unit_cost * 0.05; // 5% premium for expediting
      const svcBefore    = mi.forecast_demand > 0 ? (1 - mi.shortage_qty / mi.forecast_demand) * 100 : 100;
      const recoverUnits = Math.min(mi.shortage_qty, expediteQty / tightComp.qty_per);
      const svcAfter     = mi.forecast_demand > 0 ? (1 - Math.max(0, mi.shortage_qty - recoverUnits) / mi.forecast_demand) * 100 : 100;

      recs.push({
        id:       `mat-${mi.sku}-${mi.location_id}-w${mi.week_number}`,
        priority: mi.material_availability < 7 ? 'HIGH' : 'MEDIUM',
        type:     'MATERIAL',
        issue:    `${mi.sku} at ${mi.location_name} week ${mi.week_number}: ${tightComp.comp_name} coverage ${mi.material_availability.toFixed(1)} days`,
        recommendedActions: [
          `Expedite ${tightComp.comp_name} PO from ${tightComp.supplier_name} — request ${expediteQty} units 2 weeks early`,
          `Reduce planned production of ${mi.sku} by ${Math.round(weeklyDraw)} to extend coverage`,
        ],
        impact: {
          before: { coverageDays: +mi.material_availability.toFixed(1), shortageQty: +mi.shortage_qty.toFixed(1), serviceLevelPct: +svcBefore.toFixed(1) },
          after:  { coverageDays: +(mi.material_availability + 14).toFixed(1), shortageQty: +Math.max(0, mi.shortage_qty - recoverUnits).toFixed(1), serviceLevelPct: +svcAfter.toFixed(1), expediteCostINR: Math.round(costImpact) },
        },
        actionParams: {
          actionType: 'expedite_supplier',
          params: {
            componentId: tightComp.component_id,
            supplierId:  tightComp.supplier_id,
            qty:         expediteQty,
            newWeekDue:  Math.max(1, mi.week_number - 2),
          },
        },
      });
    }

    // ── C. High-value inventory shortages (pull-ahead opportunities) ──────
    const invIssues = db.prepare(`
      SELECT po.sku, po.week_number, po.location_id,
        MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) AS shortage_qty,
        COALESCE(dwd.final_consensus, po.forecast_demand) AS forecast_demand,
        po.planned_production, po.beginning_inventory,
        l.name AS location_name, pm.price,
        (MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) * pm.price) AS revenue_at_risk
      FROM planning_orders po
      JOIN product_master pm ON po.sku=pm.sku
      JOIN locations l ON po.location_id=l.location_id
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      WHERE po.scenario_id=? AND po.year=2026 AND po.week_number BETWEEN ? AND ?
        ${rWhere}
        AND (COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) > 10
      ORDER BY revenue_at_risk DESC
      LIMIT 5`
    ).all(scenarioId, start, end, ...rParams);

    for (const ii of invIssues) {
      const futureWeek = Math.min(52, ii.week_number + 2);
      const futureRow  = db.prepare(`
        SELECT capacity_available, capacity_required, planned_production
        FROM planning_orders
        WHERE sku=? AND location_id=? AND scenario_id=? AND week_number=? AND year=2026`
      ).get(ii.sku, ii.location_id, scenarioId, futureWeek);

      if (!futureRow) continue;
      const hpu = HPU[ii.sku] || 0.4;
      const spareCapHrs = Math.max(0, futureRow.capacity_available * hpu - futureRow.capacity_required);
      const pullableQty = Math.floor(Math.min(ii.shortage_qty, spareCapHrs / hpu, futureRow.planned_production));
      if (pullableQty < 5) continue;

      const revenueRecovered = Math.round(pullableQty * ii.price);

      recs.push({
        id:       `inv-${ii.sku}-${ii.location_id}-w${ii.week_number}`,
        priority: ii.revenue_at_risk > 500000 ? 'HIGH' : 'MEDIUM',
        type:     'INVENTORY',
        issue:    `${ii.sku} shortage of ${ii.shortage_qty.toFixed(0)} units at ${ii.location_name} week ${ii.week_number} — ₹${(ii.revenue_at_risk/100000).toFixed(1)}L at risk`,
        recommendedActions: [
          `Pull ahead ${pullableQty} units from week ${futureWeek} to week ${ii.week_number} (${spareCapHrs.toFixed(1)} spare capacity hrs available)`,
          `Prioritize Tier-1 customer allocation for available ${Math.round(ii.planned_production + ii.beginning_inventory)} units`,
        ],
        impact: {
          before: { shortageQty: +ii.shortage_qty.toFixed(1), revenueAtRisk: Math.round(ii.revenue_at_risk) },
          after:  { shortageQty: +Math.max(0, ii.shortage_qty - pullableQty).toFixed(1), revenueAtRisk: Math.round(ii.revenue_at_risk - revenueRecovered), revenueRecoveredINR: revenueRecovered },
        },
        actionParams: {
          actionType: 'pull_ahead',
          sku:        ii.sku,
          locationId: ii.location_id,
          weekNumber: ii.week_number,
          params: { fromWeek: futureWeek, toWeek: ii.week_number, qty: pullableQty },
        },
      });
    }

    // Sort: HIGH first, then by type (CAPACITY > MATERIAL > INVENTORY)
    const priorityOrder  = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const typeOrder      = { CAPACITY: 0, MATERIAL: 1, INVENTORY: 2 };
    recs.sort((a, b) =>
      (priorityOrder[a.priority] - priorityOrder[b.priority]) ||
      (typeOrder[a.type]         - typeOrder[b.type])
    );

    db.close();
    res.json({ scenarioId, weekRange: { start, end }, count: recs.length, recommendations: recs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/scenarios ──────────────────────────────────────────────
// List all supply scenarios with aggregate KPI summaries.
// Query params: weekStart, weekEnd

router.get('/scenarios', (req, res) => {
  try {
    const db = getDb();
    const { start, end } = weekRange(req.query);

    const scenarios = db.prepare(`
      SELECT sc.scenario_id, sc.name, sc.description, sc.action_type, sc.status, sc.created_at,
        ROUND(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)), 0) AS total_demand,
        ROUND(SUM(po.planned_production), 0) AS total_supply,
        ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)), 0) AS total_shortage,
        ROUND((1 - SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production))
               /NULLIF(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)),0))*100, 1) AS service_level_pct,
        ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) * pm.price), 0) AS revenue_at_risk,
        ROUND(SUM(po.capacity_required)*100.0/NULLIF(
          (SELECT SUM(pl2.hours_per_shift * pl2.shifts_per_day * pl2.working_days_per_week)
           FROM (SELECT DISTINCT po2.production_line_id, po2.week_number
                 FROM planning_orders po2
                 WHERE po2.scenario_id=sc.scenario_id AND po2.year=2026
                   AND po2.week_number BETWEEN ? AND ?) dw2
           JOIN production_lines pl2 ON pl2.line_id=dw2.production_line_id)
        ,0), 1) AS cap_util_pct
      FROM scenario_supply_plans sc
      LEFT JOIN planning_orders po ON po.scenario_id=sc.scenario_id
        AND po.year=2026 AND po.week_number BETWEEN ? AND ?
      LEFT JOIN product_master pm ON po.sku=pm.sku
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      GROUP BY sc.scenario_id
      ORDER BY sc.scenario_id`
    ).all(start, end, start, end);

    db.close();
    res.json({ weekRange: { start, end }, scenarios });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/supply/scenarios ─────────────────────────────────────────────
// Create a new named scenario by cloning the baseline planning orders.
// Body: { name, description, actionType }

router.post('/scenarios', (req, res) => {
  try {
    const db   = getDb();
    const { name, description, actionType = 'CUSTOM' } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const baselineId = getBaseline(db);

    const txn = db.transaction(() => {
      const newScenId = db.prepare(`
        INSERT INTO scenario_supply_plans (name, description, action_type, status)
        VALUES (?, ?, ?, 'draft')`
      ).run(name, description || null, actionType).lastInsertRowid;

      // Clone all baseline planning orders into the new scenario
      db.prepare(`
        INSERT INTO planning_orders (
          sku, location_id, plant_id, production_line_id, week_number, year, scenario_id,
          forecast_demand, customer_orders, priority_demand,
          beginning_inventory, planned_production, firm_production_orders,
          purchase_orders, transfer_orders, ending_inventory,
          capacity_available, capacity_required, material_availability, shortage_qty, supply_gap
        )
        SELECT
          sku, location_id, plant_id, production_line_id, week_number, year, ?,
          forecast_demand, customer_orders, priority_demand,
          beginning_inventory, planned_production, firm_production_orders,
          purchase_orders, transfer_orders, ending_inventory,
          capacity_available, capacity_required, material_availability, shortage_qty, supply_gap
        FROM planning_orders
        WHERE scenario_id=? AND year=2026`
      ).run(newScenId, baselineId);

      return newScenId;
    });

    const newId = txn();
    const rows  = db.prepare(`SELECT COUNT(*) AS n FROM planning_orders WHERE scenario_id=?`).get(newId).n;
    db.close();
    res.json({ success: true, scenarioId: newId, name, clonedRowCount: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/scenarios/compare ─────────────────────────────────────
// Side-by-side KPI comparison for 2+ scenarios.
// Query params: ids (comma-separated scenario IDs), weekStart, weekEnd

router.get('/scenarios/compare', (req, res) => {
  try {
    const db = getDb();
    const rawIds = (req.query.ids || '').split(',').map(s => parseInt(s.trim())).filter(Boolean);
    if (rawIds.length < 1) return res.status(400).json({ error: 'Provide at least one scenario id in ?ids=' });
    const { start, end } = weekRange(req.query);

    const placeholders = rawIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT sc.scenario_id, sc.name, sc.action_type, sc.status,
        ROUND(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)), 0) AS total_demand,
        ROUND(SUM(po.planned_production), 0) AS total_supply,
        ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.planned_production)), 0) AS supply_gap,
        ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production)), 0) AS total_shortage,
        ROUND((1 - SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production))
               /NULLIF(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)),0))*100, 1) AS service_level_pct,
        ROUND(SUM(MAX(0, COALESCE(dwd.final_consensus, po.forecast_demand) - po.beginning_inventory - po.planned_production) * pm.price), 0) AS revenue_at_risk,
        ROUND(SUM(po.ending_inventory), 0) AS total_ending_inventory,
        ROUND(SUM(po.ending_inventory)*7.0/NULLIF(SUM(COALESCE(dwd.final_consensus, po.forecast_demand)),0), 1) AS inventory_days,
        ROUND(SUM(po.capacity_required)*100.0/NULLIF(
          (SELECT SUM(pl2.hours_per_shift * pl2.shifts_per_day * pl2.working_days_per_week)
           FROM (SELECT DISTINCT po2.production_line_id, po2.week_number
                 FROM planning_orders po2
                 WHERE po2.scenario_id=sc.scenario_id AND po2.year=2026
                   AND po2.week_number BETWEEN ? AND ?) dw2
           JOIN production_lines pl2 ON pl2.line_id=dw2.production_line_id)
        ,0), 1) AS cap_util_pct,
        ROUND(AVG(po.material_availability), 1) AS avg_material_coverage_days
      FROM scenario_supply_plans sc
      JOIN planning_orders po ON po.scenario_id=sc.scenario_id
        AND po.year=2026 AND po.week_number BETWEEN ? AND ?
      JOIN product_master pm ON po.sku=pm.sku
      LEFT JOIN demand_weekly_data dwd
             ON dwd.sku=po.sku AND dwd.location_id=po.location_id AND dwd.week_number=po.week_number
      WHERE sc.scenario_id IN (${placeholders})
      GROUP BY sc.scenario_id
      ORDER BY sc.scenario_id`
    ).all(start, end, start, end, ...rawIds);

    db.close();
    res.json({ weekRange: { start, end }, scenarioIds: rawIds, comparison: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/supply/scenarios/:id ──────────────────────────────────────
// Permanently delete a non-baseline scenario and all its planning orders.

router.delete('/scenarios/:id', (req, res) => {
  try {
    const db = getDb();
    const scenarioId = parseInt(req.params.id);
    if (!scenarioId) return res.status(400).json({ error: 'Invalid scenario id' });

    const scenario = db.prepare(`SELECT * FROM scenario_supply_plans WHERE scenario_id=?`).get(scenarioId);
    if (!scenario) return res.status(404).json({ error: 'Scenario not found' });
    if (scenario.action_type === 'BASELINE') return res.status(403).json({ error: 'Cannot delete the Baseline Plan' });

    db.transaction(() => {
      db.prepare(`DELETE FROM planning_orders WHERE scenario_id=?`).run(scenarioId);
      db.prepare(`DELETE FROM scenario_supply_plans WHERE scenario_id=?`).run(scenarioId);
    })();

    db.close();
    res.json({ success: true, deletedScenarioId: scenarioId, name: scenario.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/supply/whatif/candidates ────────────────────────────────────────
// SKU-locations with shortage_qty > 0, with ABC/XYZ/severity quick-filters.
// Query params: scenarioId, weekStart, weekEnd, abcClass, xyzClass, severity

router.get('/whatif/candidates', (req, res) => {
  try {
    const db         = getDb();
    const scenarioId = parseInt(req.query.scenarioId) || getBaseline(db);
    const { start, end } = weekRange(req.query);

    const rows = db.prepare(`
      SELECT po.sku, po.location_id,
        l.name AS location_name, l.region,
        pm.abc_class, pm.xyz_class, pm.category,
        po.plant_id, po.production_line_id,
        pl.name AS line_name, p.name AS plant_name,
        SUM(po.shortage_qty)                            AS total_shortage,
        SUM(po.forecast_demand)                         AS total_demand,
        COUNT(*)                                        AS weeks_with_shortage,
        MIN(po.material_availability)                   AS min_material_avail,
        MAX(po.capacity_required - po.capacity_available) AS max_cap_overload
      FROM planning_orders po
      JOIN product_master     pm ON po.sku             = pm.sku
      JOIN locations           l ON po.location_id     = l.location_id
      JOIN plants              p ON po.plant_id        = p.plant_id
      JOIN production_lines   pl ON po.production_line_id = pl.line_id
      WHERE po.shortage_qty > 0
        AND po.scenario_id = ?
        AND po.year = 2026
        AND po.week_number BETWEEN ? AND ?
      GROUP BY po.sku, po.location_id, po.plant_id, po.production_line_id,
               l.name, l.region, pm.abc_class, pm.xyz_class, pm.category,
               pl.name, p.name
      ORDER BY total_shortage DESC
    `).all(scenarioId, start, end);

    const { abcClass, xyzClass, severity, locationId: candLocId, skuFamily: candFamily } = req.query;
    const familySkus = candFamily && FAMILY_PATTERNS[candFamily] ? new Set(FAMILY_PATTERNS[candFamily]) : null;

    const candidates = rows
      .map(r => {
        const pct = r.total_demand > 0 ? r.total_shortage / r.total_demand : 0;
        const sev = pct > 0.30 ? 'critical' : pct >= 0.10 ? 'high' : 'low';
        return { ...r, severity: sev, severityPct: Math.round(pct * 100) };
      })
      .filter(r => {
        if (abcClass    && r.abc_class   !== abcClass)                  return false;
        if (xyzClass    && r.xyz_class   !== xyzClass)                  return false;
        if (severity    && r.severity    !== severity)                   return false;
        if (candLocId   && r.location_id !== parseInt(candLocId))       return false;
        if (familySkus  && !familySkus.has(r.sku))                      return false;
        return true;
      });

    db.close();
    res.json({ scenarioId, weekRange: { start, end }, count: candidates.length, candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/supply/whatif/simulate ─────────────────────────────────────────
// Read-only lever simulation — reuses action math but makes NO DB writes.
// Body: { lever, params, selections:[{sku,locationId}], scenarioId, weekStart, weekEnd }

router.post('/whatif/simulate', (req, res) => {
  try {
    const db = getDb();
    const {
      lever, params = {}, selections = [],
      scenarioId: rawSc, weekStart: rawWs, weekEnd: rawWe,
    } = req.body;
    if (!lever)            return res.status(400).json({ error: 'lever is required' });
    if (!selections.length) return res.status(400).json({ error: 'at least one selection is required' });

    const scenarioId = parseInt(rawSc) || getBaseline(db);
    const start = Math.max(1,  parseInt(rawWs) || 22);
    const end   = Math.min(52, parseInt(rawWe) || start + 12);

    const hpuMap = Object.fromEntries(
      db.prepare(`SELECT sku, hours_per_unit FROM sku_planning_params`).all()
        .map(r => [r.sku, r.hours_per_unit || 0.4])
    );

    const rows = [];

    for (const sel of selections) {
      const sku   = sel.sku;
      const locId = parseInt(sel.locationId);

      const orders = db.prepare(`
        SELECT po.*, spp.hours_per_unit, pm.abc_class, pm.xyz_class,
          l.name AS location_name, p.name AS plant_name, pl.name AS line_name
        FROM planning_orders po
        JOIN sku_planning_params spp ON po.sku             = spp.sku
        JOIN product_master       pm ON po.sku             = pm.sku
        JOIN locations             l ON po.location_id     = l.location_id
        JOIN plants                p ON po.plant_id        = p.plant_id
        JOIN production_lines     pl ON po.production_line_id = pl.line_id
        WHERE po.sku=? AND po.location_id=? AND po.scenario_id=?
          AND po.year=2026 AND po.week_number BETWEEN ? AND ?
        ORDER BY po.week_number
      `).all(sku, locId, scenarioId, start, end);

      if (!orders.length) {
        rows.push({
          sku, locationId: locId, locationName: '?', abcClass: '?', xyzClass: '?',
          before: { totalShortage: 0, serviceLevel: 100 },
          after:  { totalShortage: 0, serviceLevel: 100 },
          gapReduction: 0, costImpact: 0, improved: false,
          note: 'No planning data found for this selection',
        });
        continue;
      }

      const first         = orders[0];
      const totalDemand   = orders.reduce((s, o) => s + (o.forecast_demand  || 0), 0);
      const beforeShortage = orders.reduce((s, o) => s + (o.shortage_qty    || 0), 0);
      const beforeSvcLvl  = totalDemand > 0
        ? Math.round((1 - beforeShortage / totalDemand) * 1000) / 10 : 100;

      let afterShortage = beforeShortage;
      let costImpact    = 0;
      let improved      = false;
      let note          = null;

      // ── Add Overtime ───────────────────────────────────────────────────────
      if (lever === 'add_overtime') {
        const pId = parseInt(params.plantId);
        const lId = parseInt(params.lineId);
        const hrs = parseFloat(params.extraHoursPerWeek) || 8;
        const hpu = hpuMap[sku];

        const onTargetLine = orders.some(o => o.plant_id === pId && o.production_line_id === lId);
        if (!onTargetLine) {
          note = `${sku} is not produced at the selected plant/line — overtime there has no effect here`;
        } else {
          let newTotal = 0;
          let weeksHelped = 0;
          let weeksMatConstr = 0;
          for (const o of orders) {
            if ((o.shortage_qty || 0) <= 0) continue;
            if ((o.material_availability || 999) < 7) {
              newTotal += o.shortage_qty;
              weeksMatConstr++;
            } else if ((o.capacity_required || 0) <= (o.capacity_available || 0)) {
              newTotal += o.shortage_qty;
            } else {
              const extraUnits = hrs / hpu;
              const newCap  = o.capacity_available + extraUnits;
              const newProd = Math.min(newCap, o.planned_production + extraUnits);
              newTotal += Math.max(0, o.forecast_demand - o.beginning_inventory - newProd);
              weeksHelped++;
            }
          }
          afterShortage = Math.round(newTotal * 10) / 10;
          costImpact    = Math.round(hrs * weeksHelped * 500); // ₹500/overtime-hour
          improved = afterShortage < beforeShortage;
          if (!improved) {
            note = weeksMatConstr > 0
              ? `Material-constrained (${weeksMatConstr} wk${weeksMatConstr > 1 ? 's' : ''}) — overtime cannot address component shortage`
              : `Not at capacity limit — shortage is not driven by line capacity`;
          }
        }
      }

      // ── Change Plant ───────────────────────────────────────────────────────
      else if (lever === 'change_plant') {
        const newPId       = parseInt(params.newPlantId);
        const lineCategory = db.prepare(`SELECT line_category FROM sku_planning_params WHERE sku=?`).get(sku)?.line_category;
        const newLine      = db.prepare(`
          SELECT line_id, hours_per_shift, shifts_per_day, working_days_per_week
          FROM production_lines WHERE plant_id=? AND line_category=? LIMIT 1
        `).get(newPId, lineCategory);

        if (!newLine) {
          note = `New plant has no compatible production line for ${lineCategory || 'this SKU category'}`;
        } else {
          const hpu    = hpuMap[sku];
          const newCap = (newLine.hours_per_shift * newLine.shifts_per_day * newLine.working_days_per_week) / hpu;
          let newTotal = 0;
          for (const o of orders) {
            const newProd = Math.min(newCap, o.forecast_demand);
            newTotal += Math.max(0, o.forecast_demand - o.beginning_inventory - newProd);
          }
          afterShortage = Math.round(newTotal * 10) / 10;
          costImpact    = Math.round(Math.max(0, beforeShortage - newTotal) * 1000); // ₹1000/unit transferred
          improved = afterShortage < beforeShortage;
          if (!improved) {
            const newPlantName = db.prepare(`SELECT name FROM plants WHERE plant_id=?`).get(newPId)?.name || `Plant ${newPId}`;
            note = `Shifting to ${newPlantName} does not increase available capacity for this SKU`;
          }
        }
      }

      // ── Expedite Supplier ──────────────────────────────────────────────────
      else if (lever === 'expedite_supplier') {
        const cId     = parseInt(params.componentId);
        const qty     = parseInt(params.qty) || 0;
        const weekDue = parseInt(params.newWeekDue) || start;
        const bomRow  = db.prepare(`SELECT qty_per FROM bom_lines WHERE sku=? AND component_id=?`).get(sku, cId);

        if (!bomRow) {
          note = `${sku} does not use this component — expediting has no direct effect`;
        } else {
          const comp   = db.prepare(`SELECT unit_cost FROM components WHERE component_id=?`).get(cId);
          let newTotal = 0;
          for (const o of orders) {
            if (o.week_number >= weekDue && (o.shortage_qty || 0) > 0 && (o.material_availability || 999) < 14) {
              const recoverable = Math.min(o.shortage_qty, qty / bomRow.qty_per);
              newTotal += Math.max(0, o.shortage_qty - recoverable);
            } else {
              newTotal += (o.shortage_qty || 0);
            }
          }
          afterShortage = Math.round(newTotal * 10) / 10;
          costImpact    = Math.round(qty * (comp?.unit_cost || 1000) * 0.05); // 5% expedite premium
          improved      = afterShortage < beforeShortage;
          if (!improved) note = `Shortage in ${sku} is not driven by this component's availability`;
        }
      }

      const afterSvcLvl = totalDemand > 0
        ? Math.round((1 - afterShortage / totalDemand) * 1000) / 10 : 100;

      rows.push({
        sku, locationId: locId, locationName: first.location_name,
        abcClass: first.abc_class, xyzClass: first.xyz_class,
        plantId: first.plant_id,  plantName: first.plant_name,
        lineId:  first.production_line_id, lineName: first.line_name,
        before: { totalShortage: Math.round(beforeShortage * 10) / 10, serviceLevel: beforeSvcLvl },
        after:  { totalShortage: Math.round(afterShortage  * 10) / 10, serviceLevel: afterSvcLvl  },
        gapReduction: Math.round((beforeShortage - afterShortage) * 10) / 10,
        costImpact, improved, note,
      });
    }

    const totBefore = Math.round(rows.reduce((s, r) => s + r.before.totalShortage, 0) * 10) / 10;
    const totAfter  = Math.round(rows.reduce((s, r) => s + r.after.totalShortage,  0) * 10) / 10;

    db.close();
    res.json({
      lever, scenarioId, weekRange: { start, end },
      summary: {
        totalGapBefore:  totBefore,
        totalGapAfter:   totAfter,
        gapReduction:    Math.round((totBefore - totAfter) * 10) / 10,
        skusImproved:    rows.filter(r => r.improved).length,
        skusUnchanged:   rows.filter(r => !r.improved).length,
        totalCostImpact: rows.reduce((s, r) => s + (r.costImpact || 0), 0),
      },
      rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/supply/reset ─────────────────────────────────────────────────
// Wipe all supply planning data and re-run the original seed script.
// This restores the Baseline to its original state and deletes all other scenarios.

router.post('/reset', (req, res) => {
  try {
    const seedSupply = require('../db/seed_supply');
    seedSupply(true);
    res.json({ success: true, message: 'Supply planning data reset to original seed state' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
