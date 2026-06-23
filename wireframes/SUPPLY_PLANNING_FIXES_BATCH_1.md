# Supply Planning — Fixes & Enhancements Batch (Post Step 3.6)

Read PROJECT_BRIEF.md and SUPPLY_PLANNING_SPEC.md before starting.

This is a combined batch covering one confirmed bug and three feature requests, found during hands-on testing of the Scenarios and Recommendations tabs. Treat each item as its own clearly-scoped change — confirm each works before moving to the next, and report on each separately at the end.

---

## Item 1 (BUG) — "Activate in Grid" button missing on non-baseline scenarios

**What's wrong:** When a new scenario is created (e.g. "Pune Ac" with action type Add Overtime), it appears in the Supply Scenarios list correctly labeled `draft`, but there is no visible "Activate in Grid" button or equivalent control anywhere on the card or page to actually switch into editing that scenario. The amber banner on the Compare screen explicitly tells the user to "Select a new scenario in the library, click 'Activate in Grid'" — but this control does not currently render anywhere.

**What to do:** Find where this button was intended to live (check the original Step 3.6 implementation) and fix whatever is preventing it from rendering — this could be a conditional rendering bug, a missing prop, a CSS visibility issue, or a regression from a later change. Once fixed, verify end-to-end: create a new scenario, activate it via this button, confirm it switches the active scenario context and navigates to (or enables editing on) the Planning Grid.

---

## Item 2 — Add a "Delete Scenario" action

**What to build:** A way to permanently delete a non-baseline scenario from the Supply Scenarios list (Baseline Plan itself should NOT be deletable — block this with a clear message if attempted).

**Required behavior:**
- A delete control (icon button or similar) on each non-baseline scenario card.
- Clicking it shows a confirmation prompt (e.g. "Delete 'Pune Ac'? This cannot be undone.") before anything happens — no immediate deletion on first click.
- On confirmation, the scenario and all its associated planning order edits are permanently removed from the database, and the list updates immediately.

---

## Item 3 — Add an "Apply" CTA directly on Recommendation cards

**What to build:** Each card in the Recommendations tab should get an "Apply" button (or one per recommended action, if a card lists 2 actions) that, when clicked, directly executes that recommendation's underlying action — the same way the Planning Grid's Actions panel would (e.g. if the recommendation is "Pull ahead 122 units from week 20 to week 18," clicking Apply should actually move those units, exactly as if the planner had done it manually via the Actions panel).

**Required behavior:**
- Use the same 3-state pattern (idle → loading → done) already established for actions elsewhere in the app.
- After applying, the recommendation card for that specific issue should disappear from the list (since the underlying shortage/constraint it was responding to should now be resolved) — consistent with how the system already behaves when an action is applied manually (confirmed working in Step 3.5 testing).
- After applying, the top KPI bar AND the Planning Grid AND the Constraints tab must all reflect the change — verify this explicitly, not just the Recommendations list itself.
- If a recommendation's action type isn't safely automatable for any technical reason, say so explicitly rather than building a fake/partial version of it — flag it for discussion instead.

---

## Item 4 — Verification: confirm cross-screen KPI consistency (not a new build)

**What to check:** When a number is edited directly in the Planning Grid (e.g. double-clicking a Planned Production cell), confirm that:
1. The top KPI bar updates correctly (already partially confirmed in Step 3.4 testing, but re-verify).
2. The Constraints tab (Capacity/Material/Demand Impact) reflects the same change if relevant.
3. The Recommendations tab reflects the same change if relevant (e.g. a resolved shortage should remove or update the corresponding card).

Report any place where an edit does NOT propagate correctly — this is a consistency audit, not new functionality, but any gap found should be fixed as part of this batch.

---

## Item 5 — Add a global "Reset Supply Planning Data" control

**What to build:** A button (suggest placing it near the existing Scenarios list or in a settings/utility area — your call, but make it clearly separated from normal actions given its destructive nature) that resets the ENTIRE Supply Planning dataset back to its original seeded state from Step 3.1 — wiping all scenarios (except restoring Baseline to its original unedited state), all manual grid edits, all applied actions/recommendations.

**Required behavior:**
- A clear confirmation step before resetting (e.g. "This will permanently erase all scenarios and changes and restore the original demo dataset. Continue?").
- After confirming, the underlying data should match exactly what Step 3.1's seed script originally produced (re-running the seed script, or restoring from a saved snapshot, are both acceptable approaches — your call on which is cleaner given the existing codebase).
- After reset, reload the Workbench and confirm the KPI bar shows the original baseline numbers (Total Demand 1,98,507 / Service Level ~80.9% / etc., matching what was confirmed in Step 3.4-3.6 testing) and that Baseline Plan is again the only scenario in the list.

---

## Not in scope for this batch (logged for later)

The user plans to eventually align Demand Planning's dataset with Supply Planning's, so that an edit in one module could affect the other. This is explicitly future work, dependent on the Step 3.7 cross-module consistency findings, and should NOT be attempted as part of this batch.

---

Report back on each of the 5 items separately: what was wrong/built, what file(s) changed, and how you verified it (include a manual test I can repeat myself for each item).
