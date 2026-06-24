# Sidebar Refinement — Bigger Tab Tiles + Clickable Logo

Builds on the just-completed navigation cleanup (module-scoped sidebar tabs). Two small but important polish items.

## Item 1 — Bigger, more professional sidebar tab tiles

The current sidebar tab items (Forecast Grid, Patterns, What-If, etc. / Planning Grid, Constraints, etc.) feel small/cramped. Redesign them to feel more substantial and professional:
- More generous padding/spacing around each tab item - larger click target, more breathing room.
- A subtle hover state (slight background highlight or lift) and a clear active/selected state distinct from hover.
- Clean, card-like visual treatment - not flashy or decorative, just more comfortable and intentional-feeling than the current cramped list style.
- Keep using the same icons/labels already in place - this is a spacing/visual-weight change, not a content change.

Apply this consistently to both Demand Planning's 5-tab sidebar and Supply Planning's 4-tab sidebar.

## Item 2 — Clickable WhirlCast logo returns to login

The WhirlCast logo/wordmark in the top-left of the sidebar should become clickable. Clicking it should immediately (no confirmation dialog) clear persona state and navigate back to /login - functionally the same end result as the existing "Switch persona" link, just a second, more discoverable way to get there via the logo, behaving like a "go home/restart" action common in most real apps.

## Verification

Give me manual browser steps to verify:
1. Sidebar tabs in both modules now look and feel larger/more spacious, with a visible hover and a distinct active state.
2. Clicking the WhirlCast logo from anywhere in the app (either module, any persona) immediately returns to /login with persona state cleared - confirm by checking that navigating back to a module URL directly afterward redirects to login (same check used for the existing logout flow).
3. Confirm no regressions to the existing "Switch persona" link, persona scoping, or cross-module CTA.
