# Demand Planning — Step A.2: API Routes (Forecast Grid, Patterns, Exceptions)

Read DEMAND_PLANNING_SPEC.md in full before starting. Step A.1 (schema/seeding) is complete and verified - this step builds the API layer on top of it. No UI yet.

This step covers ONLY the routes needed for: Forecast Grid, Patterns, and Exceptions. What-If and NPI Forecasting have different shapes and will be separate steps - do not build routes for those here.

## What to build

Create a new route file, e.g. `server/routes/demand_planning.js` (your call on exact name/structure, but keep it separate from the existing `forecast.js`/`collaboration.js`/etc., since those power the old pages which stay untouched per spec Section 6).

### 1. Forecast Grid endpoint(s)
Needs to return, for a given filter set (location, product group, SKU search, ABC/XYZ class - see spec Section 4), the weekly grid data: per SKU → location, all 52 weeks, with the 4 rows (Actual Sales, System Forecast, Planner Adjustment, Final Consensus) from `demand_weekly_data`.

Also needs a write endpoint: editing a Planner Adjustment cell (forward weeks only - your call on what "forward" means for this demo dataset, follow whatever convention Step A.1 used for "past" vs not) should update that row's `planner_adjustment` AND recompute `final_consensus` immediately, mirroring how Supply Planning's grid edits work.

### 2. Patterns endpoint(s)
Needs to return:
- Classification distribution counts (how many SKUs fall into each Trend/Seasonal/Stable/Random bucket) - NOTE: check whether this classification dimension already exists anywhere from Step A.1, or whether it needs to be computed here. The ABC/XYZ classification from Step A.1 is a DIFFERENT dimension (volume/variability) than this Trend/Seasonal/Stable/Random pattern type - confirm with me if you're unsure which data this should actually draw from before inventing new logic.
- Volume × variability scatter data (one point per SKU, x = volume, y = CoV - this one DOES come directly from Step A.1's classification work).
- The SKU-level detail table: one row per SKU-location for volume/demand numbers, but the ABC/XYZ classification badge shown is the per-SKU value from `product_master` (same value across all of that SKU's location rows) - per spec Section 5.2's resolved per-SKU grain decision.

### 3. Exceptions endpoint(s)
Return the `demand_exceptions` rows from Step A.1, with whatever filtering makes sense (by severity, by category) - look at how Supply Planning's Exception Inbox / Recommendations endpoints are structured for a consistent response shape, but this is demand-side data, don't just copy supply-side fields that don't apply.

### 4. KPI bar endpoint
A single endpoint that computes and returns all 8 KPI bar values from spec Section 3 (Total Forecast Demand, Forecast Accuracy %, Bias %, Open Planner Adjustments, Revenue Forecast, Inventory Days, A-Class Coverage %, Open Exceptions). State clearly which underlying tables/columns each of the 8 numbers is actually computed from - I want to be able to trace each KPI back to real data, the same transparency Supply Planning's KPIs have.

## Before writing code

Explain your planned route structure and exact endpoint paths/response shapes first, the same way Supply Planning's Step 3.2 was approached - I want to review the shape before it's built, not just the result.

If anything in this task is ambiguous or you're filling in a gap with an assumption, flag it explicitly rather than silently deciding - especially the Patterns "classification distribution" question above, since that's a real ambiguity I flagged, not a minor detail.

## Verification

After building, give me a way to verify this myself - either a list of exact curl commands / browser URLs I can hit directly to see real JSON responses, or confirm these will only be testable once the UI exists in Step A.3 (in which case say so clearly rather than implying it's independently testable when it isn't).
