const { Pool } = require('pg');
const logger = require('../logger');
const { buildPoolConfig } = require('./poolConfig');

const QUERY_TIMEOUT_MS = 15000;
const poolConfig = buildPoolConfig({ statementTimeoutMs: QUERY_TIMEOUT_MS });
const pool = poolConfig ? new Pool(poolConfig) : null;

function formatDbError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  return [
    err.message,
    err.code ? `code=${err.code}` : null,
    err.severity ? `severity=${err.severity}` : null,
    err.table ? `table=${err.table}` : null,
    err.constraint ? `constraint=${err.constraint}` : null,
    err.detail ? `detail=${err.detail}` : null,
  ].filter(Boolean).join(' | ');
}

function withQueryTimeout(promise) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error(`Database query timeout (${QUERY_TIMEOUT_MS}ms)`), { code: 'ETIMEDOUT' }));
    }, QUERY_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function query(text, params) {
  if (!pool) {
    return Promise.reject(new Error('DATABASE_URL is not configured'));
  }
  return withQueryTimeout(pool.query(text, params));
}

if (!pool) {
  logger.error('[DB] DATABASE_URL is not set — events/stats API will return errors');
} else {
  pool.on('error', (err) => logger.error('DB pool error:', formatDbError(err)));

  (async () => {
    try {
      await query('SELECT 1');
      logger.info('[DB] Connection OK');
      const res = await query(`
        SELECT
          to_regclass('public.vessels') AS vessels,
          to_regclass('public.vessel_events') AS vessel_events,
          to_regclass('public.vessel_positions') AS vessel_positions
      `);
      const row = res.rows[0] || {};
      const missing = ['vessels', 'vessel_events', 'vessel_positions'].filter((k) => !row[k]);
      if (missing.length > 0) {
        logger.error(`[DB] Missing tables: ${missing.join(', ')}. Run migrations.`);
      } else {
        logger.info('[DB] Schema check OK.');
      }
    } catch (err) {
      logger.error('[DB] Startup check failed:', formatDbError(err));
    }
  })();
}

const db = {
  query,

  async upsertVessel({ mmsi, name, ship_type, flag, imo, callsign, length, width }) {
    await query(
      `INSERT INTO vessels (mmsi, name, ship_type, flag, imo, callsign, length, width, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (mmsi) DO UPDATE SET
         name       = COALESCE(EXCLUDED.name, vessels.name),
         ship_type  = COALESCE(EXCLUDED.ship_type, vessels.ship_type),
         flag       = COALESCE(EXCLUDED.flag, vessels.flag),
         imo        = COALESCE(EXCLUDED.imo, vessels.imo),
         callsign   = COALESCE(EXCLUDED.callsign, vessels.callsign),
         length     = COALESCE(EXCLUDED.length, vessels.length),
         width      = COALESCE(EXCLUDED.width, vessels.width),
         updated_at = NOW()`,
      [mmsi, name, ship_type, flag, imo, callsign, length, width],
    );
  },

  async recordEvent({ mmsi, event_type, lat, lon, speed, heading }) {
    const res = await query(
      `INSERT INTO vessel_events (mmsi, event_type, lat, lon, speed, heading, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [mmsi, event_type, lat, lon, speed, heading],
    );
    return res.rows[0];
  },

  async savePosition({ mmsi, lat, lon, speed, heading, course, nav_status }) {
    await query(
      `INSERT INTO vessel_positions (mmsi, lat, lon, speed, heading, course, nav_status, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [mmsi, lat, lon, speed, heading, course, nav_status],
    );
  },

  async getRecentEvents(limit = 100) {
    const res = await query(
      `SELECT e.*, v.name, v.ship_type, v.flag
       FROM vessel_events e
       LEFT JOIN vessels v USING(mmsi)
       ORDER BY e.occurred_at DESC
       LIMIT $1`,
      [limit],
    );
    return res.rows;
  },

  async getDailyStats(days = 7) {
    const res = await query(
      `SELECT
         DATE_TRUNC('day', occurred_at) AS day,
         event_type,
         COUNT(*) AS count
       FROM vessel_events
       WHERE occurred_at > NOW() - ($1 || ' days')::INTERVAL
       GROUP BY 1, 2
       ORDER BY 1`,
      [days],
    );
    return res.rows;
  },

  async getHourlyStats() {
    const res = await query(
      `SELECT
         EXTRACT(HOUR FROM occurred_at)::INT AS hour,
         event_type,
         COUNT(*) AS count
       FROM vessel_events
       WHERE occurred_at > NOW() - INTERVAL '30 days'
       GROUP BY 1, 2
       ORDER BY 1`,
    );
    return res.rows;
  },

  async getShipTypeStats() {
    const res = await query(
      `SELECT
         v.ship_type,
         e.event_type,
         COUNT(*) AS count
       FROM vessel_events e
       LEFT JOIN vessels v USING(mmsi)
       WHERE e.occurred_at > NOW() - INTERVAL '30 days'
       GROUP BY 1, 2
       ORDER BY 3 DESC`,
    );
    return res.rows;
  },

  async getVesselHistory(mmsi, limit = 50) {
    const res = await query(
      `SELECT e.*, v.name, v.ship_type, v.flag
       FROM vessel_events e
       LEFT JOIN vessels v USING(mmsi)
       WHERE e.mmsi = $1
       ORDER BY e.occurred_at DESC
       LIMIT $2`,
      [mmsi, limit],
    );
    return res.rows;
  },

  async getTodaySummary() {
    const res = await query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'ENTRY') AS entries,
         COUNT(*) FILTER (WHERE event_type = 'EXIT')  AS exits,
         COUNT(DISTINCT mmsi) AS unique_vessels
       FROM vessel_events
       WHERE occurred_at >= CURRENT_DATE`,
    );
    return res.rows[0];
  },

  async ping() {
    await query('SELECT 1');
    return true;
  },

  isConfigured: () => Boolean(pool),
};

module.exports = db;
