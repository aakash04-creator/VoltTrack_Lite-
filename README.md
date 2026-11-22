# VoltTrack Lite – Electricity Consumption & Theft Risk Monitoring

A local, demo-ready college major project for manually entered monthly electricity readings. VoltTrack uses clear, configurable rules to flag unusual consumption and prioritize investigation. It does not require smart meters or machine learning.

## Features

- JWT login and registration with ADMIN and USER roles; admin can see all meters, users see their own.
- Meter registry and monthly reading entry, validation, and bulk CSV import with per-row feedback.
- Explainable risk engine, monthly dashboard, risk filters, meter history, and investigation notes.
- Risk report CSV export and downloadable import template.
- Selectable PostgreSQL and SQLite backends; both initialize their schemas automatically and support demo data.

## Tech stack

React + Vite, React Router, Axios, Recharts, Express, PostgreSQL (`pg`), SQLite (`better-sqlite3`), JWT, bcrypt, Multer, csv-parse, Jest.

## Project structure

```text
frontend/             React + Vite application
backend/postgres/     Express API backed by PostgreSQL (default)
backend/sqlite/       Express API backed by local SQLite
scripts/              Local development helpers
```

## Architecture

```mermaid
flowchart LR
  Browser[React dashboard] -->|Axios / JSON + JWT| API[Express REST API]
  API --> Auth[Auth middleware]
  API --> Engine[Rule based risk engine]
  API --> DB[(PostgreSQL or SQLite)]
  Seed[Demo seed script] --> DB
```

## Data model

```mermaid
erDiagram
  USERS ||--o{ METERS : creates
  METERS ||--o{ READINGS : records
  METERS ||--o{ ANALYSIS : evaluates
  USERS { int id string email string role }
  METERS { int id string meter_id string consumer_name string connection_type float sanctioned_load_kw }
  READINGS { int id int meter_id string month float units_consumed }
  ANALYSIS { int id int meter_id string month int risk_score string risk_level jsonb flags }
```

## Run locally

Requires Node.js 18 or newer. PostgreSQL is required for the default backend; SQLite runs locally without a database service.

1. Copy `.env.example` to `.env`. For PostgreSQL, set `DATABASE_URL` (e.g. `postgresql://postgres:postgres@localhost:5432/volttrack_lite`).
2. From the repository root, run `npm install`.
3. For PostgreSQL, run `npm run seed`; for SQLite, run `npm run db:init:sqlite` followed by `npm run seed:sqlite`.
4. Start the selected backend and frontend with `npm run dev` (PostgreSQL) or `npm run dev:sqlite` (SQLite), then open [http://localhost:5173](http://localhost:5173).
5. Log in as `admin@volttrack.com` / `admin123` (or `demo@volttrack.com` / `demo123`).

The standalone APIs default to port 3000. The combined launchers use port 5000 when available and fall back to 5001 when it is occupied, then connect the Vite client to the selected API port. PostgreSQL is the default for `npm run dev`; pass `sqlite` through `npm run dev:sqlite` to run the local database. `npm test` runs the risk engine tests.

PostgreSQL implementation and seed script: `backend/postgres/`. SQLite schema, database initialization, and seed script: `backend/sqlite/db/`. The SQLite file defaults to `backend/sqlite/db/volttrack.sqlite` and is excluded from Git; set `DB_PATH` to relocate it. The tracked SQLite schema is safe to apply repeatedly with `npm run db:init:sqlite`.

## Risk scoring

Each month is compared with the preceding month, the average of up to three earlier readings, same-type meters in that month, and (for commercial and industrial meters) a simple sanctioned-load expectation of `kW × 30 days × 4 hours`. Default triggers are a drop greater than 40%, a rise greater than 60%, zero usage while active, below 10% of expected usage, three consecutive monthly declines, or more than two peer-group standard deviations. Their weights are 30, 10, 25, 15, 10, and 20 points respectively. The sum is capped at 100: 0–30 LOW, 31–60 MEDIUM, 61–100 HIGH. Settings are editable by admins. Every result includes flags and plain-language reasons; this is a screening aid, not a determination of theft.

## API

All endpoints except `/api/health` and `/api/auth/login` and `/api/auth/register` need a bearer JWT.

- Auth: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- Meters: `GET/POST /api/meters`, `GET/PUT/DELETE /api/meters/:id`, `PUT /api/meters/:id/investigation`
- Readings: `GET/POST /api/readings`, `PUT/DELETE /api/readings/:id`, `POST /api/readings/upload`
- Analysis and dashboard: `POST /api/analysis/run`, `GET /api/analysis`, `GET /api/dashboard/summary`
- Settings: `GET/PUT /api/settings`
- Reports: `GET /api/reports/export?month=YYYY-MM&format=csv`

## Screenshots

Screenshots can be captured from the running dashboard at `http://localhost:5173`.

## Future scope

PDF reports, stronger account recovery, audit history, utility-scale pagination, and integration with real meter data can be added later.
