require('dotenv').config();
const { Pool } = require('pg');
const logger = require('../logger');
const { buildPoolConfig, resolveConnectionString, connectionHost, needsSsl } = require('./poolConfig');

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

const connectionString = resolveConnectionString();
if (!connectionString) {
  logger.error('Migration failed: set DATABASE_URL or DATABASE_PRIVATE_URL on the backend service.');
  process.exit(1);
}

const usingPrivate = Boolean(process.env.DATABASE_PRIVATE_URL?.trim());
logger.info(
  `[DB] Migrate target host=${connectionHost(connectionString)} ssl=${needsSsl(connectionString)} source=${usingPrivate ? 'DATABASE_PRIVATE_URL' : 'DATABASE_URL'}`,
);

const pool = new Pool(buildPoolConfig({ connectionTimeoutMillis: 30000 }));

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

CREATE TABLE IF NOT EXISTS telegram_subscriptions (
  id           BIGSERIAL PRIMARY KEY,
  chat_id      BIGINT       NOT NULL,
  mmsi         VARCHAR(9)   NOT NULL,
  event_filter VARCHAR(10)  NOT NULL DEFAULT 'BOTH'
               CHECK (event_filter IN ('ENTRY','EXIT','BOTH')),
  active       BOOLEAN      NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE (chat_id, mmsi)
);

CREATE INDEX IF NOT EXISTS idx_telegram_subs_mmsi
  ON telegram_subscriptions(mmsi) WHERE active;
CREATE INDEX IF NOT EXISTS idx_telegram_subs_chat
  ON telegram_subscriptions(chat_id) WHERE active;
`;

(async () => {
  const timeout = setTimeout(() => {
    logger.error('Migration timeout after 60s');
    process.exit(1);
  }, 60000);

  try {
    await pool.query('SELECT 1');
    await pool.query(sql);
    logger.info('Migration completed successfully.');
  } catch (err) {
    logger.error('Migration failed:', formatDbError(err));
    if (err?.stack) logger.error(err.stack);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
    await pool.end();
  }
})();
