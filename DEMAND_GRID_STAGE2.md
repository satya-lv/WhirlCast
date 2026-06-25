# Demand Planning — Stage 2: Model Selection, Recalculate Comparison, Finalize

Read PROJECT_BRIEF.md, DEMAND_PLANNING_SPEC.md, and DEMAND_GRID_STAGE1.md before starting. Stage 1 (new adjustment rows, persona-scoped editing) is complete and verified. This is a separate, different kind of feature - choosing a forecasting algorithm, not editing adjustment data.

## Decided design (final, not open for redesign)

This feature is visible ONLY to the unscoped Demand Planner persona - Branch Manager and Category Manager do not see this at all.

### 1. Model selection dropdown
A dropdown listing 6 named forecasting models: SARIMAX, Exponential Smoothing (Holt-Winters), Moving Average, Croston's Method, Prophet, Linear Regression (Trend-based).

SARIMAX is the current/default model (it's what's already powering the existing System Forecast). Only SARIMAX and Prophet get real, distinct computed forecasts - the other 4 are name-only for this build (selecting them should not crash or error, but also should not be expected to produce a meaningfully different real forecast; your call on simplest reasonable behavior - e.g. could just reuse the SARIMAX calculation as a placeholder, or show a "not yet implemented" indicator - explain your choice).

### 2. Recalculate - shows comparison, does NOT commit
Clicking "Recalculate" after selecting a model runs that model's forecast calculation for the current grid scope (whatever SKU/location/week filter is active) and displays a side-by-side comparison: current System Forecast vs. the newly calculated model's forecast, with the difference (units and/or %) clearly shown. This does NOT change any stored data - it's a preview only, similar in spirit to how Supply Planning's Scenario Compare works (look at that existing pattern for UI/interaction inspiration, reuse what fits).

### 3. Finalize - the deliberate commit action
Only after viewing a Recalculate comparison, a separate "Finalize" action becomes available, which actually overwrites the stored System Forecast values with the new model's calculated numbers for the current scope. This should feel like a deliberate, separate step from Recalculate - not something that happens accidentally.

### 4. The Prophet calculation
Needs to be a genuinely different, real calculation from SARIMAX - not just SARIMAX's numbers relabeled. Propose a reasonably realistic, simplified implementation of Prophet's actual approach (it decomposes a time series into trend + seasonality + holiday effects) - doesn't need to be a full production-grade implementation, but should produce genuinely different, defensible numbers from SARIMAX for the same data, the same honesty standard used for every other piece of "real but simplified" logic in this project.

## Before writing code

Explain your plan for:
1. Where this UI lives (likely near the existing filter bar, visible only for Demand Planner persona).
2. The exact Prophet-style calculation you're proposing, with reasoning - I want to review the math before it's built, the same as every other new calculation in this project.
3. What happens to the 4 name-only models when selected - confirm your chosen behavior.
4. The exact API endpoint(s) needed (e.g. a recalculate endpoint that's read-only/preview, a separate finalize endpoint that writes).

## Verification

Give me manual browser steps to verify:
1. Only Demand Planner sees this feature; Branch Manager and Category Manager do not.
2. Selecting SARIMAX and clicking Recalculate shows the comparison with SARIMAX's numbers matching the current System Forecast (since SARIMAX IS the current model - should show no difference, confirming the baseline comparison is honest).
3. Selecting Prophet and clicking Recalculate shows a comparison with genuinely different numbers from System Forecast - confirm by hand-checking the math for one row against your stated Prophet calculation approach.
4. Recalculate does NOT change stored data - confirm by checking the database/grid before and after clicking Recalculate (numbers should be identical until Finalize is clicked).
5. Finalize correctly commits the Prophet numbers into System Forecast - confirm the grid reflects the change, and confirm Final Consensus recalculates correctly afterward (System Forecast + the 3 adjustment rows).
6. Selecting one of the 4 name-only models behaves reasonably (no crash) per whatever behavior was decided.
7. Confirm no regressions to Stage 1's persona-scoped editing or anything else previously verified.
