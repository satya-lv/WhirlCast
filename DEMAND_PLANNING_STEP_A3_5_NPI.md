# Demand Planning — Step A.3.5: NPI Forecasting Tab

Read DEMAND_PLANNING_SPEC.md Section 5.5 in full before starting, plus the Phase 0 audit's Section 3 findings on the existing `NPIForecasting.jsx`. Steps A.3.1-A.3.4 are complete and verified (locally and in production). This is the fifth and final tab for Step A.

## What this tab is NOT

This is not a request to rebuild NPI forecasting from scratch. Per the Phase 0 audit's findings, the existing `NPIForecasting.jsx` has a real, working "Renovation" forecasting path (`computePhaseOut()`, `computeRenovBlended()`, the LFL predecessor lookup) - that logic is correct and should be REUSED, not reinvented. The "New Product Innovation" path is the one piece that was confirmed fake (hardcoded `RESULTS` object) - per our earlier decision, that gets replaced with an honest "Coming soon" state, not real logic.

## What to build

Add "NPI Forecasting" as the fifth tab in the Demand Planning workbench.

### 1. Renovation path - reuse real logic
Bring over the working `computePhaseOut()` / `computeRenovBlended()` functions and the LFL (like-for-like predecessor) lookup flow from the existing `NPIForecasting.jsx`. Per the Phase 0 audit, these are self-contained functions with no problematic closure dependencies - confirm this is still true and adapt them to fit this new workbench's shell/styling (consistent with the other 4 tabs), without changing their actual math/logic.

One known issue from the audit to address: the phase-out opening inventory previously came from `SEED_BASE_NPI[cat]` (hardcoded category totals), described as "partially fake." Per spec Section 5.5, decide and tell me explicitly: are you keeping this hardcoded input as-is for now (since the spec didn't explicitly require fixing this part), or replacing it with a real query against `demand_weekly_data`/`forecast_runs` for the predecessor SKU's actual history? State your choice and reasoning before building - don't silently carry forward a "partially fake" input without flagging it.

### 2. New Product Innovation path - "Coming soon"
Replace the fake `RESULTS` rendering block with a clear, honest "Coming soon" state - consistent with how this was already decided in the spec. This should look intentional and professional (not like a broken/missing feature), similar in spirit to how Supply Planning communicates things that are rules-based rather than AI - clear, confident framing rather than an apologetic placeholder.

## Before writing code

Tell me your decision on the phase-out opening inventory question above before building.

## Verification

Give me specific manual browser steps to verify:
1. The Renovation path works end-to-end with real LFL predecessor data and correct phase-out math (same as the original module's working behavior, just in the new shell).
2. The New Product Innovation path clearly shows "Coming soon" - confirm it does NOT display any fake/hardcoded numbers anywhere.
3. Tab switching preserves state correctly, consistent with the other 4 tabs.

Confirm no Supply Planning file was touched.
