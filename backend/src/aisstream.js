const WebSocket = require('ws');
const { AISSTREAM_BBOX } = require('./geofence');
const { updatePosition, updateStaticData } = require('./vesselTracker');

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
const RECONNECT_DELAY_MS = 5000;

let ws = null;
let reconnectTimer = null;
let connected = false;

function subscribeMessage() {
  return JSON.stringify({
    APIKey: process.env.AISSTREAM_API_KEY,
    BoundingBoxes: [AISSTREAM_BBOX],
    FilterMessageTypes: ['PositionReport', 'ShipStaticData'],
  });
}

function connect() {
  if (ws) {
    ws.removeAllListeners();
    ws.terminate();
  }

  console.log('[AISSTREAM] Connecting…');
  ws = new WebSocket(AISSTREAM_URL);

  ws.on('open', () => {
    connected = true;
    console.log('[AISSTREAM] Connected. Subscribing to Barra da Guanabara bbox…');
    ws.send(subscribeMessage());
  });

  ws.on('message', async (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    await handleMessage(msg);
  });

  ws.on('close', (code) => {
    connected = false;
    console.warn(`[AISSTREAM] Disconnected (code ${code}). Reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`);
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('[AISSTREAM] Error:', err.message);
    // 'close' will fire after error
  });
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
}

async function handleMessage(msg) {
  const type = msg.MessageType;
  const meta = msg.MetaData || {};
  const mmsi = String(meta.MMSI || '').trim();

  if (!mmsi) return;

  if (type === 'PositionReport') {
    const r = msg.Message?.PositionReport || {};
    const lat = r.Latitude ?? meta.latitude;
    const lon = r.Longitude ?? meta.longitude;
    if (lat == null || lon == null) return;

    await updatePosition(mmsi, {
      lat: Number(lat),
      lon: Number(lon),
      speed: r.Sog != null ? Number(r.Sog) : null,
      heading: r.TrueHeading != null ? Number(r.TrueHeading) : null,
      course: r.Cog != null ? Number(r.Cog) : null,
      nav_status: r.NavigationalStatus != null ? Number(r.NavigationalStatus) : null,
    });

    // Update name if provided in metadata
    if (meta.ShipName) {
      await updateStaticData(mmsi, { name: meta.ShipName.trim() });
    }
  }

  if (type === 'ShipStaticData') {
    const s = msg.Message?.ShipStaticData || {};
    await updateStaticData(mmsi, {
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
    console.warn('[AISSTREAM] AISSTREAM_API_KEY not set — running without live AIS feed.');
    return;
  }
  connect();
}

module.exports = { start, isConnected };
