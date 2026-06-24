# Persona Login & Navigation Flow

Read PROJECT_BRIEF.md before starting. This wraps the EXISTING app with a new front-end flow - it does not change Demand Planning or Supply Planning's internal functionality, except for adding filter-locking for two specific roles.

## The confirmed flow (not open for redesign)

1. **Login screen**: username + password fields, dummy auth - ANY input is accepted, no real validation. The username typed determines a displayed name (e.g. "satya.srinivas" -> "Satya") and an initial-letter logo (e.g. "S"). No backend auth, no real user table - this is presentation only.

2. **Landing menu**: full-screen, 4 options - Executive Cockpit, Demand Planning, Supply Planning, Admin.
   - Executive Cockpit: show as a clickable option but route to a simple "Coming soon" placeholder - not building this now.
   - Admin: route to whatever existing Admin page/component already exists in this app - reuse it as-is, do not rebuild.
   - Demand Planning / Supply Planning: proceed to step 3.

3. **Role selection** (shown after clicking Demand Planning or Supply Planning): 3 choices -
   - **Demand Planner** (or **Supply Planner** on the supply side): unscoped - this exact role must behave IDENTICALLY to how the app already works today, zero changes, full access, no locked filters.
   - **Branch Manager**: HARDCODED to Mumbai - no dropdown, no selection, always Mumbai regardless of anything. Proceeds to step 4 with this fixed.
   - **Category Manager**: HARDCODED to Air Conditioner category - same idea, always AC, no selection needed.

4. **Landing on the module**: the existing Demand Planning or Supply Planning page loads as it already does today, EXCEPT for scoped roles (Branch Manager / Category Manager):
   - The existing Branch/Location filter (for Branch Manager) or Product Group/Category filter (for Category Manager) must be LOCKED to the hardcoded value (Mumbai or AC respectively) - visually shown as locked/disabled, not just defaulted, and all data/grids/KPIs on that page must actually reflect that locked scope.
   - Other existing filters (ABC/XYZ class, SKU search, etc.) remain fully usable as before - only the ONE matching dimension gets locked.
   - A persistent floating CTA (small, corner-positioned, your call on exact placement) lets the user jump to the OTHER module, carrying the SAME role/scope with them (e.g. a Category Manager/AC user on Demand Planning who clicks the CTA should land on Supply Planning ALSO locked to Category Manager/AC, not reset to unscoped).
   - A visible "Log out / Switch persona" control somewhere in the app's shell (e.g. top bar) that returns the user to the login screen, clearing all persona state.

## State management

- Persona state (role, module, locked scope, display name/initial) lives in memory only (e.g. React context or top-level state) - NOT persisted to localStorage/sessionStorage or any backend. A page refresh should reset back to the login screen - this is intentional, not a bug to fix.
- This state needs to be accessible from both Demand Planning and Supply Planning's existing page components, since both need to know "am I scoped, and to what" in order to lock their respective filters.

## Before writing code

Propose your exact technical approach for:
- Where/how the persona state lives and how both existing pages will read it without major restructuring of either.
- Exactly how the filter-locking mechanism will work in EACH module's existing filter bar (these are two different existing components - show me you've looked at both before proposing one unified approach).
- The routing structure for login -> landing menu -> role selection -> module (e.g. new routes, or state-driven conditional rendering within the existing app shell).

## Verification

Give me manual browser steps to verify:
1. Login accepts any input, displays the correct derived name/initial afterward.
2. All 4 landing menu options are clickable; Executive Cockpit shows a coming-soon state; Admin loads the existing real admin page.
3. Each of the 3 roles, for BOTH modules, lands correctly - Planner roles see full unscoped access exactly as before; Branch Manager is locked to Mumbai; Category Manager is locked to AC - confirm the lock is real (try to change the locked filter, confirm it cannot be changed) not just a visual default.
4. The cross-module floating CTA correctly carries the same role/scope to the other module.
5. Logout/switch-persona correctly returns to login and clears state.
6. Confirm the unscoped Planner role's experience is byte-for-byte identical to today's existing behavior - no regressions.
