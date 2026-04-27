require('dotenv').config();
const { Pool } = require('pg');

function buildPoolConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const needsSsl =
    connectionString.includes('railway') ||
    process.env.NODE_ENV === 'production';

  return {
    connectionString,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 15000,
  };
}

function formatDbError(err) {
  if (!err) return 'Unknown error';
  return [
    err.message,
    err.code ? `code=${err.code}` : null,
    err.severity ? `severity=${err.severity}` : null,
    err.detail ? `detail=${err.detail}` : null,
    err.hint ? `hint=${err.hint}` : null,
  ].filter(Boolean).join(' | ');
}

const pool = new Pool(buildPoolConfig());

const sql = `
CREATE TABLE IF NOT EXISTS vessels (
  mmsi        VARCHAR(9)   PRIMARY KEY,
  name        VARCHAR(255),
  ship_type   INTEGER,
  flag        VARCHAR(4),
  imo         VARCHAR(10),
  callsign    VARCHAR(10),
  length      NUMERIC,
  width       NUMERIC,
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vessel_events (
  id          BIGSERIAL    PRIMARY KEY,
  mmsi        VARCHAR(9)   NOT NULL,
  event_type  VARCHAR(10)  NOT NULL CHECK (event_type IN ('ENTRY','EXIT')),
  lat         NUMERIC(10,6) NOT NULL,
  lon         NUMERIC(10,6) NOT NULL,
  speed       NUMERIC(5,1),
  heading     SMALLINT,
  occurred_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessel_events_mmsi       ON vessel_events(mmsi);
CREATE INDEX IF NOT EXISTS idx_vessel_events_occurred_at ON vessel_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_vessel_events_type        ON vessel_events(event_type);

CREATE TABLE IF NOT EXISTS vessel_positions (
  mmsi        VARCHAR(9)   NOT NULL,
  lat         NUMERIC(10,6) NOT NULL,
  lon         NUMERIC(10,6) NOT NULL,
  speed       NUMERIC(5,1),
  heading     SMALLINT,
  course      NUMERIC(5,1),
  nav_status  SMALLINT,
  recorded_at TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessel_positions_mmsi ON vessel_positions(mmsi);
CREATE INDEX IF NOT EXISTS idx_vessel_positions_time ON vessel_positions(recorded_at DESC);

-- Keep only last 24h of raw positions (cleanup via cron or trigger)
CREATE OR REPLACE FUNCTION prune_old_positions() RETURNS void AS $$
  DELETE FROM vessel_positions WHERE recorded_at < NOW() - INTERVAL '24 hours';
$$ LANGUAGE sql;
`;

(async () => {
  const timeout = setTimeout(() => {
    console.error('Migration timeout after 30s');
    process.exit(1);
  }, 30000);

  try {
    await pool.query('SELECT 1');
    await pool.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', formatDbError(err));
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
    await pool.end();
  }
})();
