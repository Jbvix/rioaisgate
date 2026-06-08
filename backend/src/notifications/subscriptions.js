const db = require('../db');

function normalizeMmsi(mmsi) {
  const s = String(mmsi || '').trim();
  return /^\d{9}$/.test(s) ? s : null;
}

function normalizeEventFilter(raw) {
  const v = String(raw || 'both').trim().toUpperCase();
  if (v === 'ENTRY' || v === 'ENTRADA') return 'ENTRY';
  if (v === 'EXIT' || v === 'SAIDA' || v === 'SAÍDA') return 'EXIT';
  return 'BOTH';
}

function eventFilterMatches(filter, eventType) {
  if (filter === 'BOTH') return true;
  return filter === eventType;
}

async function upsertWatch(chatId, mmsi, eventFilter = 'BOTH') {
  const m = normalizeMmsi(mmsi);
  if (!m) throw new Error('MMSI inválido — use 9 dígitos.');
  const filter = normalizeEventFilter(eventFilter);
  await db.upsertTelegramSubscription(chatId, m, filter);
  return { chatId, mmsi: m, eventFilter: filter };
}

async function removeWatch(chatId, mmsi) {
  if (String(mmsi).toLowerCase() === 'all' || mmsi === '*') {
    return db.deactivateAllTelegramSubscriptions(chatId);
  }
  const m = normalizeMmsi(mmsi);
  if (!m) throw new Error('MMSI inválido — use 9 dígitos ou "all".');
  return db.deactivateTelegramSubscription(chatId, m);
}

async function listWatches(chatId) {
  return db.listTelegramSubscriptions(chatId);
}

async function getChatsForEvent(mmsi, eventType) {
  if (!db.isConfigured()) return [];
  const rows = await db.getTelegramChatsForEvent(String(mmsi), eventType);
  return rows.map((r) => String(r.chat_id));
}

module.exports = {
  normalizeMmsi,
  normalizeEventFilter,
  eventFilterMatches,
  upsertWatch,
  removeWatch,
  listWatches,
  getChatsForEvent,
};
