# VoltTrack Lite backend

A beginner-friendly Express and PostgreSQL API for monthly electricity meter readings.
The current backend foundation includes meter and reading CRUD only. Risk scoring,
anomaly detection, uploads, and authentication are not included.

## Setup

1. Install Node.js and PostgreSQL.
2. Create a PostgreSQL database (for example, `volttrack_lite`).
3. Copy `.env.example` to `.env` and set your database credentials.
4. Run `npm install`.
5. Run `npm run dev` for development or `npm start` for normal startup.

The server syncs the Sequelize models when it starts. The health endpoint is
`GET http://localhost:3000/api/health`.

## API endpoints

- `GET /api/health`
- `POST /api/meters`, `GET /api/meters`, `GET /api/meters/:id`
- `PUT /api/meters/:id`, `DELETE /api/meters/:id`
- `POST /api/meters/:id/readings`, `GET /api/meters/:id/readings`
- `DELETE /api/readings/:id`

JSON request bodies are expected for create and update requests.
