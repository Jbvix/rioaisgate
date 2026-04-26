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
server.listen(PORT, () => {
  console.log(`[SERVER] Listening on port ${PORT}`);
  aisstream.start();
});
