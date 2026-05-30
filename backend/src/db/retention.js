require('dotenv').config();
const db = require('./index');
const logger = require('../logger');

/** Histórico de ENTRY/EXIT no Postgres (dias). Arquivo mensal: npm run backup. */
const EVENT_RETENTION_DAYS = Math.max(1, Number(process.env.EVENT_RETENTION_DAYS) || 7);

/** Trilhas brutas em vessel_positions (horas). */
const POSITION_RETENTION_HOURS = Math.max(1, Number(process.env.POSITION_RETENTION_HOURS) || 24);

/** Intervalo entre limpezas automáticas (ms). Padrão: 24 h. */
const RETENTION_INTERVAL_MS = Math.max(
  60 * 60 * 1000,
  Number(process.env.RETENTION_INTERVAL_MS) || 24 * 60 * 60 * 1000,
);

function formatError(err) {
  if (!err) return 'Unknown error';
  return err.message || String(err);
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

  const posRes = await db.query(
    `DELETE FROM vessel_positions WHERE recorded_at < NOW() - make_interval(hours => $1::int)`,
    [POSITION_RETENTION_HOURS],
  );
  const positionsDeleted = posRes.rowCount ?? 0;

  return { eventsDeleted, positionsDeleted };
}

async function runRetentionJob(label = 'scheduled') {
  try {
    const result = await runRetention();
    if (result.skipped) return;
    logger.info(
      `[RETENTION] ${label}: eventos >${EVENT_RETENTION_DAYS}d removidos=${result.eventsDeleted}, ` +
        `posições >${POSITION_RETENTION_HOURS}h removidas=${result.positionsDeleted}`,
    );
  } catch (err) {
    logger.error(`[RETENTION] ${label} falhou:`, formatError(err));
  }
}

function startRetentionSchedule() {
  logger.info(
    `[RETENTION] Política ativa — eventos: ${EVENT_RETENTION_DAYS} dias, ` +
      `posições: ${POSITION_RETENTION_HOURS} h, ciclo: ${Math.round(RETENTION_INTERVAL_MS / 3600000)} h`,
  );
  void runRetentionJob('startup');
  return setInterval(() => runRetentionJob('scheduled'), RETENTION_INTERVAL_MS);
}

module.exports = {
  runRetention,
  runRetentionJob,
  startRetentionSchedule,
  EVENT_RETENTION_DAYS,
  POSITION_RETENTION_HOURS,
};

if (require.main === module) {
  runRetentionJob('manual')
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
