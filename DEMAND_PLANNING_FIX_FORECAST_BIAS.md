# Demand Planning — Fix: Allow Genuine Under-Forecasting in Seed Data

## The problem

In `seed_demand.js`, the forecast error formula:

```js
const fcastError = Math.min(1.30, Math.max(0.70, 0.88 + pseudoRand(fcastSeed) * errorRange));
```

Given `pseudoRand()` returns [0.85, 1.15] and `errorRange` is 0.27 or 0.40, the minimum possible value of `0.88 + pseudoRand(fcastSeed) * errorRange` is `0.88 + 0.85 × 0.27 = 1.110` — always above 1.0. This means `fcastError` can NEVER go below 1.0, so EVERY row over-forecasts (forecast > actual) with mathematical certainty. The `Math.max(0.70, ...)` lower clamp is dead code, unreachable given the actual range of inputs.

This was confirmed as an accident, not the intended design - the goal was "mostly over-forecasts, realistic planning bias," not "100% over-forecasts with zero exceptions, by mathematical guarantee."

## What to fix

Adjust the formula so:
1. The OVERALL average bias should still be meaningfully positive (over-forecasting should still be the dominant pattern - keep the general "systematic over-forecast" demo narrative).
2. But individual rows should be able to genuinely land below 1.0 (under-forecast) sometimes - a realistic minority of weeks, not a majority. Something like 15-25% of rows under-forecasting would be realistic for a "systematically over-forecasting but not perfectly so" system.
3. The same general principle from before should still hold: seasonal extreme weeks (AC peaks/troughs) should have wider error ranges than normal weeks, since forecasting is genuinely harder during seasonal extremes.

You have discretion on the exact new formula/constants - explain your reasoning for whatever you choose, the same way the original constants were explained.

## After fixing

1. Re-run the seed (or whatever the correct way to regenerate `demand_weekly_data` is, given Step A.1's reset/recalculate infrastructure).
2. Re-run the KPI endpoint and show me the new Accuracy % and Bias % values.
3. Confirm explicitly: do we still see `Accuracy + Bias = 100%` exactly, or does it now differ slightly (it SHOULD differ now, even if only by a little, since that exact equality was a direct symptom of the bug - if it's still exactly 100%, the fix didn't actually work)?
4. Show me the new over-forecast vs under-forecast row split (e g. "X% of rows over-forecast, Y% under-forecast") so we can confirm it's now a realistic minority/majority split, not all-or-nothing.
5. Confirm the `demand_exceptions` table's `accuracy_degradation` rows still make sense against the new data (re-run if needed) - the AC SKUs should likely still show up there, but check the numbers updated correctly rather than reporting Step A.1's stale results.

This is a data-quality fix only - no schema changes, no API contract changes. The shape of everything stays the same, only the actual generated numbers change.
