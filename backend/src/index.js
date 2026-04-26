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

const FRONTEND_ORIGIN = 'https://loquacious-kelpie-f684a4.netlify.app';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  methods: ['GET', 'OPTIONS'],
}));
app.use(express.json());
app.use('/api', api);

const server = http.createServer(app);

// ── WebSocket server ──────────────────────────────────────────────

// Recusa conexões WebSocket de origens não permitidas
server.on('upgrade', (request, socket, head) => {
  const origin = request.headers['origin'];
  if (origin && origin !== FRONTEND_ORIGIN) {
    socket.destroy();
    return;
  }
  // Permite o ws.Server cuidar do restante
});

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
