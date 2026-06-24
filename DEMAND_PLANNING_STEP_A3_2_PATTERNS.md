# Demand Planning — Step A.3.2: Patterns Tab

Read DEMAND_PLANNING_SPEC.md Section 5.2 in full, plus the Step A.2 discussion/resolution on the "Option B" classification distribution decision, before starting. Step A.3.1 (workbench shell + Forecast Grid) is complete and verified - this step adds the Patterns tab into that same shell.

## Important: two genuinely different classification systems

This tab surfaces TWO separate things that must stay visually distinct, not blurred together:
1. **ABC/XYZ** (from Step A.1/A.2) — volume/variability classification, computed per-SKU (not per-location), stored on `product_master`.
2. **Trend/Seasonal/Stable/Random** (the Option B classification, also from Step A.2) — a DIFFERENT dimension, the pattern-type bar chart.

Do not let these two get confused in the UI - e.g. don't label something "Classification" ambiguously when there are two different classifications on screen. Be explicit (e.g. "ABC/XYZ Class" vs. "Pattern Type") so it's clear to a viewer these are answering different questions.

## What to build

Add "Patterns" as the second working tab in the Demand Planning workbench (alongside Forecast Grid). Three pieces, per spec Section 5.2:

### 1. Classification distribution (bar chart)
The Trend/Seasonal/Stable/Random counts from the Option B logic. Per our earlier discussion, Trend and Random will currently show as 0 - render this honestly (an empty/zero bar is fine and expected), do not hide or fake non-zero values.

### 2. Volume × variability scatter
One point per SKU (not per SKU-location, since ABC/XYZ is per-SKU) - x-axis = volume, y-axis = CoV. Use whatever charting approach Supply Planning already uses elsewhere in the app for consistency (check what library/pattern is already in use before introducing a new one).

### 3. SKU-level detail table
One row per SKU-location (volume/demand numbers differ by location), but the ABC/XYZ classification badge shown is the per-SKU value - so if AC_1.5T_Inverter appears in 8 location rows, all 8 show the same "A/Y" badge, per the spec's resolved per-SKU grain decision. Include whatever columns make sense from the `/api/demand-planning/patterns` endpoint (CoV, volume, recommended strategy if that exists in the API response - check what's actually available before assuming).

## Before writing code

Confirm what charting library/pattern is already used elsewhere in this app (Supply Planning or the original Demand Planning pages) and reuse it - tell me what you found before building.

## Verification

Give me specific manual browser steps to verify:
1. The bar chart renders with real counts (confirm Trend=0 and Random=0 currently, Seasonal and Stable non-zero, matching Step A.2's verified numbers).
2. The scatter plot renders 10 points (one per SKU, not 80), positioned sensibly (AC SKUs should be visually distinct given their higher volume + higher CoV).
3. The detail table shows one row per SKU-location (80 rows) but identical ABC/XYZ badges across all of a given SKU's rows.
4. Switching to this tab doesn't lose the Forecast Grid's state (filters, scroll position) when you switch back - confirm tabs behave independently, same as Supply Planning's tab pattern.

Confirm no Supply Planning file was touched.
