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

const FALLBACK_ORIGINS = [
  'https://loquacious-kelpie-f684a4.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '').toLowerCase();
}

const allowedOrigins = new Set(
  (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  FALLBACK_ORIGINS.forEach((origin) => allowedOrigins.add(normalizeOrigin(origin)));
}

function isAllowedOrigin(origin) {
  // Requests without Origin are usually server-to-server and should pass.
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
}

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ['GET', 'OPTIONS'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use('/api', api);

const server = http.createServer(app);

// ── WebSocket server ──────────────────────────────────────────────

// Recusa conexões WebSocket de origens não permitidas
server.on('upgrade', (request, socket, head) => {
  const origin = request.headers['origin'];
  if (!isAllowedOrigin(origin)) {
    console.warn(`[WS] Rejected upgrade from origin: ${origin}`);
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
