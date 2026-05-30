const WebSocket = require('ws');
const { AISSTREAM_BBOX } = require('./geofence');
const { updatePosition, updateStaticData } = require('./vesselTracker');
const logger = require('./logger');

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const RECONNECT_DELAY_MS = 5000;
const SCHEDULE_CHECK_MS = 60 * 1000;

let ws = null;
let reconnectTimer = null;
let connected = false;
let scheduleTimer = null;
let scheduleActive = false;
let manualEnabled = null; // null = follow schedule, boolean = force on/off

const FEED_TZ = process.env.AIS_FEED_TIMEZONE || 'America/Sao_Paulo';

/** Horários iguais (ex.: 0 e 0) = feed AIS 24h. Valores diferentes = janela [start, end) no fuso FEED_TZ. */
function parseFeedHour(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const FEED_START_HOUR = parseFeedHour(process.env.AIS_FEED_START_HOUR, 0);
const FEED_END_HOUR = parseFeedHour(process.env.AIS_FEED_END_HOUR, 0);

function subscribeMessage() {
  return JSON.stringify({
    APIKey: process.env.AISSTREAM_API_KEY,
    BoundingBoxes: [AISSTREAM_BBOX],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
  });
}

function connect() {
  if (!scheduleActive) return;

  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
  }

  logger.info('[AISSTREAM] Connecting…');
  ws = new WebSocket(AISSTREAM_URL);

  ws.on('open', () => {
    connected = true;
    logger.info('[AISSTREAM] Connected. Subscribing to Barra da Guanabara bbox…');
    ws.send(subscribeMessage());
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    handleMessage(msg).catch((err) => {
      logger.error('[AISSTREAM] handleMessage error:', err.message);
    });
  });

  ws.on('close', (code) => {
    connected = false;
    if (!scheduleActive) return;
    logger.warn(`[AISSTREAM] Disconnected (code ${code}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    logger.error('[AISSTREAM] Error:', err.message);
    // 'close' will fire after error
  });
}

function scheduleReconnect() {
  if (!scheduleActive) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
}

function getLocalHour(timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour12: false,
    hour: '2-digit',
    timeZone,
  }).formatToParts(new Date());
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
}

function isWithinOperatingWindow(hour) {
  if (FEED_START_HOUR === FEED_END_HOUR) return true;
  if (FEED_START_HOUR < FEED_END_HOUR) {
    return hour >= FEED_START_HOUR && hour < FEED_END_HOUR;
  }
  return hour >= FEED_START_HOUR || hour < FEED_END_HOUR;
}

function stopConnection() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
    ws = null;
  }
  connected = false;
}

function evaluateSchedule() {
  const hour = getLocalHour(FEED_TZ);
  const shouldRun = manualEnabled == null
    ? isWithinOperatingWindow(hour)
    : manualEnabled;

  if (shouldRun && !scheduleActive) {
    scheduleActive = true;
    logger.info(`[AISSTREAM] Schedule window open (${FEED_START_HOUR}:00-${FEED_END_HOUR}:00 ${FEED_TZ}). Starting feed.`);
    connect();
    return;
  }

  if (!shouldRun && scheduleActive) {
    scheduleActive = false;
    logger.info(`[AISSTREAM] Schedule window closed (${FEED_START_HOUR}:00-${FEED_END_HOUR}:00 ${FEED_TZ}). Stopping feed.`);
    stopConnection();
  }
}

function setEnabled(enabled) {
  if (typeof enabled !== 'boolean') return;
  manualEnabled = enabled;
  evaluateSchedule();
}

function getStatus() {
  const hour = getLocalHour(FEED_TZ);
  return {
    connected,
    enabled: scheduleActive,
    manual_enabled: manualEnabled,
    timezone: FEED_TZ,
    start_hour: FEED_START_HOUR,
    end_hour: FEED_END_HOUR,
    local_hour: hour,
    within_window: isWithinOperatingWindow(hour),
  };
}

function handleMessage(msg) {
  const type = msg.MessageType;
  const meta = msg.MetaData || {};
  const mmsi = String(meta.MMSI || '').trim();

  if (!mmsi) return;

  if (type === 'PositionReport') {
    const r = msg.Message?.PositionReport || {};
    const lat = r.Latitude ?? meta.latitude;
    const lon = r.Longitude ?? meta.longitude;
    if (lat == null || lon == null) return;

    updatePosition(mmsi, {
      lat: Number(lat),
      lon: Number(lon),
      speed: r.Sog != null ? Number(r.Sog) : null,
      heading: r.TrueHeading != null ? Number(r.TrueHeading) : null,
      course: r.Cog != null ? Number(r.Cog) : null,
      nav_status: r.NavigationalStatus != null ? Number(r.NavigationalStatus) : null,
    });

    // Update name if provided in metadata
    if (meta.ShipName) {
      updateStaticData(mmsi, { name: meta.ShipName.trim() });
    }
  }

  if (type === 'ShipStaticData') {
    const s = msg.Message?.ShipStaticData || {};
    updateStaticData(mmsi, {
      name: (s.Name || meta.ShipName || '').trim() || null,
      ship_type: s.Type != null ? Number(s.Type) : null,
      flag: s.Flag || null,
      imo: s.ImoNumber ? String(s.ImoNumber) : null,
      callsign: (s.CallSign || '').trim() || null,
      length: s.Dimension?.A != null && s.Dimension?.B != null
        ? Number(s.Dimension.A) + Number(s.Dimension.B)
        : null,
      width: s.Dimension?.C != null && s.Dimension?.D != null
        ? Number(s.Dimension.C) + Number(s.Dimension.D)
        : null,
    });
  }
}

function isConnected() {
  return connected;
}

function start() {
  if (!process.env.AISSTREAM_API_KEY) {
    logger.warn('[AISSTREAM] AISSTREAM_API_KEY not set — running without live AIS feed.');
    return;
  }

  evaluateSchedule();
  clearInterval(scheduleTimer);
  scheduleTimer = setInterval(evaluateSchedule, SCHEDULE_CHECK_MS);
}

module.exports = { start, isConnected, setEnabled, getStatus };
