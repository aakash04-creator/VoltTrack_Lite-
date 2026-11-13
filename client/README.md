# VoltTrack Lite frontend

React + Vite frontend for the VoltTrack Lite electricity monitoring demo.

## Setup

From the repository root:

```bash
npm install
npm run seed
npm run dev
```

Open `http://localhost:5173`. The root `npm run dev` starts the Express API on port 5000 and the Vite client. If port 5000 is unavailable, the combined script falls back to port 5001 automatically. To use a different API origin, copy `client/.env.example` to `client/.env` and set `VITE_API_URL`.

Demo administrator: `admin@volttrack.com` / `admin123`. Demo operator: `demo@volttrack.com` / `demo123`.

Frontend-only commands from the repository root:

```bash
npm run build
npm run preview
```

## API integration notes

The client uses the existing Express routes and tolerates both direct JSON payloads and `{ success, data, message }` envelopes. The checked-in server currently returns direct payloads, defaults to port 3000 unless the combined dev script selects another available port, and does not implement `/reports/sample-template` or `/analysis/meter/:meterId`. The client uses meter detail plus local rolling-average calculations for the meter analysis view, and falls back to the checked-in sample CSV when the template endpoint is unavailable. The server currently exposes threshold settings only; flag weights are shown as server-defined values.

## Screenshots

_Add screenshots of the dashboard, meter details, CSV import summary, and reports here._
