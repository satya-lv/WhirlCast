# Demo Logic & Consistency Pass — Both Modules

This is a combined batch fixing real logical inconsistencies found during a pre-demo review, plus a genuine audit for anything else of the same character. Read PROJECT_BRIEF.md, SUPPLY_PLANNING_SPEC.md, and DEMAND_PLANNING_SPEC.md before starting. This touches BOTH modules - treat each change with the same care as prior work in this project (explain before building where noted, verify after).

## Decided changes (not open for reinterpretation)

### 1. No literal dates/weeks in user-facing UI - use relative language
Replace any UI text showing literal dates (e.g. "Jun 2026") or raw week numbers visible to the end user (e.g. "Week 27") with relative language: "Current Week", "Next 4 Weeks", "This Month", etc. This applies across BOTH Demand Planning and Supply Planning. Internal code/data can still use actual week_number integers - this is a presentation-layer change only, find every place a date or week number is rendered as user-facing text and replace it. Show me the full list of places you changed before considering this done.

### 2. Unified single past/current boundary - both modules
Both modules currently have inconsistent or unclear logic for "what counts as past vs. current/future":
- Demand Planning's Forecast Grid currently shows Actual Sales for ALL 52 weeks, including future weeks, which is logically wrong (a future week cannot have an actual outcome yet).
- Supply Planning's grid currently has no past/future distinction at all - any week is equally editable, including ones that have already happened.

**Fix to one consistent rule, applied to BOTH modules**: weeks 1-23 = past/locked (read-only, "Show History" toggle to reveal, hidden by default). Week 24 onward = current/future (open, editable, the default view).

For Demand Planning specifically: when the grid defaults to showing week 24 onward, the Actual Sales row should show a dash for week 24+ since those are future/current weeks without a real outcome yet - do NOT show fabricated "actual" numbers for weeks that haven't happened. Only weeks 1-23 (behind the Show History toggle) should show real Actual Sales numbers.

For Supply Planning specifically: weeks 1-23 become read-only/locked (no editing Planned Production, etc. for those weeks anymore) - this is a NEW restriction, since Supply Planning never had this protection before. Week 24+ remains editable as it currently is.

### 3. Remove Acknowledge CTA from Demand Planning's Exceptions tab
The Acknowledge button/action on Exceptions cards should be removed entirely - exceptions should not be dismissible with a single click with no real consequence (unlike Supply Planning's Recommendations, where Approve actually writes a real change). Just remove the button and the underlying acknowledge wiring; the exception list itself stays as a read-only view of current issues.

## Audit task (read-only investigation, report back before fixing)

Beyond the 3 items above, do a genuine audit pass across BOTH modules looking for this SAME CLASS of problem: places where the UI or underlying logic makes a claim that doesn't actually hold up logically. Specifically check:

1. Does Supply Planning's top KPI bar (or any KPI) silently include locked/historical weeks (1-23) in totals that should arguably only reflect the actionable current+future range, or is this intentional and fine?
2. Is there a "current week" indicator anywhere in either module, and if so, is it consistent (same week number/date) between Demand Planning and Supply Planning, or could they show two different "current" values?
3. Do any Recommendation cards (Supply Planning) or Exception cards (Demand Planning) ever reference a week number that falls in the now-locked 1-23 range - which would be nonsensical (recommending an action for a week that's already locked/in the past)?
4. Any other place where a "before/after" comparison, a forecast, or a KPI implicitly assumes something about time that the new locked-week boundary would now contradict.

Report findings from the audit BEFORE fixing anything beyond items 1-3 above - I want to review what's found and decide what's worth fixing versus what's a non-issue, the same way we've handled every other audit in this project.

## Verification

For items 1-3 (the decided changes):
1. Confirm no raw dates/week numbers appear in user-facing text anywhere you checked.
2. Demand Planning: confirm the grid defaults to week 24+ view, Actual Sales shows blank for those weeks, and the Show History toggle correctly reveals weeks 1-23 with real Actual Sales data when clicked.
3. Supply Planning: confirm weeks 1-23 are now read-only (attempting to edit a cell there should not work), and week 24+ remains editable exactly as before.
4. Confirm the Acknowledge button is gone from Demand Planning's Exceptions cards.
5. Confirm no regressions in either module's existing functionality.

For the audit: a clear written report of findings, no code changes beyond what's explicitly decided above.
