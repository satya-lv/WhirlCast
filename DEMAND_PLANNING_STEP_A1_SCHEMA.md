# Demand Planning — Step A.1: Schema Migration

Read DEMAND_PLANNING_SPEC.md in full before starting, especially Sections 7, 7a, 7b, 7c.

This is a SCHEMA-ONLY step. No API routes, no UI components. The goal is to create and seed the new database structures, then verify them directly via SQL queries — exactly like Supply Planning's Step 3.1.

## What to build

### 1. New columns on `product_master`
Add via migration (not editing the original CREATE TABLE, same ALTER TABLE pattern already used for `lead_time_days`/`lead_time_variability_days`):
- `abc_class TEXT` (values: 'A', 'B', or 'C')
- `xyz_class TEXT` (values: 'X', 'Y', or 'Z')
- `cov REAL` (coefficient of variation, the raw number the XYZ class is derived from)
- `classification_updated_at TEXT` (timestamp of last computation)

### 2. New table: `demand_weekly_data`
Minimum columns (exact types/constraints your call, follow existing schema.js conventions):
- `sku TEXT` (FK-equivalent to product_master.sku)
- `location_id INTEGER` (FK to Supply Planning's `locations` table)
- `week_number INTEGER` (1-52)
- `year INTEGER`
- `actual_sales REAL`
- `system_forecast REAL`
- `planner_adjustment REAL`
- `final_consensus REAL`

This should cover the same 10 SKUs × 8 locations × 52 weeks Supply Planning already uses (4,160 rows, matching `planning_orders`' existing scale).

### 3. New table: `demand_exceptions`
Design this table yourself based on the 4 exception categories in DEMAND_PLANNING_SPEC.md Section 5.4 (forecast accuracy degradation, large unexplained planner override, demand pattern shift, new-product risk). Look at how Supply Planning's exception/recommendation tables are structured for a consistent pattern (severity, financial impact, recommendation text, etc.) but don't just copy them blindly - this is demand-side, not supply-side. Explain your schema choice before implementing it.

## Seeding logic

### ABC/XYZ classification
- Compute from `forecast_runs`' existing 2025 monthly history (12 months × 10 SKUs × 8 locations), AGGREGATED TO NATIONAL TOTALS PER SKU (sum across all 8 locations for each SKU, since classification is per-SKU not per-SKU-location, per spec Section 7).
- ABC: rank SKUs by total volume contribution. Use the standard 80/15/5 or similar Pareto-style cutoff for A/B/C - your call on exact thresholds, but explain your reasoning.
- XYZ: rank by coefficient of variation (CoV = stddev/mean) of monthly demand. Use a standard cutoff (e.g. CoV < 0.5 = X, 0.5-1.0 = Y, >1.0 = Z, or similar) - again your call, explain reasoning.
- Write this as a reusable function (e.g. `computeAbcXyzClassification()`) since per spec Section 7 this needs to run both automatically on seed/reset AND via a future manual "Recalculate" button - don't write it as a one-off inline script.

### Weekly demand data
- Generate FRESH weekly data, do NOT disaggregate the monthly forecast_runs history (per spec Section 7a's resolved decision).
- Write a weekly sibling to the existing `getSeasonalM()` pattern (e.g. `getSeasonalW(weekNumber)`) that produces realistic week-to-week seasonal texture - same big-picture seasonal shape as the existing monthly logic (e.g. AC products still peak in summer weeks), but with natural week-to-week variation, not a flat repeated monthly value.
- `actual_sales` should be populated for "past" weeks (your call on what counts as past, given this is a demo dataset - could be all 52 weeks, or some subset) using this seasonal formula plus randomness, similar in spirit to how `seed_supply.js` already generates Supply Planning's demand numbers.
- `system_forecast` should be a related-but-distinct numeric series (it's the algorithm's prediction, not identical to actual_sales) - introduce a deliberate, modest forecast error so Forecast Accuracy % (a KPI we'll build later) has something real to show.
- `planner_adjustment` should start at 0 for all rows (nothing manually adjusted yet in a fresh seed).
- `final_consensus` = system_forecast + planner_adjustment (matching the spec's Forecast Grid row logic).

### demand_exceptions seeding
Populate this based on your own schema design and the 4 trigger categories - compute real exceptions from the seeded weekly data and classification (e.g. SKU-locations with the worst forecast accuracy genuinely should show up here, not random rows).

## Verification (do this yourself, then give me steps to verify independently)

1. Run a query confirming `product_master` now has all 10 SKUs with non-null abc_class/xyz_class values, and show me the actual classification result (which SKUs landed in A vs B vs C, X vs Y vs Z) so we can sanity-check it makes sense (e.g. do AC units, which are seasonal/high-variability, land in Y or Z as expected?).
2. Run a COUNT(*) on `demand_weekly_data` and confirm it's the expected total (10 × 8 × 52 = 4,160, or explain if your row count differs and why).
3. Spot-check a few real rows from `demand_weekly_data` - confirm actual_sales/system_forecast/final_consensus look sane (not all zeros, not nulls, final_consensus correctly equals system_forecast + planner_adjustment).
4. Run a query on `demand_exceptions` and show me a few real example rows with their severity/category/recommendation text.
5. Confirm none of this touched any existing Supply Planning table or existing Demand Planning route/page - this should be purely additive.

Give me the exact SQL queries you used for each verification step so I can run them myself afterward and see the same results independently.
