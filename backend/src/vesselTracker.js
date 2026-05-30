const { isInsideBay } = require('./geofence');
const db = require('./db');
const { enqueuePosition, enqueueUpsert } = require('./db/writeQueue');
const logger = require('./logger');

const persistPositions = process.env.AIS_SAVE_POSITIONS !== 'false';

/** Leituras AIS consecutivas iguais antes de confirmar dentro/fora (evita jitter na boca da barra). */
const GEOFENCE_CONFIRM_READS = Math.max(2, Number(process.env.GEOFENCE_CONFIRM_READS) || 2);

/** Intervalo mínimo entre eventos ENTRY/EXIT do mesmo MMSI. */
const GEOFENCE_EVENT_COOLDOWN_MS = Number(process.env.GEOFENCE_EVENT_COOLDOWN_MS) || 120_000;

/** Após restart, ignora cruzamentos por este período (evita rajada falsa). */
const GEOFENCE_WARMUP_MS = Number(process.env.GEOFENCE_WARMUP_MS) || 120_000;

const serverStartedAt = Date.now();
const lastGeofenceEventAt = new Map();

// In-memory state: mmsi → { lat, lon, insideBay, insideRaw, insideStreak, ... }
const vessels = new Map();

// Broadcast callback — set by index.js after WS server is ready
let broadcastFn = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

function formatError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.stack) return err.stack;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function broadcast(msg) {
  if (broadcastFn) broadcastFn(msg);
}

async function recordEventAsync(mmsi, event_type, lat, lon, speed, heading, vessel) {
  try {
    const event = await db.recordEvent({ mmsi, event_type, lat, lon, speed, heading });
    broadcast({
      type: 'EVENT',
      event: {
        ...event,
        name: vessel.name || 'N/D',
        ship_type: vessel.ship_type,
        ship_type_label: shipTypeLabel(vessel.ship_type),
        flag: vessel.flag,
      },
    });
    logger.info(
      `[EVENT] ${event_type} | MMSI:${mmsi} | ${vessel.name || 'N/D'} | ${lat.toFixed(4)},${lon.toFixed(4)}`,
    );
  } catch (err) {
    logger.error(`[DB] recordEvent ${mmsi}: ${formatError(err)}`);
  }
}

/**
 * Ship type codes (ITU/IMO AIS)
 */
function shipTypeLabel(code) {
  if (!code) return 'Desconhecido';
  if (code >= 20 && code <= 29) return 'WIG';
  if (code >= 30 && code <= 39) return 'Pesca';
  if (code >= 40 && code <= 49) return 'Alta Velocidade';
  if (code === 50) return 'Prático';
  if (code === 51) return 'SAR';
  if (code === 52) return 'Rebocador';
  if (code === 53) return 'Abastecedor';
  if (code === 54) return 'Anti-poluição';
  if (code === 55) return 'Fiscalização';
  if (code === 58) return 'Médico';
  if (code >= 60 && code <= 69) return 'Passageiros';
  if (code >= 70 && code <= 79) return 'Carga';
  if (code >= 80 && code <= 89) return 'Tanque';
  if (code >= 90 && code <= 99) return 'Outros';
  return 'Desconhecido';
}

function updateStaticData(mmsi, data) {
  const vessel = vessels.get(mmsi) || {};
  vessels.set(mmsi, { ...vessel, mmsi, ...data, lastSeen: Date.now() });
  enqueueUpsert({ mmsi, ...data });
}

function confirmInsideBay(prev, rawInside) {
  if (!prev) return { insideBay: rawInside, insideRaw: rawInside, insideStreak: 1 };
  const streak = prev.insideRaw === rawInside ? (prev.insideStreak || 1) + 1 : 1;
  const insideBay =
    streak >= GEOFENCE_CONFIRM_READS ? rawInside : (prev.insideBay ?? rawInside);
  return { insideBay, insideRaw: rawInside, insideStreak: streak };
}

function updatePosition(mmsi, { lat, lon, speed, heading, course, nav_status }) {
  const prev = vessels.get(mmsi);
  const rawInside = isInsideBay(lat, lon);
  const { insideBay, insideRaw, insideStreak } = confirmInsideBay(prev, rawInside);
  const wasInside = prev ? prev.insideBay : null;

  const updated = {
    ...(prev || {}),
    mmsi,
    lat,
    lon,
    speed,
    heading,
    course,
    nav_status,
    insideBay,
    insideRaw,
    insideStreak,
    lastSeen: Date.now(),
  };
  vessels.set(mmsi, updated);

  if (persistPositions) {
    enqueuePosition({ mmsi, lat, lon, speed, heading, course, nav_status });
  }

  const warmupDone = Date.now() - serverStartedAt >= GEOFENCE_WARMUP_MS;
  const crossingConfirmed = insideStreak >= GEOFENCE_CONFIRM_READS;

  if (warmupDone && crossingConfirmed && wasInside !== null && wasInside !== insideBay) {
    const event_type = !wasInside && insideBay ? 'ENTRY' : 'EXIT';
    const lastAt = lastGeofenceEventAt.get(mmsi) || 0;
    if (Date.now() - lastAt >= GEOFENCE_EVENT_COOLDOWN_MS) {
      lastGeofenceEventAt.set(mmsi, Date.now());
      void recordEventAsync(mmsi, event_type, lat, lon, speed, heading, updated);
    }
  }

  // Always broadcast position update to connected clients
  broadcast({
    type: 'POSITION',
    vessel: {
      mmsi,
      lat,
      lon,
      speed,
      heading,
      course,
      nav_status,
      insideBay: nowInside,
      name: updated.name || null,
      ship_type: updated.ship_type || null,
      ship_type_label: shipTypeLabel(updated.ship_type),
      flag: updated.flag || null,
    },
  });
}

function getActiveVessels() {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 min timeout
  const result = [];
  for (const [, v] of vessels) {
    if (v.lastSeen >= cutoff && v.lat != null) {
      result.push({
        mmsi: v.mmsi,
        lat: v.lat,
        lon: v.lon,
        speed: v.speed,
        heading: v.heading,
        course: v.course,
        nav_status: v.nav_status,
        insideBay: v.insideBay,
        name: v.name || null,
        ship_type: v.ship_type || null,
        ship_type_label: shipTypeLabel(v.ship_type),
        flag: v.flag || null,
      });
    }
  }
  return result;
}

// Prune stale vessels every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1h
  for (const [mmsi, v] of vessels) {
    if (v.lastSeen < cutoff) vessels.delete(mmsi);
  }
}, 5 * 60 * 1000);

module.exports = { updatePosition, updateStaticData, getActiveVessels, setBroadcast, shipTypeLabel };
