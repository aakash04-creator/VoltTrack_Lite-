# VoltTrack Lite – Electricity Consumption & Theft Risk Monitoring

A college capstone project for electricity consumption monitoring and explainable theft-risk intelligence. VoltTrack uses clear, configurable rules to flag unusual consumption patterns and prioritize field investigations without requiring smart meters or black-box machine learning. 

Available as both a **Cloud Web Application** and a **Native Desktop Application** (macOS & Windows).

## Features

- **JWT Authentication & RBAC:** Secure login and registration with ADMIN and USER roles; admins manage all meters while operators monitor assigned sectors.
- **Meter Registry & Validation:** Monthly reading entry, validation bounds, and bulk CSV import with per-row validation feedback.
- **Explainable Risk Engine:** Monthly risk scoring dashboard, risk distribution filters, meter historical timelines, and investigation notes.
- **Cross-Platform Desktop Client:** Native Electron desktop application with OS-level window controls, native file dialogs, and offline-ready architecture.
- **Data Export:** Instant risk report CSV exports and downloadable meter reading templates.
- **Cloud-Ready Database:** PostgreSQL database initialized automatically on first run; batch seed script creates 30 utility meters with 12 months of readings.

## Tech stack

- **Frontend & Desktop:** React 18, Vite 6, Electron, Electron Builder, React Router DOM (Dual BrowserRouter/HashRouter), Tailwind CSS, Recharts, Lucide Icons, Axios.
- **Backend & Database:** Express 4, PostgreSQL (`pg`), JSON Web Tokens (JWT), bcrypt, Multer, csv-parse, Jest.

## Project structure

```text
frontend/       React 18 + Vite UI (shared by web and desktop)
Backend/        Express API, PostgreSQL database schema, seed, and risk engine
electron/       Native Electron main process, secure preload bridge, and app icons
Script/         Local web and desktop development runners
release/        Compiled native installers (.dmg, .app, .exe) [git-ignored]
```

## Architecture

```mermaid
flowchart LR
  subgraph Clients["Clients"]
    Browser["Web Browser (Vercel)"]
    Desktop["Desktop App (Electron)"]
  end

  subgraph Cloud["Backend Services"]
    API["Express REST API (Render)"]
    Auth["JWT Auth Middleware"]
    Engine["Rule-Based Risk Engine"]
    DB[("PostgreSQL Database (Neon Cloud)")]
  end

  Browser -->|HTTPS / JSON + JWT| API
  Desktop -->|IPC Bridge & HTTPS| API
  API --> Auth
  API --> Engine
  API --> DB
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

---

## Desktop Application (Electron)

VoltTrack Lite can be run and packaged as a standalone desktop application with zero modifications to the web platform.

### Desktop Installation Guide

#### macOS Installation (.dmg)
1. Locate or build the disk image: `release/VoltTrack Lite-1.0.0-arm64.dmg`.
2. Double-click the `.dmg` file to mount the installer.
3. Drag **VoltTrack Lite** into your **Applications** folder.
4. **First Launch Note (Gatekeeper):**  
   Since local capstone builds do not contain a paid Apple Developer ID certificate, macOS may prompt an *"unidentified developer"* notice. To allow:
   - Right-click **VoltTrack Lite** in `/Applications` → click **Open** → click **Open** again.
   - *Or run via Terminal:*
     ```bash
     xattr -cr "/Applications/VoltTrack Lite.app"
     ```

#### Windows Installation (.exe)
1. Run `npm run electron:build:win` to generate the NSIS installer: `release/VoltTrack Lite Setup 1.0.0.exe`.
2. Double-click the `.exe` installer and follow the setup wizard.
3. Launch from the desktop shortcut or Start Menu.

### Desktop Development Commands

| Command | Action |
| :--- | :--- |
| `npm run electron:dev` | Launches Vite dev server and opens native Electron window with live hot-reloading |
| `npm run electron:build` | Compiles the React application and packages desktop installers for the current OS |
| `npm run electron:build:mac` | Builds the macOS `.dmg` and `.zip` installer bundles |
| `npm run electron:build:win` | Builds the Windows `.exe` (NSIS setup wizard and portable) |
| `npm run electron:build:dir` | Unpacks a ready-to-test `.app` or folder without packaging a full installer |

---

## Web Application & Local Development

Requires Node.js 18 or newer and PostgreSQL.

### 1. Environment Setup
Copy `.env.example` to `.env` and set your database connection:
```env
PORT=5000
JWT_SECRET=volttrack-dev-secret-key-2025
DATABASE_URL=postgresql://user:password@localhost:5432/volttrack_lite
VITE_API_URL=https://volttrack-lite.onrender.com/api
```

### 2. Install & Seed
```bash
npm install
npm run seed
```
Demo accounts:
- **Administrator:** `admin@volttrack.com` / `admin123`
- **Operator:** `demo@volttrack.com` / `demo123`

### 3. Run Web Locally
```bash
npm run dev
```
The combined runner checks port availability, starts the Express backend and the Vite frontend concurrently, and opens `http://localhost:5173`. Run `npm test` to execute the automated risk engine test suite.

---

## Risk scoring

Each month is compared with the preceding month, the average of up to three earlier readings, same-type meters in that month, and (for commercial and industrial meters) a simple sanctioned-load expectation of `kW × 30 days × 4 hours`. Default triggers are a drop greater than 40%, a rise greater than 60%, zero usage while active, below 10% of expected usage, three consecutive monthly declines, or more than two peer-group standard deviations. Their weights are 30, 10, 25, 15, 10, and 20 points respectively. The sum is capped at 100: 0–30 LOW, 31–60 MEDIUM, 61–100 HIGH. Settings are editable by admins. Every result includes flags and plain-language reasons; this is a screening aid, not a determination of theft.

## API

All endpoints except `/api/health`, `/api/auth/login`, and `/api/auth/register` require a Bearer JWT.

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Meters:** `GET/POST /api/meters`, `GET/PUT/DELETE /api/meters/:id`, `PUT /api/meters/:id/investigation`
- **Readings:** `GET/POST /api/readings`, `PUT/DELETE /api/readings/:id`, `POST /api/readings/upload`
- **Analysis:** `POST /api/analysis/run`, `GET /api/analysis`, `GET /api/dashboard/summary`
- **Settings:** `GET/PUT /api/settings`
- **Reports:** `GET /api/reports/export?month=YYYY-MM&format=csv`

## Future scope

- Local offline SQLite fallback engine with bidirectional cloud sync.
- Automated PDF report generation with signature verification.
- Direct IoT smart meter ingestion protocols (MQTT / Modbus).
