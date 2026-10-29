const WebSocket = require('ws');
const { AISSTREAM_BBOX } = require('./geofence');
const { updatePosition, updateStaticData } = require('./vesselTracker');
const logger = require('./logger');

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const RECONNECT_DELAY_MS = 5000;
const HEARTBEAT_MS = 30_000;

let ws = null;
let reconnectTimer = null;
let heartbeatTimer = null;
let connected = false;
let running = false;
let desiredEnabled = true;
let lastMessageAt = null;

function subscribeMessage() {
  return JSON.stringify({
    APIKey: process.env.AISSTREAM_API_KEY,
    BoundingBoxes: [AISSTREAM_BBOX],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
  });
}

function connect() {
  if (!running) return;
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  clearInterval(heartbeatTimer);
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
  }
  connected = false;
  logger.info('[AISSTREAM] Connecting (always-on)…');
  const socket = new WebSocket(AISSTREAM_URL, { handshakeTimeout: 30_000 });
  ws = socket;
  let alive = true;

  socket.on('open', () => {
    connected = true;
    logger.info('[AISSTREAM] Connected. Subscribing to Barra da Guanabara bbox…');
    socket.send(subscribeMessage());
    heartbeatTimer = setInterval(() => {
      if (!alive) {
        logger.warn('[AISSTREAM] Connection unresponsive; reconnecting.');
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, HEARTBEAT_MS);
  });
  socket.on('pong', () => { alive = true; });
  socket.on('message', (data) => {
    alive = true;
    lastMessageAt = new Date().toISOString();
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }
    try { handleMessage(msg); } catch (err) {
      logger.error('[AISSTREAM] handleMessage error:', err.message);
    }
  });
  socket.on('close', (code) => {
    connected = false;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    if (!running) return;
    logger.warn(`[AISSTREAM] Disconnected (code ${code}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
  });
  socket.on('error', (err) => {
    logger.error('[AISSTREAM] Error:', err.message);
    socket.terminate();
  });
}

function getStatus() {
  return {
    connected,
    enabled: running,
    always_on: desiredEnabled,
    manual_enabled: desiredEnabled,
    last_message_at: lastMessageAt,
    // Compatibility for clients that previously displayed a scheduled window.
    within_window: true,
    start_hour: 0,
    end_hour: 0,
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
  if (running || !desiredEnabled) return;
  if (!process.env.AISSTREAM_API_KEY?.trim()) {
    logger.warn('[AISSTREAM] AISSTREAM_API_KEY not set — running without live AIS feed.');
    return;
  }
  running = true;
  connect();
}

function setEnabled(enabled) {
  if (typeof enabled !== 'boolean') return;
  desiredEnabled = enabled;
  if (enabled) { start(); return; }
  running = false;
  connected = false;
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  reconnectTimer = null;
  heartbeatTimer = null;
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
    ws = null;
  }
  logger.info('[AISSTREAM] Feed paused by PIN-authorized control.');
}

module.exports = { start, isConnected, getStatus, setEnabled };
