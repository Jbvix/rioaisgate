const logger = require('../logger');
const aisstream = require('../aisstream');
const { getActiveVessels } = require('../vesselTracker');
const telegram = require('./telegram');
const subscriptions = require('./subscriptions');
const mute = require('./mute');

const API_BASE = 'https://api.telegram.org';
const POLL_TIMEOUT_S = 25;
const POLL_IDLE_MS = 1500;

let polling = false;
let offset = 0;
let pollTimer = null;

function isPollingEnabled() {
  return process.env.TELEGRAM_BOT_POLLING === 'true' && telegram.isEnabled() && telegram.getBotToken();
}

function filterLabel(f) {
  if (f === 'ENTRY') return 'entrada';
  if (f === 'EXIT') return 'saída';
  return 'entrada e saída';
}

async function reply(chatId, text) {
  try {
    await telegram.sendMessage(chatId, text);
  } catch (err) {
    logger.error(`[TELEGRAM-BOT] reply ${chatId}: ${err.message}`);
  }
}

function helpText() {
  return (
    '<b>RioAISGate</b> — alertas geofence Baía de Guanabara\n\n' +
    '<b>Comandos:</b>\n' +
    '/watch <code>MMSI</code> [entry|exit] — vigia embarcação\n' +
    '/unwatch <code>MMSI</code> — remove vigia\n' +
    '/unwatch all — remove todas\n' +
    '/list — suas vigias\n' +
    '/status — feed AIS e embarcações ativas\n' +
    '/mute [min] — silencia alertas (padrão 30 min)\n' +
    '/unmute — reativa alertas\n' +
    '/help — esta mensagem'
  );
}

async function handleStart(chatId) {
  await reply(
    chatId,
    '⚓ <b>RioAISGate</b>\n\nReceba alertas quando uma embarcação <b>entrar</b> ou <b>sair</b> da Baía de Guanabara.\n\n' +
      helpText(),
  );
}

async function handleWatch(chatId, args) {
  if (args.length < 1) {
    await reply(chatId, 'Uso: <code>/watch MMSI</code> ou <code>/watch MMSI entry</code>');
    return;
  }
  try {
    const { mmsi, eventFilter } = await subscriptions.upsertWatch(chatId, args[0], args[1]);
    await reply(
      chatId,
      `✅ Vigia ativa: <code>${mmsi}</code> — ${filterLabel(eventFilter)}`,
    );
  } catch (err) {
    await reply(chatId, `❌ ${err.message}`);
  }
}

async function handleUnwatch(chatId, args) {
  if (args.length < 1) {
    await reply(chatId, 'Uso: <code>/unwatch MMSI</code> ou <code>/unwatch all</code>');
    return;
  }
  try {
    const n = await subscriptions.removeWatch(chatId, args[0]);
    await reply(chatId, n > 0 ? `✅ Removida(s) ${n} vigia(s).` : 'Nenhuma vigia encontrada.');
  } catch (err) {
    await reply(chatId, `❌ ${err.message}`);
  }
}

async function handleList(chatId) {
  try {
    const rows = await subscriptions.listWatches(chatId);
    if (!rows.length) {
      await reply(chatId, 'Nenhuma vigia ativa. Use <code>/watch MMSI</code>.');
      return;
    }
    const lines = rows.map(
      (r) => `• <code>${r.mmsi}</code> — ${filterLabel(r.event_filter)}`,
    );
    await reply(chatId, `<b>Suas vigias:</b>\n${lines.join('\n')}`);
  } catch (err) {
    await reply(chatId, `❌ ${err.message}`);
  }
}

async function handleStatus(chatId) {
  const st = aisstream.getStatus();
  const vessels = getActiveVessels();
  const inside = vessels.filter((v) => v.insideBay).length;
  const feed = st.connected ? '🟢 conectado' : '🔴 desconectado';
  const muted = mute.formatMuteRemaining(chatId);
  await reply(
    chatId,
    `<b>Status RioAISGate</b>\n` +
      `Feed AIS: ${feed}\n` +
      `Embarcações ativas: ${vessels.length}\n` +
      `Na baía: ${inside}\n` +
      `Alertas: ${muted ? `🔕 silenciados (${muted})` : '🔔 ativos'}`,
  );
}

async function handleMute(chatId, args) {
  const mins = mute.muteChat(chatId, args[0]);
  await reply(chatId, `🔕 Alertas silenciados por <b>${mins}</b> min. Use <code>/unmute</code> para reativar.`);
}

async function handleUnmute(chatId) {
  mute.unmuteChat(chatId);
  await reply(chatId, '🔔 Alertas reativados.');
}

async function handleCommand(chatId, text) {
  const parts = text.trim().split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase().replace(/@\w+$/, '');
  const args = parts.slice(1);

  if (cmd === '/start' || cmd === '/help') return handleStart(chatId);
  if (cmd === '/watch') return handleWatch(chatId, args);
  if (cmd === '/unwatch') return handleUnwatch(chatId, args);
  if (cmd === '/list') return handleList(chatId);
  if (cmd === '/status') return handleStatus(chatId);
  if (cmd === '/mute') return handleMute(chatId, args);
  if (cmd === '/unmute') return handleUnmute(chatId);
  return null;
}

async function processUpdate(update) {
  const msg = update.message;
  if (!msg?.text || !msg.chat?.id) return;
  const text = msg.text.trim();
  if (!text.startsWith('/')) return;
  await handleCommand(msg.chat.id, text);
}

async function pollOnce() {
  const token = telegram.getBotToken();
  if (!token) return;

  const url = `${API_BASE}/bot${token}/getUpdates?timeout=${POLL_TIMEOUT_S}&offset=${offset}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error(data.description || 'getUpdates failed');
  }

  for (const update of data.result || []) {
    offset = update.update_id + 1;
    try {
      await processUpdate(update);
    } catch (err) {
      logger.error(`[TELEGRAM-BOT] update ${update.update_id}: ${err.message}`);
    }
  }
}

function scheduleNext(delayMs) {
  if (!polling) return;
  pollTimer = setTimeout(runPollCycle, delayMs);
}

async function runPollCycle() {
  if (!polling) return;
  try {
    await pollOnce();
    scheduleNext(POLL_IDLE_MS);
  } catch (err) {
    logger.error(`[TELEGRAM-BOT] poll: ${err.message}`);
    scheduleNext(5000);
  }
}

function startTelegramBotPolling() {
  if (!isPollingEnabled()) {
    if (process.env.TELEGRAM_BOT_POLLING === 'true') {
      logger.warn('[TELEGRAM-BOT] Polling pedido mas alertas/token indisponíveis');
    }
    return;
  }
  if (polling) return;
  polling = true;
  logger.info('[TELEGRAM-BOT] Polling ativo — /watch, /list, /status, /mute');
  runPollCycle();
}

function stopTelegramBotPolling() {
  polling = false;
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

module.exports = {
  startTelegramBotPolling,
  stopTelegramBotPolling,
  handleCommand,
  isPollingEnabled,
};
