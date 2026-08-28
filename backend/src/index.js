require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const api = require('./api');
const aisstream = require('./aisstream');
const { setBroadcast } = require('./vesselTracker');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (health checks, curl) and all browser origins.
    // AIS vessel data is public — no credential-bearing requests are made.
    cb(null, true);
  },
  methods: ['GET', 'OPTIONS'],
}));
app.use(express.json());
app.use('/api', api);

const server = http.createServer(app);

// ── WebSocket server ──────────────────────────────────────────────
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected: ${ip}`);

  socket.on('close', () => console.log(`[WS] Client disconnected: ${ip}`));
  socket.on('error', (err) => console.error(`[WS] Error from ${ip}:`, err.message));
});

function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

setBroadcast(broadcast);

// ── Start ─────────────────────────────────────────────────────────
async function start() {
  // Auto-migrate on every startup (idempotent CREATE IF NOT EXISTS)
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
      await pool.query(`
        CREATE TABLE IF NOT EXISTS vessels (
          mmsi VARCHAR(9) PRIMARY KEY, name VARCHAR(255), ship_type INTEGER,
          flag VARCHAR(4), imo VARCHAR(10), callsign VARCHAR(10),
          length NUMERIC, width NUMERIC, updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS vessel_events (
          id BIGSERIAL PRIMARY KEY, mmsi VARCHAR(9) NOT NULL,
          event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('ENTRY','EXIT')),
          lat NUMERIC(10,6) NOT NULL, lon NUMERIC(10,6) NOT NULL,
          speed NUMERIC(5,1), heading SMALLINT, occurred_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_ve_mmsi ON vessel_events(mmsi);
        CREATE INDEX IF NOT EXISTS idx_ve_time ON vessel_events(occurred_at DESC);
        CREATE TABLE IF NOT EXISTS vessel_positions (
          mmsi VARCHAR(9) NOT NULL, lat NUMERIC(10,6) NOT NULL, lon NUMERIC(10,6) NOT NULL,
          speed NUMERIC(5,1), heading SMALLINT, course NUMERIC(5,1), nav_status SMALLINT,
          recorded_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_vp_mmsi ON vessel_positions(mmsi);
      `);
      await pool.end();
      console.log('[DB] Migration OK');
    } catch (err) {
      console.error('[DB] Migration error:', err.message);
    }
  }

  server.listen(PORT, () => {
    console.log(`[SERVER] Listening on port ${PORT}`);
    aisstream.start();
  });
}

start();
