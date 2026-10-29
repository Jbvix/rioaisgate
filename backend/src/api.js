const express = require('express');
const db = require('./db');
const logger = require('./logger');
const { getActiveVessels, shipTypeLabel } = require('./vesselTracker');
const { isConnected, getStatus, setEnabled } = require('./aisstream');

const { requireControlPin } = require('./aisControl');
const router = express.Router();

function formatError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;

  if (Array.isArray(err.errors) && err.errors.length > 0) {
    const nested = err.errors
      .map((e) => [e.message, e.code].filter(Boolean).join(' '))
      .filter(Boolean)
      .join(' | ');
    if (nested) return nested;
  }

  return [
    err.message,
    err.code ? `code=${err.code}` : null,
    err.detail ? `detail=${err.detail}` : null,
    err.hint ? `hint=${err.hint}` : null,
  ].filter(Boolean).join(' | ') || JSON.stringify(err);
}

function handleApiError(res, label, err) {
  const message = formatError(err);
  logger.error(`[API] ${label}: ${message}`);
  res.status(500).json({ error: 'Não foi possível concluir a solicitação.' });
}

const HEALTH_DB_TIMEOUT_MS = 3000;

// Liveness — responde rápido (Railway healthcheck); não espera Postgres
router.get('/health/live', (_req, res) => {
  res.status(200).json({
    ok: true,
    aisstream: isConnected(),
    vessels: getActiveVessels().length,
    ts: new Date().toISOString(),
  });
});

// Readiness: dependency failures must be visible to deployment monitors.
router.get('/health', async (_req, res) => {
  let dbOk = false;
  let timer;
  try {
    if (!db.isConfigured()) throw new Error('Database is not configured');
    await Promise.race([
      db.ping(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database ping timeout')), HEALTH_DB_TIMEOUT_MS);
      }),
    ]);
    dbOk = true;
  } catch (err) {
    logger.error(`[HEALTH] ${formatError(err)}`);
  } finally {
    clearTimeout(timer);
  }
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk, db: dbOk, dbError: dbOk ? null : 'Banco de dados indisponível.',
    aisstream: isConnected(), vessels: getActiveVessels().length,
    ts: new Date().toISOString(),
  });
});

function positiveInteger(req, res, next) {
  for (const [name, fallback, max] of req.path === '/stats/daily'
    ? [['days', 7, 90]]
    : [['limit', req.params.mmsi ? 50 : 100, req.params.mmsi ? 200 : 500]]) {
    const raw = req.query[name];
    if (raw === undefined) { req.validated = { [name]: fallback }; continue; }
    if (typeof raw !== 'string' || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < 1 || Number(raw) > max) {
      return res.status(400).json({ error: `${name} deve ser um inteiro entre 1 e ${max}.` });
    }
    req.validated = { [name]: Number(raw) };
  }
  next();
}

router.get('/aisstream/status', (_req, res) => {
  res.json({
    ...getStatus(),
    active_vessels: getActiveVessels().length,
    api_key_set: Boolean(process.env.AISSTREAM_API_KEY),
  });
});

// The PIN is checked on every state change and never returned to clients.
router.post('/aisstream/toggle', requireControlPin, (req, res) => {
  if (typeof req.body?.enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled deve ser booleano.' });
  }
  if (req.body.enabled && !process.env.AISSTREAM_API_KEY?.trim()) {
    return res.status(503).json({ error: 'Chave do provedor AIS não configurada.' });
  }
  setEnabled(req.body.enabled);
  res.json({ ...getStatus(), api_key_set: Boolean(process.env.AISSTREAM_API_KEY?.trim()) });
});

// Active vessels (in-memory, last 30 min)
router.get('/vessels', (_req, res) => {
  res.json(getActiveVessels());
});

// Recent crossing events
router.get('/events', positiveInteger, async (req, res) => {
  try {
    const limit = req.validated.limit;
    const rows = await db.getRecentEvents(limit);
    res.json(rows.map(r => ({ ...r, ship_type_label: shipTypeLabel(r.ship_type) })));
  } catch (err) {
    handleApiError(res, 'events', err);
  }
});

// Today's summary
router.get('/stats/today', async (_req, res) => {
  try {
    const summary = await db.getTodaySummary();
    const active = getActiveVessels();
    res.json({
      ...summary,
      active_vessels: active.length,
      inside_bay: active.filter(v => v.insideBay).length,
    });
  } catch (err) {
    handleApiError(res, 'stats/today', err);
  }
});

// Daily traffic for last N days
router.get('/stats/daily', positiveInteger, async (req, res) => {
  try {
    const days = req.validated.days;
    const [rows, metaRow] = await Promise.all([
      db.getDailyStats(days),
      db.getDailyStatsMeta(days),
    ]);
    res.json({
      rows,
      meta: {
        daysRequested: days,
        retentionDays: require('./db/retention').EVENT_RETENTION_DAYS,
        daysWithData: Number(metaRow.days_with_data) || 0,
        dataSince: metaRow.data_since,
      },
    });
  } catch (err) {
    handleApiError(res, 'stats/daily', err);
  }
});

// Hourly distribution (last 30 days)
router.get('/stats/hourly', async (_req, res) => {
  try {
    res.json(await db.getHourlyStats());
  } catch (err) {
    handleApiError(res, 'stats/hourly', err);
  }
});

// Ship type breakdown
router.get('/stats/ship-types', async (_req, res) => {
  try {
    const rows = await db.getShipTypeStats();
    res.json(rows.map(r => ({ ...r, ship_type_label: shipTypeLabel(r.ship_type) })));
  } catch (err) {
    handleApiError(res, 'stats/ship-types', err);
  }
});

// Vessel history by MMSI
router.get('/vessels/:mmsi/history', positiveInteger, async (req, res) => {
  try {
    const { mmsi } = req.params;
    if (!/^\d{9}$/.test(mmsi)) return res.status(400).json({ error: 'MMSI inválido' });
    const limit = req.validated.limit;
    const rows = await db.getVesselHistory(mmsi, limit);
    res.json(rows.map(r => ({ ...r, ship_type_label: shipTypeLabel(r.ship_type) })));
  } catch (err) {
    handleApiError(res, 'vessels/:mmsi/history', err);
  }
});

module.exports = router;
