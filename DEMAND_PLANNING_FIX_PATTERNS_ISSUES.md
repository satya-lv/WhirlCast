# Demand Planning — Fix: Patterns Tab Issues (2 items)

Found during manual verification of Step A.3.2.

## Issue 1 — Filters don't affect the Patterns tab

The top filter bar (Branch/Location, Product Group, SKU search, ABC/XYZ class) correctly narrows the Forecast Grid, but selecting a filter (e.g. Product Group = "Air Conditioner") does NOT change what's shown on the Patterns tab - the bar chart, scatter, and table all keep showing all 10 SKUs regardless of the filter selection.

**Fix**: the Patterns tab's data fetch needs to actually pass the current filter state to the `/api/demand-planning/patterns` endpoint (the same filter state object already being used for the Forecast Grid fetch), and re-fetch when filters change - the same reactive pattern the Forecast Grid already uses correctly. Check whether the `/patterns` endpoint itself even accepts filter query params yet - if it doesn't, that needs to be added too (check Step A.2's actual implementation, don't assume).

## Issue 2 — Scatter chart: x-axis label overlaps the legend

In the "Volume × Variability" scatter chart, the x-axis label ("Annual Volume (units)") visually overlaps with the chart's legend ("A-class / B-class / C-class") - both are rendering in the same space at the bottom of the chart, making both illegible. See attached description: the legend text and axis label are layered on top of each other.

**Fix**: adjust the chart's layout (e.g. Recharts margin/height settings, or repositioning the legend to the side/top instead of the bottom) so the x-axis label and legend have clear separate space and neither overlaps the other. Test at the actual screen width this will typically be viewed at, not just a quick glance.

## Verification

1. Select Product Group = "Air Conditioner" in the filter bar. Confirm the Patterns bar chart, scatter, and table all update to reflect only AC SKUs (e.g. the scatter should now show only 2 points, the table only 16 rows for AC's 8 locations × 2 SKUs).
2. Clear the filter, confirm everything returns to showing all 10 SKUs / 80 rows.
3. Look at the scatter chart's legend and x-axis label - confirm they are now both fully readable with no overlapping text.
4. Confirm this didn't break anything from Step A.3.1 (Forecast Grid filtering should still work exactly as before) or Step A.3.2's other verified behavior (bar chart zero bars, 80-row table, per-SKU badge consistency).
