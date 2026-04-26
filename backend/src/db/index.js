const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => console.error('DB pool error:', err.message));

const db = {
  query: (text, params) => pool.query(text, params),

  async upsertVessel({ mmsi, name, ship_type, flag, imo, callsign, length, width }) {
    await pool.query(
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
      [mmsi, name, ship_type, flag, imo, callsign, length, width]
    );
  },

  async recordEvent({ mmsi, event_type, lat, lon, speed, heading }) {
    const res = await pool.query(
      `INSERT INTO vessel_events (mmsi, event_type, lat, lon, speed, heading, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW()) RETURNING *`,
      [mmsi, event_type, lat, lon, speed, heading]
    );
    return res.rows[0];
  },

  async savePosition({ mmsi, lat, lon, speed, heading, course, nav_status }) {
    await pool.query(
      `INSERT INTO vessel_positions (mmsi, lat, lon, speed, heading, course, nav_status, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
      [mmsi, lat, lon, speed, heading, course, nav_status]
    );
  },

  async getRecentEvents(limit = 100) {
    const res = await pool.query(
      `SELECT e.*, v.name, v.ship_type, v.flag
       FROM vessel_events e
       LEFT JOIN vessels v USING(mmsi)
       ORDER BY e.occurred_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.rows;
  },

  async getDailyStats(days = 7) {
    const res = await pool.query(
      `SELECT
         DATE_TRUNC('day', occurred_at) AS day,
         event_type,
         COUNT(*) AS count
       FROM vessel_events
       WHERE occurred_at > NOW() - ($1 || ' days')::INTERVAL
       GROUP BY 1, 2
       ORDER BY 1`,
      [days]
    );
    return res.rows;
  },

  async getHourlyStats() {
    const res = await pool.query(
      `SELECT
         EXTRACT(HOUR FROM occurred_at)::INT AS hour,
         event_type,
         COUNT(*) AS count
       FROM vessel_events
       WHERE occurred_at > NOW() - INTERVAL '30 days'
       GROUP BY 1, 2
       ORDER BY 1`
    );
    return res.rows;
  },

  async getShipTypeStats() {
    const res = await pool.query(
      `SELECT
         v.ship_type,
         e.event_type,
         COUNT(*) AS count
       FROM vessel_events e
       LEFT JOIN vessels v USING(mmsi)
       WHERE e.occurred_at > NOW() - INTERVAL '30 days'
       GROUP BY 1, 2
       ORDER BY 3 DESC`
    );
    return res.rows;
  },

  async getVesselHistory(mmsi, limit = 50) {
    const res = await pool.query(
      `SELECT e.*, v.name, v.ship_type, v.flag
       FROM vessel_events e
       LEFT JOIN vessels v USING(mmsi)
       WHERE e.mmsi = $1
       ORDER BY e.occurred_at DESC
       LIMIT $2`,
      [mmsi, limit]
    );
    return res.rows;
  },

  async getTodaySummary() {
    const res = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'ENTRY') AS entries,
         COUNT(*) FILTER (WHERE event_type = 'EXIT')  AS exits,
         COUNT(DISTINCT mmsi) AS unique_vessels
       FROM vessel_events
       WHERE occurred_at >= CURRENT_DATE`
    );
    return res.rows[0];
  },
};

module.exports = db;
