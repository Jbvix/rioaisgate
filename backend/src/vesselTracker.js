const { isInsideBay } = require('./geofence');
const db = require('./db');
const logger = require('./logger');

// In-memory state: mmsi → { lat, lon, insideBay, name, ship_type, speed, heading, course, nav_status, lastSeen }
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

async function updateStaticData(mmsi, data) {
  const vessel = vessels.get(mmsi) || {};
  vessels.set(mmsi, { ...vessel, mmsi, ...data, lastSeen: Date.now() });
  try {
    await db.upsertVessel({ mmsi, ...data });
  } catch (err) {
    logger.error(`[DB] upsertVessel ${mmsi}: ${formatError(err)}`);
  }
}

async function updatePosition(mmsi, { lat, lon, speed, heading, course, nav_status }) {
  const prev = vessels.get(mmsi);
  const wasInside = prev ? prev.insideBay : null;
  const nowInside = isInsideBay(lat, lon);

  const updated = {
    ...(prev || {}),
    mmsi,
    lat,
    lon,
    speed,
    heading,
    course,
    nav_status,
    insideBay: nowInside,
    lastSeen: Date.now(),
  };
  vessels.set(mmsi, updated);

  // Persist raw position
  try {
    await db.savePosition({ mmsi, lat, lon, speed, heading, course, nav_status });
  } catch (err) {
    // non-critical, but useful for diagnosing DB connectivity/schema drift in prod
    logger.error(`[DB] savePosition ${mmsi}: ${formatError(err)}`);
  }

  // Crossing detection needs a prior inside/outside state (skip first observation only for EVENT)
  if (wasInside !== null) {
    let event_type = null;
    if (!wasInside && nowInside) event_type = 'ENTRY';
    if (wasInside && !nowInside) event_type = 'EXIT';

    if (event_type) {
      try {
        const event = await db.recordEvent({ mmsi, event_type, lat, lon, speed, heading });
        const payload = {
          type: 'EVENT',
          event: {
            ...event,
            name: updated.name || 'N/D',
            ship_type: updated.ship_type,
            ship_type_label: shipTypeLabel(updated.ship_type),
            flag: updated.flag,
          },
        };
        broadcast(payload);
        logger.info(`[EVENT] ${event_type} | MMSI:${mmsi} | ${updated.name || 'N/D'} | ${lat.toFixed(4)},${lon.toFixed(4)}`);
      } catch (err) {
        logger.error(`[DB] recordEvent ${mmsi}: ${formatError(err)}`);
      }
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
