# Demand Planning — Step A.3.4: What-If Tab

Read DEMAND_PLANNING_SPEC.md Section 5.3 in full before starting. Steps A.3.1-A.3.3 are complete and verified. This tab is different from the previous three: it requires genuinely NEW simulation logic, not just display of existing Step A.1/A.2 data. No existing endpoint covers this - a new endpoint is needed.

## The simulation model (decided, not your call to redesign)

Three inputs, one SKU-location selector:

1. **Promotion discount** (0-50% slider): drives an independent, explicitly-stated volume lift assumption - roughly 10% discount → 15-20% volume lift (state your exact chosen formula clearly in both the code comments and the UI itself, the same way the original reference material stated "price elasticity -2, typical range -1.5 to -2.5" visibly on screen, not hidden).
2. **Price change** (-20% to +20% slider): uses price elasticity of -2.0 (a 1% price drop → ~2% volume increase, and vice versa for price increases). This is a real, citable elasticity figure for durable appliances - state it visibly in the UI.
3. **Marketing spend multiplier** (0.5x-2.0x slider, default 1.0x): multiplies whatever lift the promotion discount produces. At 0% promotion discount, this slider has NO effect - add a small, clear UI note explaining this dependency (e.g. "Marketing spend affects promotion impact - has no effect without an active discount") so it doesn't look broken when a planner moves it with no discount set.

Combine these into a single forward-week volume/revenue impact, compared against the base forecast (System Forecast / Final Consensus from `demand_weekly_data`), for whichever SKU-location is selected.

## What to build

### New backend endpoint
e.g. `POST /api/demand-planning/whatif` - takes a SKU, location, and the 3 slider values, returns volume impact and revenue impact for the forward weeks (the same editable week range as the Forecast Grid), plus the comparison chart data (base forecast vs scenario forecast per week).

### Frontend tab
- SKU-location selector (consistent with how other tabs let you pick a SKU/location).
- The 3 sliders, each showing its current value AND the stated assumption next to it - same "show your work" honesty principle used throughout this app (e.g. Supply Planning's "this is rules-based, not AI" framing).
- A results panel: Volume Impact and Revenue Impact numbers (delta vs base), plus a chart comparing Base Forecast vs Scenario Forecast across the forward weeks - similar in spirit to the reference screenshot's line chart, using whatever charting approach Patterns tab already established (Recharts).
- A "Reset to base forecast" action that zeros all 3 sliders back to neutral (0% discount, 0% price change, 1.0x marketing).
- When all sliders are at neutral/default, the panel should clearly indicate "No scenario applied" rather than showing a misleading 0%-everything result as if it were a real calculation - consistent with the reference's "No scenario applied — adjust a slider to see the forecast diverge from base" framing.

## Before writing code

Show me your planned endpoint request/response shape and confirm your exact formula for combining the 3 inputs into a final volume impact number, before implementing - I want to check the math makes sense before it's built, the same review step used for every other piece of new logic in this build.

## Verification

Give me specific manual browser steps to verify:
1. With all sliders at default, the panel shows "No scenario applied" (not a fake zero-result).
2. Moving the Price Change slider alone (discount and marketing at default) produces a believable inverse volume change (price down = volume up, price up = volume down), consistent with -2.0 elasticity.
3. Moving Promotion Discount alone produces a lift in the stated 15-20%-per-10%-discount range.
4. With Promotion Discount > 0%, moving Marketing Spend changes the result. With Promotion Discount = 0%, moving Marketing Spend does NOT change the result (confirm the UI note explaining this is visible).
5. The chart updates to show the scenario line diverging from the base line as sliders move.
6. "Reset to base forecast" returns everything to neutral and back to "No scenario applied."

Confirm no Supply Planning file was touched.
