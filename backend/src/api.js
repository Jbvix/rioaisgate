const express = require('express');
const db = require('./db');
const logger = require('./logger');
const { getActiveVessels, shipTypeLabel } = require('./vesselTracker');
const { isConnected, getStatus, setEnabled } = require('./aisstream');

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
  res.status(500).json({ error: message });
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

// Health completo — DB com timeout curto para não travar o gateway (502)
router.get('/health', async (_req, res) => {
  let dbOk = false;
  let dbError = null;
  if (!db.isConfigured()) {
    dbError = 'DATABASE_URL is not configured';
  } else {
    try {
      await Promise.race([
        db.ping(),
        new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error(`Database ping timeout (${HEALTH_DB_TIMEOUT_MS}ms)`)),
            HEALTH_DB_TIMEOUT_MS,
          );
        }),
      ]);
      dbOk = true;
    } catch (err) {
      dbError = formatError(err);
    }
  }
  res.status(200).json({
    ok: true,
    aisstream: isConnected(),
    vessels: getActiveVessels().length,
    db: dbOk,
    dbError,
    ts: new Date().toISOString(),
  });
});

router.get('/aisstream/status', (_req, res) => {
  res.json({
    ...getStatus(),
    active_vessels: getActiveVessels().length,
    api_key_set: Boolean(process.env.AISSTREAM_API_KEY),
  });
});

router.post('/aisstream/toggle', (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be boolean' });
  }
  setEnabled(enabled);
  return res.json(getStatus());
});

// Active vessels (in-memory, last 30 min)
router.get('/vessels', (_req, res) => {
  res.json(getActiveVessels());
});

// Recent crossing events
router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
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
router.get('/stats/daily', async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 7, 90);
    const [rows, metaRow] = await Promise.all([
      db.getDailyStats(days),
      db.getDailyStatsMeta(days),
    ]);
    res.json({
      rows,
      meta: {
        daysRequested: days,
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
router.get('/vessels/:mmsi/history', async (req, res) => {
  try {
    const { mmsi } = req.params;
    if (!/^\d{9}$/.test(mmsi)) return res.status(400).json({ error: 'MMSI inválido' });
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db.getVesselHistory(mmsi, limit);
    res.json(rows.map(r => ({ ...r, ship_type_label: shipTypeLabel(r.ship_type) })));
  } catch (err) {
    handleApiError(res, 'vessels/:mmsi/history', err);
  }
});

module.exports = router;
