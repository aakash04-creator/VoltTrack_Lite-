const { Pool } = require('pg');
require('dotenv').config();

const rawConnectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/volttrack_lite';
// Strip channel_binding which is unsupported by node-postgres (pg) and causes connection hangs on Neon
const connectionString = rawConnectionString
  .replace(/([?&])channel_binding=[^&]+(&|$)/g, '$1')
  .replace(/[?&]$/, '');

const isRemoteDb =
  process.env.DATABASE_SSL === 'true' ||
  connectionString.includes('neon.tech') ||
  connectionString.includes('sslmode=require');

const pool = new Pool({
  connectionString,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

const query = (text, params) => pool.query(text, params);

async function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'USER',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS meters (
      id SERIAL PRIMARY KEY,
      meter_id TEXT UNIQUE NOT NULL,
      consumer_name TEXT NOT NULL,
      address TEXT NOT NULL,
      connection_type TEXT NOT NULL,
      sanctioned_load_kw REAL NOT NULL DEFAULT 5,
      status TEXT NOT NULL DEFAULT 'Active',
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      investigation_status TEXT DEFAULT 'Pending',
      investigation_notes TEXT DEFAULT '',
      investigation_updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS readings (
      id SERIAL PRIMARY KEY,
      meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      units_consumed REAL NOT NULL CHECK(units_consumed >= 0),
      reading_date TEXT NOT NULL,
      remarks TEXT DEFAULT '',
      UNIQUE(meter_id, month)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis (
      id SERIAL PRIMARY KEY,
      meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      units_consumed REAL NOT NULL,
      change_percent REAL,
      rolling_avg REAL,
      deviation_percent REAL,
      risk_score INTEGER NOT NULL,
      risk_level TEXT NOT NULL,
      flags JSONB NOT NULL,
      reasons JSONB NOT NULL,
      analyzed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(meter_id, month)
    );
  `;

  await pool.query(schema);

  const defaults = {
    suddenDrop: 40,
    suddenSpike: 60,
    lowForLoadPercent: 10,
    peerStdDev: 2,
  };

  for (const [k, v] of Object.entries(defaults)) {
    await pool.query('INSERT INTO settings(key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [k, v]);
  }
}

module.exports = {
  query,
  pool,
  initDb,
};
