# Combined Batch — Labels, Export, Model List, Restored Tabs

Read PROJECT_BRIEF.md, DEMAND_PLANNING_SPEC.md, DEMAND_GRID_STAGE1.md, and DEMAND_GRID_STAGE2.md before starting. This is a combined batch of 7 distinct, already-decided items across both modules. Work through them in the order listed - each is independently scoped, confirm each works before moving to the next, but you do not need to stop and ask before each one - all decisions below are final.

## Item 1 — Relabel "week"/"W" to "month"/"M" everywhere (COSMETIC ONLY)

This is a presentation-layer rename only - the underlying data stays weekly (52 weeks), nothing about the data structure, grain, or storage changes. Find every place "week"/"W"/"Wk" appears as user-facing text in BOTH Demand Planning and Supply Planning (the same places we already converted to relative labels like "Current Week"/"Week +N" in an earlier session - e.g. toRelWeek() and any equivalent in Supply Planning) and change the letter/word from week-based to month-based: e.g. "Current Week" -> "Current Month" or similar, "Week +N" -> "M+N" or similar - your call on the exact short-form abbreviation, but be CONSISTENT with whatever convention you pick across both modules. Show me the full list of places changed.

## Item 2 — Grid download (Excel + CSV) and a non-functional Upload button

Add Download and Upload buttons/icons near the Forecast Grid (Demand Planning) and Planning Grid (Supply Planning).

Download: clicking it offers a choice between Excel (.xlsx) and CSV format (your call on exact UI - e.g. a small dropdown/menu). Exports EXACTLY what's currently visible/filtered in the grid (respecting any active filters, including a locked persona's scope) - not the full unfiltered dataset. Use a simple, real library for this (e.g. SheetJS/xlsx for Excel; CSV can be generated with simple string building, no library needed).

Upload: clicking it opens a real native file picker (standard browser file input), but selecting a file should do nothing afterward - no upload, no processing, no error. This needs to look and feel like a real, functional button (so it doesn't look broken if clicked during a demo) while genuinely not performing any action beyond opening the picker.

## Item 3 — Rename "Stable" to "Intermittent" in Patterns classification

In Demand Planning's Patterns tab, the 4-category classification (Trend/Seasonal/Stable/Random) - rename "Stable" to "Intermittent" everywhere it appears (bar chart label, any tooltips, any table values). Same underlying logic/data - label change only.

## Item 4 — Expand the model selection dropdown to 12 models

Replace the current 6-model list with this 12-model list: ARIMAX/SARIMAX, Prophet, VAR/VARMAX, GARCH, LSTM, Encoder-Decoder, Multi-Linear Regression, Decision Trees, Random Forest, Boosting-XGB, SVM, ANN.

SARIMAX and Prophet keep their existing REAL computed logic exactly as already built (no changes to the math). The other 10 models (including the original 4 placeholders, now folded into this longer list) all use the same honest placeholder behavior already built: return the current SARIMAX-baseline values, clearly labeled as not yet differentiated.

Default selection display: the default/baseline model option should be LABELED "Auto Selected" in the dropdown (not "SARIMAX") - this is a display label change only; it still actually runs the real SARIMAX calculation under the hood, just presented with this name as the default choice.

## Item 5 — Fix Exceptions to only show current/future periods

Demand Planning's Exceptions tab currently shows exceptions referencing past/locked periods (before week 24). Apply the same current/future boundary already used elsewhere (week >= 24) so exceptions referencing locked/historical weeks are excluded - only show exceptions relevant to the current/actionable planning window.

## Item 6 — Add Demand Sensing back as a 6th Demand Planning sidebar tab

Find the OLD Demand Sensing component/page (from before the persona/workbench rebuild - check the original sidebar navigation items list, likely still present in the codebase even if not currently linked into the new Demand Planning workbench). Add it as a 6th tab in Demand Planning's sidebar (alongside Forecast Grid, Patterns, What-If, Exceptions, NPI Forecasting) - reuse the OLD component/logic AS-IS, no rebuilding, just re-wire it into the new sidebar-driven tab navigation (the same activeView mechanism the other 5 tabs use).

## Item 7 — Restore the OLD fake/hardcoded "New Product Innovation" path

In the NPI Forecasting tab, the "New Product Innovation" option currently shows a deliberate "Coming soon" placeholder (built earlier specifically because the old logic was confirmed fake/hardcoded). Per explicit instruction, REVERT this specific piece back to the OLD hardcoded RESULTS object behavior from before - the user has explicitly chosen to use the fake numbers as-is for demo purposes, fully aware they are not real calculations. Do not add any disclaimer text or "not real" labeling - just restore the original behavior exactly as it was before the "Coming soon" change.

## Verification

For each of the 7 items, give me specific manual browser steps to verify. Also confirm: no regressions to anything previously verified (persona scoping, the Stage 1/2 grid features, Supply Planning's What-If, etc.) - run a quick sweep across both modules' core functionality after all 7 items are built.

Run the actual CI=true npm run build check locally and confirm a clean build with zero errors before telling me this is ready - we have hit CI build failures multiple times this session from leftover unused imports/hooks, do not skip this step.
