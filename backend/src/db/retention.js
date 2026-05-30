require('dotenv').config();
const db = require('./index');
const logger = require('../logger');

/** Histórico de ENTRY/EXIT no Postgres (dias). Arquivo mensal: npm run backup. */
const EVENT_RETENTION_DAYS = Math.max(1, Number(process.env.EVENT_RETENTION_DAYS) || 7);

/** Trilhas brutas em vessel_positions (horas). */
const POSITION_RETENTION_HOURS = Math.max(1, Number(process.env.POSITION_RETENTION_HOURS) || 6);

/** Teto de linhas em vessel_positions (0 = sem teto). */
const POSITION_MAX_ROWS = Math.max(0, Number(process.env.POSITION_MAX_ROWS) || 8000);

/** Intervalo entre limpezas automáticas (ms). Padrão: 6 h. */
const RETENTION_INTERVAL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.RETENTION_INTERVAL_MS) || 6 * 60 * 60 * 1000,
);

/** Limpeza só de posições (mais frequente que o job completo). Padrão: 30 min. */
const POSITION_PRUNE_INTERVAL_MS = Math.max(
  5 * 60 * 1000,
  Number(process.env.POSITION_PRUNE_INTERVAL_MS) || 30 * 60 * 1000,
);

function formatError(err) {
  if (!err) return 'Unknown error';
  return err.message || String(err);
}

async function pruneOldPositions() {
  const posRes = await db.query(
    `DELETE FROM vessel_positions WHERE recorded_at < NOW() - make_interval(hours => $1::int)`,
    [POSITION_RETENTION_HOURS],
  );
  return posRes.rowCount ?? 0;
}

/** Remove as linhas mais antigas se a tabela passar do teto (proteção contra pico / restart). */
async function capPositionRows() {
  if (POSITION_MAX_ROWS <= 0) return 0;
  const countRes = await db.query('SELECT COUNT(*)::bigint AS n FROM vessel_positions');
  const total = Number(countRes.rows[0]?.n ?? 0);
  if (total <= POSITION_MAX_ROWS) return 0;
  const excess = total - POSITION_MAX_ROWS;
  const capRes = await db.query(
    `DELETE FROM vessel_positions
     WHERE ctid IN (
       SELECT ctid FROM vessel_positions
       ORDER BY recorded_at ASC
       LIMIT $1::int
     )`,
    [excess],
  );
  return capRes.rowCount ?? 0;
}

async function runPositionPrune(label = 'positions') {
  if (!db.isConfigured()) return { skipped: true };
  const byAge = await pruneOldPositions();
  const byCap = await capPositionRows();
  return { positionsDeleted: byAge, positionsCapped: byCap, label };
}

async function runRetention() {
  if (!db.isConfigured()) {
    logger.warn('[RETENTION] DATABASE_URL não configurada — limpeza ignorada.');
    return { skipped: true };
  }

  const eventsRes = await db.query(
    `DELETE FROM vessel_events WHERE occurred_at < NOW() - make_interval(days => $1::int)`,
    [EVENT_RETENTION_DAYS],
  );
  const eventsDeleted = eventsRes.rowCount ?? 0;

  const posResult = await runPositionPrune('full');
  const positionsDeleted = (posResult.positionsDeleted ?? 0) + (posResult.positionsCapped ?? 0);

  return { eventsDeleted, positionsDeleted, positionsByAge: posResult.positionsDeleted, positionsCapped: posResult.positionsCapped };
}

async function runRetentionJob(label = 'scheduled') {
  try {
    const result = await runRetention();
    if (result.skipped) return;
    logger.info(
      `[RETENTION] ${label}: eventos >${EVENT_RETENTION_DAYS}d removidos=${result.eventsDeleted}, ` +
        `posições idade>${POSITION_RETENTION_HOURS}h=${result.positionsByAge ?? result.positionsDeleted}, ` +
        `teto ${POSITION_MAX_ROWS}=${result.positionsCapped ?? 0}`,
    );
  } catch (err) {
    logger.error(`[RETENTION] ${label} falhou:`, formatError(err));
  }
}

async function runPositionPruneJob(label = 'positions') {
  try {
    const result = await runPositionPrune(label);
    if (result.skipped) return;
    if ((result.positionsDeleted ?? 0) + (result.positionsCapped ?? 0) > 0) {
      logger.info(
        `[RETENTION] ${label}: posições idade>${POSITION_RETENTION_HOURS}h=${result.positionsDeleted}, ` +
          `teto ${POSITION_MAX_ROWS}=${result.positionsCapped}`,
      );
    }
  } catch (err) {
    logger.error(`[RETENTION] ${label} falhou:`, formatError(err));
  }
}

function startRetentionSchedule() {
  logger.info(
    `[RETENTION] Política ativa — eventos: ${EVENT_RETENTION_DAYS} dias, ` +
      `posições: ${POSITION_RETENTION_HOURS} h (máx ${POSITION_MAX_ROWS} linhas), ` +
      `ciclo completo: ${Math.round(RETENTION_INTERVAL_MS / 3600000)} h, ` +
      `posições a cada ${Math.round(POSITION_PRUNE_INTERVAL_MS / 60000)} min`,
  );
  void runRetentionJob('startup');
  void runPositionPruneJob('startup-positions');
  setInterval(() => runPositionPruneJob('scheduled-positions'), POSITION_PRUNE_INTERVAL_MS);
  return setInterval(() => runRetentionJob('scheduled'), RETENTION_INTERVAL_MS);
}

module.exports = {
  runRetention,
  runRetentionJob,
  runPositionPrune,
  runPositionPruneJob,
  startRetentionSchedule,
  EVENT_RETENTION_DAYS,
  POSITION_RETENTION_HOURS,
  POSITION_MAX_ROWS,
};

if (require.main === module) {
  runRetentionJob('manual')
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
