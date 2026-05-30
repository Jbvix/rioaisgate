require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const { buildPoolConfig } = require('../src/db/poolConfig');

(async () => {
  const pool = new Pool(buildPoolConfig());
  const total = await pool.query('SELECT COUNT(*)::bigint AS n FROM vessel_positions');
  const span = await pool.query(`
    SELECT MIN(recorded_at) AS min_at, MAX(recorded_at) AS max_at,
           COUNT(DISTINCT mmsi)::int AS vessels
    FROM vessel_positions`);
  const perHour = await pool.query(`
    SELECT DATE_TRUNC('hour', recorded_at) AS h, COUNT(*)::bigint AS n
    FROM vessel_positions
    GROUP BY 1 ORDER BY 1 DESC LIMIT 5`);
  console.log(JSON.stringify({ total: total.rows[0].n, span: span.rows[0], topHours: perHour.rows }, null, 2));
  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
