const express = require('express');
const db = require('./db');
const { getActiveVessels, shipTypeLabel } = require('./vesselTracker');
const { isConnected } = require('./aisstream');

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
  console.error(`[API] ${label}: ${message}`);
  res.status(500).json({ error: message });
}

// Health
router.get('/health', (_req, res) => {
  res.json({ ok: true, aisstream: isConnected(), ts: new Date().toISOString() });
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
    const rows = await db.getDailyStats(days);
    res.json(rows);
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
