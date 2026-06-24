# Step B — Connect Supply Planning's Demand to Demand Planning's Real Data

Read DEMAND_PLANNING_SPEC.md Section 9 in full before starting. Step A (Demand Planning's full build - schema, API, all 5 tabs) is complete and verified, both locally and in production. This is the follow-on step: wiring Supply Planning to actually consume that real data instead of its own independent demand formula.

This step modifies Supply Planning's LIVE, WORKING, DEPLOYED code. Treat this with the same care as the original Supply Planning build - explain your plan before changing anything, and expect a full re-verification pass afterward, not a quick patch.

## Decisions already made (not open for reinterpretation)

- Supply Planning will use Demand Planning's **Final Consensus** value (System Forecast + Planner Adjustment) as its real demand input - NOT the raw System Forecast. This is the planner-reviewed number, and using it means the existing What-If "Apply Scenario" feature's writes flow downstream into Supply Planning too.
- This is a direct REPLACEMENT of `planning_orders.forecast_demand`'s values - no side-by-side comparison column, no gradual migration. We're committing directly to the connected data being correct.

## Step 1 — Verify the join is actually clean (read-only check, do this first)

Before changing anything, confirm directly: do `planning_orders` and `demand_weekly_data` use matching SKU and `location_id` values such that a JOIN between them on (sku, location_id, week_number) will work correctly for all 4,160 rows on both sides? Show me the actual query you used and its result - if there's any mismatch (different week numbering conventions, different location_id schemes, missing SKUs on either side), STOP and report back before proceeding to Step 2. Do not attempt to "fix" a mismatch by guessing - report it and we'll decide together.

## Step 2 — Plan the change (explain before building)

Once Step 1 confirms a clean join is possible, explain your exact plan for how `planning_orders.forecast_demand` will be populated/updated from `demand_weekly_data.final_consensus` - e.g. is this a one-time migration script, a change to Supply Planning's seed script, a live query-time join, or something else? Explain the tradeoffs of whatever approach you're proposing (e.g. a live join means Supply Planning always reflects Demand Planning's CURRENT state including any future Apply Scenario writes, but adds query complexity; a one-time copy means simpler queries but goes stale if Demand Planning changes later). Tell me which you recommend and why before building.

## Step 3 — Implement

Implement whichever approach was agreed in Step 2. This should NOT touch Demand Planning's tables/routes/UI at all - this is purely about how Supply Planning sources its demand number going forward.

## Step 4 — Full re-verification (this is the bulk of the real work)

Once forecast_demand reflects real connected data, the downstream numbers WILL change (the whole point of this step) - re-verify each of the following actually still computes correctly given the new input, the same hands-on rigor as the original Supply Planning build:

1. Top KPI bar - Total Demand, Feasible Supply, Supply Gap, Service Level, Revenue at Risk, Inventory Days, Capacity Util, Mat Coverage - all should now reflect real connected numbers. Show me the new values and confirm the math (e.g. Supply Gap = Total Demand - Feasible Supply) still holds.
2. Constraints dashboard (Capacity / Material / Demand Impact) - confirm these recompute correctly against the new demand numbers.
3. Recommendations - confirm recommendation cards (Apply Action) still generate sensibly and the underlying shortage/gap calculations they're based on are using the new connected demand, not stale old numbers.
4. The Planning Grid's Demand row (even though hidden from the UI per our earlier simplification, the underlying data should still be correct) and the Gap row - confirm Gap = Demand - (Inventory + Production) still computes correctly with the new demand source.
5. Confirm the global Reset button still works correctly - resetting Supply Planning's data should re-establish the connection to Demand Planning's CURRENT data, not revert to the old disconnected formula.

## Verification

Give me specific manual browser steps I can run myself for each of the 4 re-verification points above, plus confirm explicitly: which Demand Planning files (if any) were touched (should be none), and which Supply Planning files were touched (expected, but list them explicitly).
