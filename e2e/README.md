# MediCore E2E Tests

End-to-end tests for the MediCore Hospital Management System using [Playwright](https://playwright.dev/).

## Prerequisites

Both dev servers must be running before executing the tests:

```bash
# Terminal 1 — backend (port 5000)
cd server && npm run dev

# Terminal 2 — frontend (port 5173)
cd client && npm run dev
```

The tests run against the **development database** (MongoDB Atlas or local).
Each test creates its own users and data via the API, so the DB is never left in a broken state — but be aware that test documents will accumulate.

## Setup

```bash
cd e2e
npm install
npx playwright install chromium   # one-time browser download
```

## Running Tests

```bash
# Run all tests (headless, sequential)
npm test

# Run with browser visible
npm run test:headed

# Interactive Playwright UI (recommended for debugging)
npm run test:ui

# Run a specific file
npx playwright test tests/auth.spec.js

# Run in debug mode (pauses on each step)
npm run test:debug
```

## View Report

```bash
npm run report
```

## Test Files

| File | What it covers |
|------|---------------|
| `tests/auth.spec.js` | Login (valid/invalid), register via UI, logout, session persistence, unauthenticated redirect |
| `tests/dashboard.spec.js` | Role-specific dashboard sections and sidebar navigation per role |
| `tests/patients.spec.js` | Patient list (load, search), 3-step registration wizard, patient detail view |
| `tests/appointments.spec.js` | Calendar view, day/week toggle, appointment booking form |
| `tests/ehr-records.spec.js` | Medical records list, create form, view record |
| `tests/billing.spec.js` | Invoice list, mark as paid, create invoice |
| `tests/admin-panel.spec.js` | User table, role filter, deactivate/reactivate, create user |
| `tests/rbac.spec.js` | Role-Based Access Control — each role redirected from forbidden routes |

## Helpers

- **`helpers/auth.js`** — `createUserAndLogin(request, page, { role })` registers a user via API and injects the JWT into localStorage (fast — no UI round-trip).  `loginViaUI(page, email, password)` fills the login form. `logout(page)` clicks the Logout button.

## Configuration

Edit `playwright.config.js` to change:
- `baseURL` — default `http://localhost:5173` (override with `BASE_URL` env var)
- `API_BASE` in `helpers/auth.js` — default `http://localhost:5000/api` (override with `API_BASE` env var)
- `workers: 1` — tests run sequentially to avoid shared-DB conflicts
