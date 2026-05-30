require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const api = require('./api');
const aisstream = require('./aisstream');
const logger = require('./logger');
const { setBroadcast } = require('./vesselTracker');
const { startDbWriteQueue } = require('./db/writeQueue');
const { startRetentionSchedule } = require('./db/retention');

const app = express();
const PORT = process.env.PORT || 3001;

const FALLBACK_ORIGINS = [
  'https://loquacious-kelpie-f684a4.netlify.app',
  'https://riogateais.netlify.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

/** Netlify branch/deploy previews: https://{deploy-id}--{site-slug}.netlify.app */
const NETLIFY_SITE_SLUG = (process.env.NETLIFY_SITE_SLUG || 'riogateais').toLowerCase();

function normalizeOrigin(origin) {
  return String(origin || '').trim().replace(/\/$/, '').toLowerCase();
}

function isNetlifyDeployPreview(origin) {
  if (!NETLIFY_SITE_SLUG) return false;
  const n = normalizeOrigin(origin);
  const suffix = `--${NETLIFY_SITE_SLUG}.netlify.app`;
  if (!n.startsWith('https://') || !n.endsWith(suffix)) return false;
  const deployId = n.slice('https://'.length, -suffix.length);
  return /^[0-9a-z]+$/.test(deployId) && deployId.length > 0;
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
  const norm = normalizeOrigin(origin);
  if (allowedOrigins.has(norm)) return true;
  if (isNetlifyDeployPreview(origin)) return true;
  return false;
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
    logger.warn(`[WS] Rejected upgrade from origin: ${origin}`);
    socket.destroy();
    return;
  }
  // Permite o ws.Server cuidar do restante
});

const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (socket, req) => {
  const ip = req.socket.remoteAddress;
  logger.info(`[WS] Client connected: ${ip}`);

  socket.on('close', () => logger.info(`[WS] Client disconnected: ${ip}`));
  socket.on('error', (err) => logger.error(`[WS] Error from ${ip}:`, err.message));
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
  logger.info(`[SERVER] Listening on port ${PORT}`);
  startDbWriteQueue();
  startRetentionSchedule();
  aisstream.start();
});
