const logger = require('../logger');
const { formatGeofenceTelegramHtml } = require('./formatEventMessage');
const subscriptions = require('./subscriptions');

const API_BASE = 'https://api.telegram.org';

function isEnabled() {
  return process.env.TELEGRAM_ALERTS_ENABLED === 'true';
}

function getBotToken() {
  return String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
}

function parseChatIds() {
  return String(process.env.TELEGRAM_CHAT_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isBroadcastEnabled() {
  return process.env.TELEGRAM_BROADCAST !== 'false';
}

async function sendMessage(chatId, text) {
  const token = getBotToken();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN não configurado');

  const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    const desc = body.description || res.statusText || 'Unknown error';
    throw new Error(`Telegram API: ${desc}`);
  }
  return body;
}

/**
 * @param {{ event_type: string, mmsi: string, lat: number, lon: number, speed?: number, occurred_at?: string }} event
 * @param {{ name?: string, ship_type_label?: string, flag?: string }} vessel
 */
async function resolveTargetChatIds(event) {
  const targets = new Set();
  if (isBroadcastEnabled()) {
    parseChatIds().forEach((id) => targets.add(id));
  }
  const subChats = await subscriptions.getChatsForEvent(event.mmsi, event.event_type);
  subChats.forEach((id) => targets.add(id));
  return [...targets];
}

async function notifyGeofenceEvent(event, vessel = {}) {
  if (!isEnabled()) return { skipped: true, reason: 'disabled' };

  const chatIds = await resolveTargetChatIds(event);
  if (chatIds.length === 0) {
    return { skipped: true, reason: 'no_targets' };
  }

  const text = formatGeofenceTelegramHtml(event, vessel);
  const results = [];

  for (const chatId of chatIds) {
    try {
      await sendMessage(chatId, text);
      results.push({ chatId, ok: true });
      logger.info(`[TELEGRAM] ${event.event_type} MMSI:${event.mmsi} → chat ${chatId}`);
    } catch (err) {
      results.push({ chatId, ok: false, error: err.message });
      logger.error(`[TELEGRAM] Falha chat ${chatId}: ${err.message}`);
    }
  }

  return { sent: results.filter((r) => r.ok).length, results };
}

async function sendTestMessage() {
  const sample = {
    event_type: 'ENTRY',
    mmsi: '710000000',
    lat: -22.916,
    lon: -43.159,
    speed: 8.4,
    occurred_at: new Date(),
  };
  const vessel = { name: 'TESTE RioAISGate', ship_type_label: 'Carga', flag: 'BR' };
  const text = formatGeofenceTelegramHtml(sample, vessel);
  const chatIds = parseChatIds();
  if (chatIds.length === 0) throw new Error('Defina TELEGRAM_CHAT_IDS');

  for (const chatId of chatIds) {
    await sendMessage(chatId, `🧪 <b>Teste RioAISGate</b>\n\n${text}`);
    logger.info(`[TELEGRAM] Teste enviado → chat ${chatId}`);
  }
}

function logStartupStatus() {
  if (!isEnabled()) {
    logger.info('[TELEGRAM] Alertas desligados (TELEGRAM_ALERTS_ENABLED≠true)');
    return;
  }
  if (!getBotToken()) {
    logger.warn('[TELEGRAM] Alertas ligados mas TELEGRAM_BOT_TOKEN ausente');
    return;
  }
  const broadcast = isBroadcastEnabled();
  const chats = parseChatIds();
  const polling = process.env.TELEGRAM_BOT_POLLING === 'true';
  logger.info(
    `[TELEGRAM] Alertas ativos — broadcast: ${broadcast ? `${chats.length} chat(s)` : 'off'}, ` +
      `assinaturas: on, polling: ${polling ? 'on' : 'off'}`,
  );
}

module.exports = {
  isEnabled,
  getBotToken,
  parseChatIds,
  isBroadcastEnabled,
  sendMessage,
  notifyGeofenceEvent,
  sendTestMessage,
  logStartupStatus,
};
