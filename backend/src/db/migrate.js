require('dotenv').config();
const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// Safety timeout — kill the process if migration hangs for more than 30s
// ---------------------------------------------------------------------------
const TIMEOUT_MS = 30_000;
const timeout = setTimeout(() => {
  process.stderr.write('[migrate] ERROR: Timed out after ' + TIMEOUT_MS + 'ms — process did not finish.\n');
  process.exit(1);
}, TIMEOUT_MS);
// Don't let this timer keep the event loop alive if we finish normally
timeout.unref();

// ---------------------------------------------------------------------------
// Log the connection target (host + port only — never log the password)
// ---------------------------------------------------------------------------
const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  process.stderr.write('[migrate] ERROR: DATABASE_URL is not set or is empty.\n');
  process.exit(1);
}

try {
  const parsed = new URL(rawUrl);
  process.stderr.write(
    `[migrate] Connecting to ${parsed.hostname}:${parsed.port || 5432} ` +
    `(database: ${parsed.pathname.replace('/', '') || '<default>'}) ...\n`
  );
} catch (_) {
  process.stderr.write('[migrate] WARNING: DATABASE_URL is set but could not be parsed as a URL.\n');
}

// ---------------------------------------------------------------------------
// Pool — mirror the SSL logic used in src/db/index.js
// ---------------------------------------------------------------------------
const pool = new Pool({
  connectionString: rawUrl,
  ssl: rawUrl.includes('railway') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  connectionTimeoutMillis: 10_000,
});

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
CREATE OR REPLACE FUNCTION prune_old_positions() RETURNS void AS $
  DELETE FROM vessel_positions WHERE recorded_at < NOW() - INTERVAL '24 hours';
$ LANGUAGE sql;
`;

(async () => {
  try {
    await pool.query(sql);
    process.stderr.write('[migrate] Migration completed successfully.\n');
    console.log('Migration completed successfully.');
  } catch (err) {
    process.stderr.write('[migrate] ERROR: Migration failed.\n');
    process.stderr.write('[migrate] Message  : ' + (err.message || String(err)) + '\n');
    process.stderr.write('[migrate] Code     : ' + (err.code     || 'n/a') + '\n');
    process.stderr.write('[migrate] Severity : ' + (err.severity || 'n/a') + '\n');
    process.stderr.write('[migrate] Detail   : ' + (err.detail   || 'n/a') + '\n');
    process.stderr.write('[migrate] Hint     : ' + (err.hint     || 'n/a') + '\n');
    if (err.stack) {
      process.stderr.write('[migrate] Stack    :\n' + err.stack + '\n');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
