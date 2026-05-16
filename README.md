# DemandIQ — Whirlpool India Demand Planning

> Enterprise-grade demand planning tool built for Whirlpool India. Powered by DecisionPoint Analytics.

## Demo Date: 19–20 May 2026

---

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd server && npm install

# Frontend
cd ../client && npm install
```

### 2. Seed the Database

```bash
cd server && node db/seed.js
```

### 3. Set API Key (Optional)

For live Claude AI-powered Demand Sensing, create a `.env` file in `server/`:

```env
ANTHROPIC_API_KEY=sk-ant-...
PORT=5001
```

If not set, the app gracefully falls back to hardcoded demo insights.

### 4. Run the Application

**Terminal 1 — Backend:**
```bash
cd server && npm start
# Server runs on http://localhost:5001
```

**Terminal 2 — Frontend:**
```bash
cd client && npm start
# App opens at http://localhost:3000
```

---

## Login Roles (Demo Mode)

No password required — click any role card to log in.

| Role | User | Access |
|------|------|--------|
| Demand Planning | Priya Sharma | All screens |
| Branch Sales | Rahul Mehta | Collaboration + Report (Mumbai) |
| Category Team | Anjali Singh | Conflicts + Report |
| Admin | Admin User | Admin Console + Report |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Tailwind CSS (inline styles), Recharts, React-Leaflet |
| Backend | Node.js + Express REST API |
| Database | SQLite + better-sqlite3 |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Icons | Lucide React |
| Fonts | Inter (Google Fonts) |

---

## Screens

1. **Login** — Role-based login without passwords (demo mode)
2. **Dashboard** — Cycle progress, KPI cards, India map, activity feed
3. **Forecast Workbench** — Configure algorithms, generate forecasts, resolve exceptions
4. **Forecast Selection** — Compare scenarios, finalize and push to branches
5. **Collaboration Suite** — Branch managers review & override forecasts
6. **Override Conflicts** — National view + conflict resolution for category team
7. **Demand Sensing** — AI-powered document analysis (Claude API)
8. **NPI Forecasting** — Look-alike model for new product introductions
9. **Forecasting Report** — Full KPI report with export and sign-off
10. **Admin Console** — Product master, LFL mapping, user management

---

## API Endpoints

```
GET  /api/dashboard
GET  /api/forecast/workbench
POST /api/forecast/generate
POST /api/forecast/save-scenario
GET  /api/scenarios
POST /api/scenarios/compare
POST /api/scenarios/finalize
GET  /api/collaboration
GET  /api/collaboration/:branch
POST /api/collaboration/override
POST /api/collaboration/submit/:branch
GET  /api/conflicts
POST /api/conflicts/resolve
GET  /api/report
POST /api/report/export
POST /api/demand-sensing/upload
POST /api/demand-sensing/apply
GET  /api/demand-sensing/history
GET  /api/npi/lookalikes
POST /api/npi/save
GET  /api/admin/products
POST /api/admin/products/upload
GET  /api/admin/lfl
POST /api/admin/lfl/add
POST /api/admin/lfl/upload
GET  /api/admin/users
POST /api/admin/users/add
```

---

## Project Structure

```
demandiq/
├── client/                 React frontend
│   └── src/
│       ├── components/     Shared UI (IndiaMap, KPICard, Modal)
│       ├── context/        AuthContext, ToastContext
│       ├── pages/          10 full screens
│       └── App.jsx         Router + layout
├── server/                 Node.js backend
│   ├── db/                 SQLite schema + seed data
│   ├── routes/             API route handlers
│   └── index.js            Express server
└── wireframes/             Reference design images
```

---

*DemandIQ v1.0 | Whirlpool India | Powered by DecisionPoint Analytics*
