CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meters (
  id INTEGER PRIMARY KEY,
  meter_id TEXT UNIQUE NOT NULL,
  consumer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  sanctioned_load_kw REAL NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'Active',
  created_by INTEGER REFERENCES users(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  investigation_status TEXT DEFAULT 'Pending',
  investigation_notes TEXT DEFAULT '',
  investigation_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY,
  meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  units_consumed REAL NOT NULL CHECK (units_consumed >= 0),
  reading_date TEXT NOT NULL,
  remarks TEXT DEFAULT '',
  UNIQUE (meter_id, month)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS analysis (
  id INTEGER PRIMARY KEY,
  meter_id INTEGER NOT NULL REFERENCES meters(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  units_consumed REAL NOT NULL,
  change_percent REAL,
  rolling_avg REAL,
  deviation_percent REAL,
  risk_score INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  flags TEXT NOT NULL,
  reasons TEXT NOT NULL,
  analyzed_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (meter_id, month)
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('suddenDrop', 40),
  ('suddenSpike', 60),
  ('lowForLoadPercent', 10),
  ('peerStdDev', 2);
