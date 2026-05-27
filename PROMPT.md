# DemandIQ — Complete Build Prompt for Claude Code
# Whirlpool India Demand Planning Tool
# Demo Date: 19-20 May 2026

---

## PRIORITY INSTRUCTIONS — READ FIRST

This is a demo application for Whirlpool India, a major enterprise client, presenting on 19th May 2026. Visual quality is as important as functionality. Do not use placeholder styling. Every screen must look production-ready and impressive. The goal is to make the client say "we want this" in the first 5 minutes.

Build in this exact order and do not move to the next step until the current one is complete:
1. package.json + project structure
2. SQLite database + all seed data
3. All backend API routes
4. Design system + shared components (India map, charts, tables)
5. Login screen
6. Dashboard + India map
7. Forecast Workbench
8. Forecast Selection / Scenario Comparison
9. Collaboration Suite
10. Override Conflicts
11. Demand Sensing (with Claude API integration)
12. NPI Forecasting
13. Forecasting Report
14. Admin Console
15. Mobile responsive pass on all screens
16. Wire up all navigation, role-based routing, and data flow end to end

Reference images are in the /wireframes folder. These show the EXISTING Figma design. Match the information architecture and data shown, but dramatically upgrade the visual design — same structure, completely new visual treatment.

---

## TECH STACK

- Frontend: React 18 with Tailwind CSS, Recharts for all charts, React-Leaflet for India map
- Backend: Node.js + Express REST API
- Database: SQLite with better-sqlite3
- File uploads: multer
- AI feature: Anthropic Claude API (model: claude-sonnet-4-20250514) for Demand Sensing
- Icons: Lucide React
- Fonts: Inter (Google Fonts)
- Mobile: fully responsive, every screen works perfectly at 375px width
- App name: DemandIQ
- Client branding: Whirlpool India | Powered by DecisionPoint

---

## DESIGN LANGUAGE — NON-NEGOTIABLE VISUAL REQUIREMENTS

Colors:
- Primary: #1B3A6B (Whirlpool dark navy)
- Accent: #E31837 (Whirlpool red)
- Background: #F4F6FA (light grey page background)
- Card background: #FFFFFF
- Success: #16A34A
- Warning: #D97706
- Error: #DC2626
- Text primary: #1A1A2E
- Text secondary: #6B7280

Typography:
- Font: Inter (import from Google Fonts)
- Hero numbers: 32px bold
- Section headers: 18px semibold
- Table headers: 13px uppercase tracking-wide
- Body: 14px regular

Cards:
- border-radius: 12px
- box-shadow: 0 2px 12px rgba(0,0,0,0.08)
- padding: 24px desktop, 16px mobile
- white background

VISUAL QUALITY REQUIREMENTS (these make the difference between good and impressive):

1. Every Recharts chart must have:
   - Gradient fills using linearGradient SVG defs (fillOpacity 0.8 at top, 0.1 at bottom)
   - Smooth curve interpolation: type="monotone"
   - Animated on load: isAnimationActive={true} animationDuration={800}
   - Custom styled tooltips: white background, 8px border-radius, box-shadow, navy border-left
   - No default grey Recharts borders — use CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0"
   - Proper axis labels and tick formatting

2. KPI cards must have:
   - 4px left border in the primary/accent color
   - Metric number in 32px bold
   - Trend arrow as a colored pill badge (green background for positive, red for negative)
   - A mini sparkline chart (Recharts Sparkline or small LineChart) inside each card
   - Subtle icon in top-right corner

3. India map markers:
   - Custom circle markers with pulsing CSS animation for alert/conflict status
   - Glow effect using box-shadow in the status color
   - Popup on click with branch stats
   - Tooltip on hover with branch name

4. Tables:
   - Hover row highlight (#F8FAFF)
   - First column sticky with font-weight 500
   - Status values as colored pill badges, never plain text
   - Sortable column headers with sort arrow indicators
   - Alternating subtle row colors
   - Sticky header on scroll

5. Micro-animations:
   - Page cards fade up on load: CSS animation fadeInUp 0.3s ease
   - Sidebar slides in from left on mobile
   - Buttons have hover lift: transform translateY(-1px) + increased shadow
   - Tab transitions: smooth 200ms ease
   - Modal appears with scale(0.95) to scale(1) animation

6. Demand Sensing specific:
   - Upload zone: animated dashed border on hover/drag-over
   - Processing state: spinning gradient ring animation
   - Insight cards slide in from right after processing with staggered delay

7. Mobile bottom nav:
   - Active tab: colored pill background behind icon+label
   - Smooth transition animation between tabs
   - Safe area padding for iOS

---

## PROJECT STRUCTURE

```
demandiq/
├── client/                 (React frontend)
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── shared/     (IndiaMap, KPICard, DataTable, Toast, Modal)
│   │   │   ├── layout/     (Navbar, MobileNav, Sidebar)
│   │   │   └── charts/     (ForecastChart, AccuracyChart, CategoryDonut)
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ForecastWorkbench.jsx
│   │   │   ├── ForecastSelection.jsx
│   │   │   ├── CollaborationSuite.jsx
│   │   │   ├── OverrideConflicts.jsx
│   │   │   ├── DemandSensing.jsx
│   │   │   ├── NPIForecasting.jsx
│   │   │   ├── ForecastingReport.jsx
│   │   │   └── AdminConsole.jsx
│   │   ├── context/        (AuthContext, CycleContext)
│   │   ├── hooks/
│   │   └── App.jsx
│   └── package.json
├── server/                 (Node.js backend)
│   ├── db/
│   │   ├── schema.js
│   │   ├── seed.js
│   │   └── demandiq.db
│   ├── routes/
│   ├── middleware/
│   └── index.js
├── wireframes/             (reference images — do not use in production build)
└── README.md
```

---

## DATABASE SCHEMA

Create SQLite DB at server/db/demandiq.db:

```sql
CREATE TABLE IF NOT EXISTS forecast_cycles (
  cycle_id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'in_progress',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME
);

CREATE TABLE IF NOT EXISTS forecast_runs (
  run_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  scenario_id INTEGER,
  branch TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT,
  month TEXT NOT NULL,
  value INTEGER NOT NULL,
  algorithm TEXT DEFAULT 'SARIMAX',
  is_npi INTEGER DEFAULT 0,
  demand_sensing_adjusted INTEGER DEFAULT 0,
  FOREIGN KEY (cycle_id) REFERENCES forecast_cycles(cycle_id)
);

CREATE TABLE IF NOT EXISTS forecast_scenarios (
  scenario_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  algorithm_mix TEXT,
  accuracy REAL,
  bias REAL,
  revenue REAL,
  total_units INTEGER,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finalized_at DATETIME,
  FOREIGN KEY (cycle_id) REFERENCES forecast_cycles(cycle_id)
);

CREATE TABLE IF NOT EXISTS branch_overrides (
  override_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL,
  branch TEXT NOT NULL,
  sku TEXT NOT NULL,
  month TEXT NOT NULL,
  ai_forecast INTEGER NOT NULL,
  override_value INTEGER,
  reason TEXT,
  override_by TEXT,
  override_on DATETIME,
  override_version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  final_override INTEGER,
  FOREIGN KEY (cycle_id) REFERENCES forecast_cycles(cycle_id)
);

CREATE TABLE IF NOT EXISTS demand_sensing_log (
  log_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER,
  filename TEXT,
  file_type TEXT,
  insights_json TEXT,
  adjustments_json TEXT,
  applied INTEGER DEFAULT 0,
  applied_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exception_log (
  exception_id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER,
  branch TEXT,
  sku TEXT,
  exception_type TEXT,
  original_value INTEGER,
  corrected_value INTEGER,
  acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_master (
  sku TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  segment TEXT,
  subsegment TEXT,
  price INTEGER,
  star_rating INTEGER,
  active INTEGER DEFAULT 1,
  launch_date TEXT
);

CREATE TABLE IF NOT EXISTS lfl_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  old_sku TEXT NOT NULL,
  new_sku TEXT NOT NULL,
  effective_date TEXT,
  reason TEXT,
  added_by TEXT
);

CREATE TABLE IF NOT EXISTS users (
  user_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  branch_access TEXT DEFAULT 'All',
  last_login DATETIME,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS npi_forecasts (
  npi_id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER,
  sku TEXT NOT NULL,
  category TEXT,
  lookalike_skus TEXT,
  branch TEXT,
  month TEXT,
  value INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## SEED DATA

### Product Master (10 SKUs):
```
REF_190L_DirectCool | Direct Cool | 180-200L | Single Door | 12500 | 3 | 1
REF_240L_FrostFree | Frost Free | 240L | Double Door | 22000 | 3 | 1
REF_340L_TripleDoor | Frost Free | 340L | Triple Door | 32000 | 4 | 1
WM_7KG_TopLoad | Washing Machine | 7KG | Top Load | 18000 | 4 | 1
WM_8KG_FrontLoad | Washing Machine | 8KG | Front Load | 28000 | 5 | 1
WM_6.5KG_SemiAuto | Washing Machine | 6.5KG | Semi-Automatic | 9500 | 3 | 1
AC_1.5T_Inverter | Air Conditioner | 1.5 Ton | Inverter Split | 35000 | 3 | 1
AC_2.0T_Split | Air Conditioner | 2.0 Ton | Split | 42000 | 4 | 1
MW_25L_Convection | Microwave | 25L | Convection | 11000 | 4 | 1
IH_3B_SmartGlass | Induction | 3 Burner | Smart Glass | 8500 | 4 | 1
```

### Branches (8):
Mumbai, New Delhi, Kolkata, Chennai, Bangalore, Hyderabad, Pune, Ahmedabad

### Users:
```
Priya Sharma | priya@whirlpool.in | demand_planning | All
Rahul Mehta | rahul@whirlpool.in | branch_sales | Mumbai
Anjali Singh | anjali@whirlpool.in | category_team | All
Admin User | admin@whirlpool.in | admin | All
```

### LFL Master:
```
REF_185L_DirectCool -> REF_190L_DirectCool | 2024-04-01 | Upgraded model
REF_230L_FrostFree -> REF_240L_FrostFree | 2024-07-01 | Capacity upgrade
WM_6KG_TopLoad -> WM_7KG_TopLoad | 2024-01-01 | New model launch
```

### Historical Forecast Runs (Jan 2025 - Dec 2025):
Generate realistic monthly values per branch per SKU with these patterns:
- REF_190L_DirectCool: base 300 units/branch, +40% in Apr-Jun (summer), -20% Oct-Feb
- REF_240L_FrostFree: base 250 units/branch, +30% Apr-Jul
- REF_340L_TripleDoor: base 120 units/branch, flat seasonality
- WM_7KG_TopLoad: base 220 units/branch, +20% festival season Sep-Nov
- WM_8KG_FrontLoad: base 140 units/branch, stable
- WM_6.5KG_SemiAuto: base 180 units/branch, +25% Feb-Apr
- AC_1.5T_Inverter: base 200 units/branch, +250% Apr-Jul, near-zero Nov-Feb
- AC_2.0T_Split: base 120 units/branch, same AC seasonality
- MW_25L_Convection: base 90 units/branch, +30% Diwali season (Oct-Nov)
- IH_3B_SmartGlass: base 70 units/branch, stable with slight winter uptick

Add ±15% random variance per branch to make it realistic.
Mumbai and New Delhi branches should be 25% higher volume than average.
Chennai and Hyderabad should be 15% higher for AC category.

### Forecast Scenarios (Seed 2 scenarios for current cycle May 2026):
Scenario 1: "Baseline SARIMAX" | accuracy: 87.3 | bias: 3.6 | revenue: 14820 (in lakhs) | total_units: 124850 | status: finalized | finalized_at: 2026-05-14
Scenario 2: "High Growth RF" | accuracy: 84.1 | bias: 5.2 | revenue: 16240 (in lakhs) | total_units: 136200 | status: draft

### Forward Forecast Runs (Feb 2026 - Jul 2026) for Scenario 1:
Use values from the wireframe images as reference:
- New Delhi | REF_190L_DirectCool: 191, 490, 365, 195, 145, 108
- Kolkata | REF_240L_FrostFree: 215, 520, 305, 425, 510, 175
- Chennai | REF_340L_TripleDoor: 430, 188, 222, 370, 440, 550
- Mumbai | WM_7KG_TopLoad: 510, 445, 285, 340, 255, 520
- New Delhi | WM_8KG_FrontLoad: 375, 108, 345, 530, 145, 570
- Fill remaining branch/SKU combinations with calculated values

### Branch Overrides (seed realistic ones):
```
Kolkata | REF_240L_FrostFree | Mar 2026 | AI: 520 | Override: 580 | Reason: E: Seasonality effects | By: Holly | Status: submitted
Chennai | REF_190L_DirectCool | Feb 2026 | AI: 1232 | Override: 1800 | Reason: B: New Promo/Activity | By: James | Status: submitted | Version: 1
Mumbai | AC_1.5T_Inverter | Apr 2026 | AI: 467 | Override: 510 | Reason: A: Increase in ranging | By: Rahul | Status: submitted
New Delhi | REF_340L_TripleDoor | Mar 2026 | AI: 210 | Override: 220 | Reason: B: New Promo/Activity | By: Harry | Status: resolved | Final: 220
```

### Exception Log (seed 6 exceptions):
```
New Delhi | REF_190L | Extreme Outlier High | original: 4500 | corrected: 450
Mumbai | AC_1.5T | Zero Value Anomaly | original: 0 | corrected: 380
Chennai | WM_8KG | Z-Score Violation | original: 2800 | corrected: 280
Kolkata | REF_240L | Negative Value Error | original: -42 | corrected: 201
New Delhi | MW_25L | Null Data Point | original: null | corrected: 114
Mumbai | REF_340L | Sudden Volume Drop | original: 12 | corrected: 179
```

### Active Cycle:
cycle_id: 1 | month: May | year: 2026 | status: overrides_pending | created_by: Priya Sharma

---

## BACKEND API ROUTES

Build all routes in server/routes/:

```
GET  /api/dashboard              — cycle status, KPI summary, branch map data with status
GET  /api/forecast/workbench     — variable options, algorithm defaults
POST /api/forecast/generate      — accepts {filters, algorithm_config}, returns {forecast_runs, exceptions}
POST /api/forecast/save-scenario — saves scenario, returns scenario_id
GET  /api/scenarios              — all scenarios for current cycle
POST /api/scenarios/compare      — accepts {scenario_ids[]}, returns comparison data + charts data
POST /api/scenarios/finalize     — marks finalized, creates branch_override records, returns updated cycle
GET  /api/collaboration          — all branches overview
GET  /api/collaboration/:branch  — override table for specific branch
POST /api/collaboration/override — saves single override {branch, sku, month, value, reason}
POST /api/collaboration/submit/:branch — submits all overrides for branch
GET  /api/conflicts              — all submitted overrides with conflict flags, branch rollup
POST /api/conflicts/resolve      — sets final_override {override_id, final_value, decision}
GET  /api/report                 — full KPI data, future forecast table, performance table
POST /api/report/export          — returns CSV string for download
POST /api/demand-sensing/upload  — multer upload, calls Claude API, saves insights, returns insights
POST /api/demand-sensing/apply   — applies adjustments to forecast_runs
GET  /api/demand-sensing/history — past demand sensing runs
GET  /api/npi/lookalikes         — accepts {category, segment, price}, returns 3 matching SKUs with ramp data
POST /api/npi/save               — saves NPI forecast
GET  /api/admin/products         — product master with filters
POST /api/admin/products/upload  — CSV upload
GET  /api/admin/lfl              — LFL master
POST /api/admin/lfl/upload       — CSV upload
POST /api/admin/lfl/add          — add single LFL mapping
GET  /api/admin/users            — user list
POST /api/admin/users/add        — add user
```

For POST /api/forecast/generate: generate realistic forecast values based on the historical data in the DB using a simple trend + seasonality calculation. Apply the selected algorithm label to the output but the actual calculation can be a statistical trend model in JS. Return exceptions by checking for values >3x mean, zero values, negative values, null values, sudden drops >50%.

For Claude API in /api/demand-sensing/upload:
- Extract text from uploaded file (use filename/mimetype to determine extraction method)
- Call Anthropic API with this system prompt:
  "You are a demand planning analyst for Whirlpool India. Analyze the provided document and extract demand signals relevant to these product categories: Direct Cool Refrigerators, Frost Free Refrigerators, Washing Machines (Top Load, Front Load, Semi-Auto), Air Conditioners (1.5T Inverter, 2.0T Split), Microwaves (25L Convection), and Induction cooktops (3 Burner Smart Glass). For each demand signal found, return a JSON array. Each object must have: impact_level (high/medium/low), insight_text (one clear actionable sentence), affected_skus (array from: REF_190L_DirectCool, REF_240L_FrostFree, REF_340L_TripleDoor, WM_7KG_TopLoad, WM_8KG_FrontLoad, WM_6.5KG_SemiAuto, AC_1.5T_Inverter, AC_2.0T_Split, MW_25L_Convection, IH_3B_SmartGlass), affected_branches (array from: Mumbai, New Delhi, Kolkata, Chennai, Bangalore, Hyderabad, Pune, Ahmedabad), suggested_adjustment_percent (number, positive=increase, negative=decrease), confidence (0-100). Return ONLY valid JSON array, no other text."
- Parse response, store in demand_sensing_log
- If Claude API fails, return these hardcoded fallback insights:
  [
    {impact_level:"high", insight_text:"Trade promotion budget for AC category increased 22% for Q2 2026 — expected 15-18% demand uplift on AC_1.5T_Inverter across Delhi, Mumbai, Bangalore", affected_skus:["AC_1.5T_Inverter","AC_2.0T_Split"], affected_branches:["New Delhi","Mumbai","Bangalore"], suggested_adjustment_percent:16, confidence:85},
    {impact_level:"medium", insight_text:"IMD forecast: above-normal temperatures across South India through June — positive signal for Direct Cool refrigerators in Chennai and Hyderabad", affected_skus:["REF_190L_DirectCool"], affected_branches:["Chennai","Hyderabad"], suggested_adjustment_percent:10, confidence:78},
    {impact_level:"medium", insight_text:"WM_6.5KG_SemiAuto listed for exclusive Q2 promotion on Flipkart — modest 8% online channel uplift expected", affected_skus:["WM_6.5KG_SemiAuto"], affected_branches:["Mumbai","New Delhi","Bangalore"], suggested_adjustment_percent:8, confidence:72},
    {impact_level:"low", insight_text:"Competitor LG launching 1.5T inverter AC at Rs 26,499 in May — potential 5% demand pressure on AC_1.5T_Inverter in tier-1 cities", affected_skus:["AC_1.5T_Inverter"], affected_branches:["Mumbai","New Delhi","Bangalore","Hyderabad"], suggested_adjustment_percent:-5, confidence:65}
  ]

---

## SCREEN 1 — LOGIN PAGE

Full viewport centered layout. Dark navy background (#1B3A6B) with a subtle diagonal pattern overlay.

Top: "DemandIQ" wordmark in white, bold, 36px. Below it: "Whirlpool India | Intelligent Demand Planning" in white/70 opacity, 16px.

4 role cards in a 2x2 grid (1 column on mobile, max-width 480px card area):
Each card: white background, 12px border-radius, 24px padding, hover: slight lift + navy border.

Cards:
1. BarChart2 icon (navy) | "Demand Planning Team" | "Generate forecasts, manage scenarios & run demand sensing" | "Login as Demand Planner" button
2. MapPin icon | "Branch Sales Team" | "Review and override your branch-level forecasts" | "Login as Branch Manager" button  
3. Layers icon | "Category Team" | "Resolve conflicts and view national category rollup" | "Login as Category Manager" button
4. Settings icon | "Admin" | "Manage product masters, LFL mapping and users" | "Login as Admin" button

Buttons: navy background, white text, full width, 44px height.
On click: set user in AuthContext {name, role, branch}, navigate to role home screen.
No password required — demo mode.

Footer: "Powered by DecisionPoint Analytics" in white/40 opacity, 12px.

---

## SCREEN 2 — COMMAND CENTER DASHBOARD
(Route: /dashboard — Demand Planning Team home)

Top bar: "May 2026 Forecast Cycle" left-aligned. Status badge right: orange pill "⚡ Overrides Pending — 5 of 8 branches".

---

### Cycle Progress Stepper (horizontal desktop, compact vertical mobile):
5 steps with connecting lines:
✅ Forecast Generated (green, date: 14-May)
✅ Scenarios Compared (green, date: 14-May)  
✅ Scenario Finalized (green, "Baseline SARIMAX")
⏳ Branch Overrides (orange, "3 of 8 submitted")
⬜ Sign-off (grey, locked)

---

### KPI Row (4 cards, scroll horizontal on mobile):

Card 1: Total Forecasted Units
- Value: 1,24,850
- Trend: ↑ 8.2% vs last cycle (green pill)
- Sparkline: 8-point upward trending line
- Icon: Package (navy, top-right)

Card 2: Avg Forecast Accuracy  
- Value: 87.3%
- Trend: ↓ 1.2% (amber pill — slight decline)
- Sparkline: slightly declining line
- Icon: Target

Card 3: Pending Overrides
- Value: 5 branches
- Sub: "Due by 20-May-2026"
- Color: amber left border
- Icon: Clock (orange)

Card 4: Unresolved Conflicts
- Value: 2
- Color: red left border if >0
- Sub: "Requires category review"
- Icon: AlertTriangle (red)

---

### Main Content (2-column desktop, stacked mobile):

LEFT (60% width): India Map
Use react-leaflet. India centered, zoom level 5. White/light grey tile layer.

8 city markers as custom circle markers (24px diameter):
- Bangalore: GREEN (#16A34A) — override submitted, no conflicts
- Pune: GREEN — submitted, clean  
- Mumbai: AMBER (#D97706) — submitted, 1 conflict flagged — pulsing animation
- Hyderabad: AMBER — submitted, conflict
- New Delhi: RED (#DC2626) — override exceeded tolerance — pulsing animation
- Kolkata: GREY (#9CA3AF) — not yet submitted
- Chennai: GREY — not yet submitted  
- Ahmedabad: GREY — not yet submitted

Each marker popup (click):
```
[Branch Name]
Forecast Total: X,XXX units
Override Status: [status badge]
Accuracy (last cycle): XX%
[View Branch Data →] button
```

Clicking "View Branch Data" navigates to Collaboration Suite filtered to that branch.

RIGHT (40% width):

Section 1: Recent Activity Feed
Header: "Cycle Activity" with a live indicator dot (pulsing green)
Timeline list (icon + text + time):
- 🔴 "Holly (Kolkata) submitted overrides — 2 conflicts flagged" — 2h ago
- ✅ "Scenario 1 finalized by Priya Sharma" — 5h ago
- 🟡 "6 exceptions detected — 4 acknowledged" — 1d ago
- ✦ "Demand Sensing applied: Q2_Promo_Brief.pdf" — 1d ago
- ✅ "Forecast generated for May 2026 cycle" — 1d ago

Section 2: Quick Actions
"Continue Cycle →" button (navy, full width) — goes to next pending step
"View Report" button (outline, full width)
"Run Demand Sensing" button (outline with ✦ icon, full width)

---

## SCREEN 3 — FORECAST WORKBENCH
(Route: /workbench)

Top filter bar (horizontally scrollable on mobile, all in one row):
Branch (multi-select dropdown) | Category (dropdown) | Segment (dropdown, filters by category) | Subsegment (dropdown) | Product (multi-select) | Time Period (date range: show "21/5/06 – 26/5/03" as default) | Horizon (toggle: 3M / 6M / 12M)

---

### Two-column layout desktop (left config panel, right output panel):
Single column mobile (config collapses to top, output below).

---

### LEFT PANEL — Configuration:

**Section: Select Variables**
Header with info icon tooltip explaining what variables are.

Primary Variables:
Dropdown with options: Historical Sales | Primary Sales | Secondary Sales | All Combined
Default: All Combined

Internal Causal:
Multi-select chip interface (not dropdown):
Chips: [Trade Promotions] [Pricing Changes] [New Launch] [Pipeline Changes] [Scheme Changes]
Selected chips turn navy with white text.

External Causal:
Multi-select chips: [Festival Calendar] [Weather Data] [GDP Index] [Competitor Activity] [Govt Regulations]

**Section: Causal Calendar**
Horizontal scrollable timeline strip showing next 6 months.
Event chips positioned on months:
- Jun 2026: "Rath Yatra" (yellow)
- Aug 2026: "Independence Day Sale" (blue)
- Sep 2026: "Onam" (orange)
- Oct 2026: "Navratri + Diwali 🔥" (red, larger — high impact)
- Jan 2027: "Republic Day Sale" (blue)
Timeline has month labels below. Events float above as chips.

**Section: Select Algorithms — ABC/XYZ Matrix**

Label explanation (collapsible info):
"ABC = Sales Volume (A=Top 80%, B=Next 15%, C=Bottom 5%) | XYZ = Forecast Difficulty (X=Easy, Y=Medium, Z=Difficult)"

3x3 styled grid. Column headers: A (High Vol) | B (Mid Vol) | C (Low Vol). Row labels: X (Easy) | Y (Medium) | Z (Difficult).
Each cell: styled card with dropdown inside. Algorithms available in each dropdown:
SARIMAX | ARIMA | Exponential Smoothing | Moving Average | Random Forest | XGBoost | Prophet
Default all: SARIMAX.

"Edit Parameters" link below grid (pencil icon) — opens modal.

**Edit Parameters Modal:**
Full-screen on mobile, centered 600px on desktop.
Title: "Edit Algorithm Parameters"
Tabbed sections per algorithm type currently selected:
- Moving Average: Window Size (number input, default 3)
- SARIMAX: p (4), d (1), q (2) — labeled with tooltip explanations
- Random Forest: n_estimators (100), max_depth (7), min_samples (3)
- XGBoost: learning_rate (0.1), max_depth (6), n_estimators (100)
Cancel + Confirm buttons. Confirm saves to local state.

**Generate Button:**
Full width, 52px height, navy background.
Text: "Generate Forecast →"
Loading state: spinner + "Running models..." text.
On click: POST to /api/forecast/generate with current config.

---

### RIGHT PANEL — Output (appears after Generate):

**Loading State:** 
Animated skeleton cards showing "Analyzing 10 SKUs × 8 branches × 6 months..." progress message.

**Exception Review Panel:**
Header: "⚠️ 6 Exceptions Detected" with amber badge.
Collapsible. Default: expanded.

Each exception as a card (left colored border):
```
🔴 Extreme Outlier High
   New Delhi | REF_190L_DirectCool | Jan 2026
   Detected value: 4,500 (expected range: 200–500)
   [Correct to 450] [Acknowledge & Keep] buttons
```
Types: Extreme Outlier High/Low | Zero Value | Z-Score Violation | Negative Value | Null Data | Sudden Volume Drop

Correcting an exception: updates value in the forecast table below in real time with a green flash animation.

**Forecast Output:**
Toggle tabs: [📈 Chart View] [📋 Table View]

Chart View:
Multi-line Recharts chart. X-axis: all months from Jan 2025 to horizon end.
For each selected SKU: 
- Solid line for historical actuals (#1B3A6B)
- Dashed line for forecast (#E31837)
- Shaded confidence interval band (navy, 10% opacity)
Vertical dashed line at "today" (May 2026).
Dropdown to switch between SKUs or show top 5.
Hover tooltip: month | actual | forecast | variance%.
Legend below chart.

Table View:
Columns: Branch | SKU | Feb'26 | Mar'26 | Apr'26 | May'26 | Jun'26 | Jul'26 | 6M Total
Sticky Branch+SKU columns on mobile. Sortable. Exception-corrected cells highlighted in light green.
Color cells: green if forecast > last year same month +10%, red if >10% below.

**Save Scenario Section:**
Below the output.
Input: "Scenario Name" (text, placeholder "e.g. Baseline May 2026")
Textarea: "Add Notes" (optional)
"💾 Save Scenario" button — POST to /api/forecast/save-scenario.
Success toast: "✅ Scenario saved to library"

---

## SCREEN 4 — FORECAST SELECTION / SCENARIO COMPARISON
(Route: /scenarios)

Two-column layout desktop (left sidebar + right main), drawer on mobile.

---

### Left Sidebar — Scenario Library:
Header: "Scenario Library" + count badge.

Each scenario as a card (not plain list):
```
[checkbox] Scenario 1 — Baseline SARIMAX
           Created: 14-May-2026
           [SARIMAX + RF] algorithm badge
           Accuracy: 87.3 [green badge]    
           [👁 View] [🗑 Delete] icons
```

"Comparing selected (max 5)" note.
"Compare →" button at bottom (activates when 2+ selected).

---

### Right Panel:

Empty state: illustration + "Select 2 or more scenarios to compare their outputs"

After Compare clicked:

**Winner Cards Row (3 cards):**
```
🏆 Best Accuracy          🏆 Best Revenue         🏆 Best Sales
   Scenario 1                Scenario 1               Scenario 1
   91.2 / 100               ₹47.3 Cr                 52,400 units
   [mini sparkline]         [mini sparkline]          [mini sparkline]
```

**Forecast Trend Chart:**
Multi-line Recharts LineChart. 18 months X-axis (Q1'25 to Q2'26).
Lines: Actual (solid black, 2px) | Scenario 1 (navy, 2px) | Scenario 2 (red, 2px).
Shaded area between Scenario 1 and Scenario 2 showing the range.
Dashed vertical line: "Today" with label.
Dropdown to filter by Branch and Category.
Full tooltip on hover. Legend below.

**Comparison Deepdive Table:**
Two sections side by side (stacked mobile): Scenario 1 (Baseline) vs Scenario 2.
Metric selector dropdown: Accuracy | Revenue | Units
Columns: Branch | M1 | M2 | M3 | M4 | M5 | M6
Cells: percentage values, color coded green (>85%) → yellow (75-85%) → red (<75%).
LFL indicator: SKUs remapped via LFL master show a "↔ mapped" chip with tooltip showing old→new SKU.

**Accuracy & Bias Trend Chart:**
Two-line chart. Y-axis: percentage. X-axis: 6 months.
4 lines: Accuracy S1, Accuracy S2, Bias S1, Bias S2.
Color coded. Legend below.

**Bottom Action Bar (sticky on mobile):**
Left: "Select scenario to finalize:" dropdown (shows scenario names).
Right: "✅ Finalize & Push to Branches" button (red, prominent).

Finalize modal:
```
Finalizing: Scenario 1 — Baseline SARIMAX

This will:
• Lock forecast for May 2026 cycle
• Notify 8 branch managers to review
• Create override records for 80 SKU-Branch combinations

Forecast Summary:
Total Units: 1,24,850 | Revenue: ₹148.2 Cr | Accuracy: 87.3%

[Cancel]  [Confirm & Push →]
```
On confirm: POST /api/scenarios/finalize. Update DB. Show success toast. Update dashboard cycle stepper.

---

## SCREEN 5 — COLLABORATION SUITE
(Route: /collaboration — Branch Sales Team home, also accessible to Demand Planning)

**Top Banner (amber):**
"📋 Finalized forecast for May 2026 cycle is ready for review. Please submit your overrides by 20-May-2026."
[3 days remaining] countdown badge.

---

### India Map (full width, 280px height):
Same map component. For Branch Sales logged in as Rahul (Mumbai): Mumbai marker is navy/highlighted, all others are grey/dimmed.
For Demand Planning: all branches colored by submission status.

---

### Deepdive Table:
Header: "Branch Forecast Overrides" + [📤 Export CSV] button top-right.

Columns: Branch | SKU | Category | Segment | Last 6M Actual | AI Forecast (6M) | Override Forecast | Override By | Override On | Version | Actions

Sticky first 2 columns on mobile. Horizontal scroll.

Override Forecast column: inline editable number input.
Validation on input change:
- Within ±20%: green border + "✓ Within tolerance" tooltip
- ±20-30%: amber border + "⚠ Approaching tolerance limit (±30% max)"  
- >±30%: red border + "⛔ Exceeds tolerance — additional justification required"

When override value entered: Reason dropdown appears in that row:
A: Increase/Decrease in ranging | B: New Promo/Activity | C: Pricing Change | D: Repipeline | E: Seasonality | F: Competitor Activity | G: Others

**Row Expansion (click any row):**
Expands to show a 200px inline chart: that SKU's 12-month history + AI forecast + proposed override as 3 separate lines. This is the key "intelligent" moment that shows the planner context before overriding.

Action column per row: [💾 Save] [↩ Undo] icons.

Bottom: "[📤 Submit All Overrides for Mumbai →]" button (navy, full width mobile).
Confirm modal: "Submit X overrides for Mumbai branch? This cannot be undone."

---

## SCREEN 6 — OVERRIDE CONFLICTS
(Route: /conflicts — Category Team home, accessible to Demand Planning)

**Two tabs: [🗺 National View] [⚡ Conflict Resolution]**

---

### Tab 1 — National View:

India map full width, 300px height, all 8 branches visible.
Branch colors: Green (no conflict), Amber (minor deviation), Red (conflict flagged).
Click branch → filters conflict table below.

**Category Rollup Table:**
Columns: Category | AI Forecast Total | After Overrides Total | Deviation | Status
Rows:
```
Direct Cool Refrigerator | 28,450 | 30,200 | +6.1% | ✅ Within range
Frost Free Refrigerator  | 22,100 | 25,800 | +16.7%| ⚠ Watch
Washing Machine          | 31,200 | 32,100 | +2.9% | ✅ OK
Air Conditioner          | 38,600 | 36,100 | -6.5% | ✅ OK
Microwave               |  8,900 |  9,200 | +3.4% | ✅ OK
```

Grouped bar chart below table: AI Forecast vs After Overrides per category. Color coded matching table status.

---

### Tab 2 — Conflict Resolution:

Filter bar: Branch dropdown | Category dropdown | Status (All / Pending / Resolved).

Conflict table columns: Branch | SKU | Month | Orig Forecast | Override Ver | Override Value | Reason | By | On | Deviation% | Decision | Final Override

Decision column per row: [✅ Accept] [❌ Reject] [✏ Set Custom] buttons.
- Accept: turns row green, final_override = override_value
- Reject: turns row amber, final_override = original forecast  
- Set Custom: shows inline number input

Deviation% column: color coded (green <10%, amber 10-20%, red >20%).

Bottom: "✅ Confirm All Decisions" button — POST /api/conflicts/resolve for all rows.

---

## SCREEN 7 — DEMAND SENSING
(Route: /demand-sensing — Demand Planning Team only)

Header badge: "✦ AI-Powered Module — Demand Sensing" in gradient text (navy to red).

Two-panel layout desktop (50/50), stacked mobile.

---

### LEFT PANEL — Upload & Extract:

Large upload zone (dashed border, 3px, rounded-xl):
```
        ☁️ 
   Drop files here or click to browse
   
   Supports: PDF, Excel (.xlsx), Word (.docx), 
   Email text (.eml/.txt), Images (.jpg/.png)
```

Document type chips below zone:
[📋 Trade Promo Brief] [📊 Market Report] [🌤 Weather Advisory] [🏪 Competitor Intel] [📝 Internal Note]

**Upload States:**

State 1 — File dropped:
Show file card: [file icon] filename.pdf | 2.4 MB | [✕ Remove]
"Analyzing document..." processing state below.

State 2 — Processing animation:
Spinning gradient ring (CSS conic-gradient animation).
Text: "✦ AI reading document... extracting demand signals"
Duration: 1.5s then show results.

State 3 — Results:
"✦ 4 demand signals extracted from [filename]"

Each insight card (staggered slide-in animation, 100ms delay each):
```
🔴 HIGH IMPACT
"Trade promotion budget for AC category increased 22% for Q2 — 
 expected 15-18% demand uplift on AC_1.5T_Inverter"
Affects: [AC_1.5T_Inverter] [AC_2.0T_Split] chips
Branches: [New Delhi] [Mumbai] [Bangalore] chips  
Suggested adjustment: +16%    Confidence: 85%
[Toggle: ● Include in adjustment]
```

Below all insights:
"📝 Document Summary:" 
Grey card with key takeaway text generated by Claude.

---

### RIGHT PANEL — Adjustment Preview:

Header: "Demand Adjustment Preview"

Before/After chart:
Recharts LineChart. 2 lines per SKU: Original Forecast (solid navy) vs AI-Adjusted (dashed red).
Shaded delta area between them (light red fill).
Toggle to show/hide each SKU. Top 5 affected SKUs shown by default.

Adjustment Table:
Columns: SKU | Branch | Month | Current Forecast | Suggested Adj% | Your Final Adj% | Adjusted Forecast
"Your Final Adj%" is editable — changing it updates "Adjusted Forecast" in real time.
Rows only for SKUs/branches from toggled-on insight cards.

Bottom: 
"✦ Apply Adjustments" button (green, full width) — POST /api/demand-sensing/apply.
Success toast: "✦ Demand adjustments applied to 6 SKUs across 4 branches. Forecasting Report updated."

**History Section (below panels):**
"Previously Applied — This Cycle"
List of past uploads: [📄 Q2_Promo_Brief.pdf | 14-May | 4 insights | 6 SKUs adjusted | ✅ Applied]

---

## SCREEN 8 — NPI FORECASTING
(Route: /npi)

Header: "New Product Introduction Forecasting"
Sub: "Generate demand forecasts for new SKUs using look-alike models"

---

### Step 1 — Register New Product:
Card with form in 2-column grid (single column mobile):
- New SKU Code (text, e.g. "REF_225L_DirectCool_2026")
- Category (dropdown: Direct Cool | Frost Free | Washing Machine | Air Conditioner | Microwave | Induction)
- Segment (auto-filters based on category)
- Subsegment
- Price Point (₹ number input)
- Star Rating (1-5 star toggle buttons)
- Target Branches (multi-select checklist of 8 cities)
- Expected Launch Date (date picker)
- Brief Description (textarea)

"🔍 Find Look-alike Products" button.

---

### Step 2 — Look-alike Matching (appears after button click):
Loading state: "Analyzing product attributes..."

3 look-alike cards in a row (stacked mobile):
```
REF_190L_DirectCool
Match Score: [94% ██████████]
✓ Same category  ✓ Similar price (±8%)  ✓ Same segment

[mini bar chart showing month 1-12 ramp after launch]
Peak month: 4 | 6M total: ~12,400 units
```

Overlay ramp chart: all 3 look-alike launch trajectories on one chart.
X-axis: Month 1 to Month 12 post-launch.
Different colored lines per SKU. Legend.

Blend selector:
```
Base NPI forecast on:
[✓] REF_190L_DirectCool    [slider: 50%]
[✓] REF_240L_FrostFree     [slider: 30%]  
[ ] REF_340L_TripleDoor    [slider: 20%]
```

---

### Step 3 — NPI Forecast Output:
"📊 Projected NPI Ramp (Blended Look-alike Model)"

Table: Branch rows × Month 1-6 columns. Editable cells. Pre-populated from weighted blend.
Total row at bottom. Total column on right.

Branch breakdown shows allocation proportional to existing branch volumes.

"💾 Save NPI Forecast as Scenario" button.

---

## SCREEN 9 — FORECASTING REPORT
(Route: /report — all roles view, Export only for Demand Planning)

---

### KPI Cards Row (4 cards, 2×2 mobile):

Card 1: Predicted Sales
Value: 1,24,850 units ↑ 8.2%
Sparkline: 12-point upward trend

Card 2: Forecast Accuracy  
Value: 87.3% ↓ 1.2%
Color: amber (below 90% threshold)
Sparkline: slightly declining

Card 3: BIAS
Value: 3.6% ↓ 0.6%
Color: green (low and decreasing)
Sparkline: gradually declining (good)

Card 4: Predicted Revenue
Value: ₹148.2 Cr ↑ 11.4%
(Note: INR Crores throughout this screen — NOT dollars)
Sparkline: upward trend

---

### Charts Row (3 charts, single column mobile):

Chart 1 — Forecast vs Actual Trend (60% width):
18-month LineChart. 3 lines:
- Actual sales (solid black)
- AI Forecast (navy dashed)  
- After Overrides (red dashed)
Vertical "today" marker. X: months. Y: units.
Shaded area between Forecast and Actual showing accuracy gap.

Chart 2 — Accuracy by Branch (20% width):
Horizontal BarChart. 8 branches ranked best to worst:
Mumbai: 91% 🟢 | Bangalore: 89% 🟢 | Pune: 88% 🟢 | Delhi: 85% 🟡 | Hyderabad: 83% 🟡 | Kolkata: 81% 🟡 | Chennai: 79% 🟠 | Ahmedabad: 78% 🟠
Bars color coded: green >85%, amber 80-85%, orange <80%.

Chart 3 — Category Mix Donut (20% width):
Recharts PieChart with inner hole.
Segments: AC 32% | REF 28% | WM 24% | MW 10% | IH 6%
Clicking a segment filters the tables below to that category.
Center label: "Total Units"

---

### Future Forecast Table:
Header: "Future Forecast" + [Horizon: 3M/6M/12M selector] + [Month range] + [📤 Export] button.
Columns: Branch | SKU | Feb'26 | Mar'26 | Apr'26 | May'26 | Jun'26 | Jul'26 | Total
Cells with ✦ icon = Demand Sensing adjusted (tooltip explains the adjustment).
Green cells: forecast > LY same month. Red cells: forecast < LY -10%.
Sortable. Sticky headers.

### Forecast Performance Table:
Header: "Forecast Performance — Historical" + [Month selector] + [📤 Export] button.
Columns: Branch | SKU | Month | Actual | AI Forecast | Override | Final | Accuracy% | BIAS%
BIAS% column: green <5%, amber 5-10%, red >10%.
Show Dec 2025 data by default.

---

### Sign-off Section:
Amber info card: "This report reflects the finalized forecast after all overrides and demand sensing adjustments."

"📋 Submit for Sign-off" button (navy, full width mobile).

Sign-off confirmation modal:
```
May 2026 Forecast Cycle — Summary

Cycle Duration: 14-May to 15-May-2026
Scenarios Generated: 2 | Finalized: Scenario 1 (Accuracy: 87.3%)
Branch Overrides: 6 of 8 submitted
Conflicts Resolved: 3 of 3
Demand Sensing: 1 document applied (4 signals, 6 SKUs)
Total Forecasted Units: 1,24,850
Predicted Revenue: ₹148.2 Crore

[Cancel]  [✅ Submit & Close Cycle]
```

On submit: update cycle status to 'signed_off' in DB. Show success toast. Update cycle stepper on dashboard to all green.

---

## SCREEN 10 — ADMIN CONSOLE
(Route: /admin — Admin role only)

Three tabs: [📦 Product Master] [🔄 LFL Master] [👤 User Management]

---

### Tab 1 — Product Master:
Filter bar: Category dropdown | Active/Inactive toggle.
[📤 Upload CSV] button + [📥 Download Template] button + [+ Add New SKU] button (top right).

Table: SKU | Category | Segment | Subsegment | Price (₹) | Stars | Active | Launch Date | Actions (✏ Edit | ⊘ Deactivate)
Active column: toggle switch per row.
Clicking Edit opens a modal form pre-filled with row data.

Upload CSV: opens file picker, accepts .csv only, processes and shows preview before confirming.

---

### Tab 2 — LFL Master:
Header: "Like-for-Like Product Mapping"
Sub: "Map discontinued SKUs to their successor products for accurate forecast comparison"

[📤 Upload CSV] + [📥 Download Template] + [+ Add Mapping] buttons.

Table: Old SKU | → | New SKU | Effective Date | Reason | Added By | Actions (🗑 Delete)
Visual arrow between old→new SKU columns.

Add Mapping modal: Old SKU dropdown | New SKU dropdown | Effective Date | Reason textarea.

---

### Tab 3 — User Management:
[+ Add User] button top right.

Table: Name | Email | Role | Branch Access | Last Login | Status | Actions (✏ Edit | ⊘ Deactivate)
Role shown as colored badge (demand_planning=navy, branch_sales=blue, category_team=purple, admin=red).
Status: Active (green pill) | Inactive (grey pill).

Add User modal: Name | Email | Role dropdown | Branch Access multi-select | Send invite toggle.

---

## NAVIGATION & ROLE-BASED ROUTING

Desktop top navbar (full width, navy background):
Left: "DemandIQ" text logo in white bold + "Whirlpool" subtext in white/70
Center: role-specific nav tabs (white text, active tab has white underline + slightly bolder)
Right: user avatar circle + name + role badge + logout icon

Mobile bottom tab bar (fixed, white background, shadow above):
Icons + labels, max 5 tabs. Active tab: colored pill background (#1B3A6B/10, navy icon+text).

### Role: demand_planning
Tabs: Dashboard | Workbench | Scenarios | Collaboration | Conflicts | Demand Sensing | NPI | Report
Home route: /dashboard

### Role: branch_sales  
Tabs: Collaboration | Report
Home route: /collaboration
Report screen: hide Export and Sign-off button, show "View Only" badge.

### Role: category_team
Tabs: Conflicts | Report
Home route: /conflicts
Report: view only.

### Role: admin
Tabs: Admin | Report
Home route: /admin

AuthContext provides: {user: {name, role, branch}, isAuthenticated}
Protected routes redirect to /login if not authenticated.

---

## INDIA MAP COMPONENT — SHARED

Create IndiaMap.jsx as a reusable component accepting:
```
props: {
  branchData: [{name, lat, lng, status, metric, metricLabel}],
  onBranchClick: (branchName) => void,
  height: number (default 400),
  highlightBranch: string (optional — dims others)
}
```

Status to color mapping:
- 'submitted_clean': #16A34A (green)
- 'submitted_conflict': #D97706 (amber) + pulse animation
- 'submitted_exceeded': #DC2626 (red) + pulse animation
- 'pending': #9CA3AF (grey)
- 'active': #1B3A6B (navy) — for branch sales own branch

Pulse animation (CSS keyframes):
```css
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(220, 38, 38, 0); }
  100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0); }
}
```

City coordinates:
```
Mumbai:    [19.0760, 72.8777]
New Delhi: [28.6139, 77.2090]
Kolkata:   [22.5726, 88.3639]
Chennai:   [13.0827, 80.2707]
Bangalore: [12.9716, 77.5946]
Hyderabad: [17.3850, 78.4867]
Pune:      [18.5204, 73.8567]
Ahmedabad: [23.0225, 72.5714]
```

Use OpenStreetMap tiles: https://tile.openstreetmap.org/{z}/{x}/{y}.png
Attribution: © OpenStreetMap contributors

---

## TOAST NOTIFICATION SYSTEM

Create a ToastContainer component positioned top-right (bottom-center on mobile).
Auto-dismiss after 4 seconds. Max 3 toasts visible at once.

Toast types:
- success (green left border + check icon)
- warning (amber left border + warning icon)
- error (red left border + X icon)
- info (navy left border + info icon)
- ai (gradient left border + ✦ icon) — for Demand Sensing actions

Implement useToast() hook: const { toast } = useToast(); toast.success("Message")

---

## MOBILE RESPONSIVENESS

At screens <768px:
- All tables: horizontal scroll, Branch+SKU columns sticky (position: sticky, z-index: 1)
- All charts: full container width, height 220px (reduced from 300px desktop)
- Filter bars: horizontal scroll with -webkit-overflow-scrolling: touch
- KPI cards: 2×2 grid with min-width: 0
- Modals: position fixed, full screen (top/bottom 0, inset 0)
- India map: full width, height 280px
- Bottom nav: fixed bottom, height 64px + safe area
- All buttons: min-height 44px (accessibility)
- Causal calendar: horizontal scroll
- Algorithm matrix: horizontal scroll with visible scrollbar hint
- Upload zone: tap to browse as primary action (drag-drop as secondary)
- Scenario library: collapsible drawer (swipe right to open, X button to close)
- Collaboration table: tap a row to expand, not hover

Breakpoints in Tailwind: sm (640), md (768), lg (1024)

---

## FINAL NOTES

1. All currency throughout the app: ₹ Indian Rupees. Revenue in Crores (₹148.2 Cr). Unit prices in ₹ (₹35,000). Never use $ dollars.

2. All dates in format: DD-Mon-YYYY (15-May-2026) or Mon YYYY (May 2026) for month references.

3. Footer on every screen: "Powered by DecisionPoint Analytics" in small grey text.

4. App title tag: "DemandIQ — Whirlpool India Demand Planning"

5. If Anthropic API key is not set, demand sensing still works with hardcoded fallback insights (never show an error to the user — gracefully fall back).

6. Keep all mock data realistic: no perfect round numbers, no 100% accuracy, no zero conflicts in a real scenario.

7. The app should feel like a ₹50 lakh SaaS product, not a hackathon project.

8. Include a README.md with: setup steps, npm commands, how to set ANTHROPIC_API_KEY env variable, how to run frontend + backend together.

---

Build this now. Start with the backend and database, then build each frontend screen in order. Do not stop until the entire application is complete and running.
