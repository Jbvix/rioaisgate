/** Silencia alertas por chat (memória — reinicia com o processo). */

const muteUntilByChat = new Map();

const DEFAULT_MUTE_MINUTES = 30;
const MAX_MUTE_MINUTES = 24 * 60;

function parseMuteMinutes(raw) {
  if (raw == null || raw === '') return DEFAULT_MUTE_MINUTES;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MUTE_MINUTES;
  return Math.min(Math.round(n), MAX_MUTE_MINUTES);
}

function muteChat(chatId, minutes = DEFAULT_MUTE_MINUTES) {
  const mins = parseMuteMinutes(minutes);
  muteUntilByChat.set(String(chatId), Date.now() + mins * 60_000);
  return mins;
}

function unmuteChat(chatId) {
  muteUntilByChat.delete(String(chatId));
}

function isChatMuted(chatId) {
  const key = String(chatId);
  const until = muteUntilByChat.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    muteUntilByChat.delete(key);
    return false;
  }
  return true;
}

function muteRemainingMs(chatId) {
  const until = muteUntilByChat.get(String(chatId));
  if (!until) return 0;
  return Math.max(0, until - Date.now());
}

function formatMuteRemaining(chatId) {
  const ms = muteRemainingMs(chatId);
  if (ms <= 0) return null;
  const mins = Math.ceil(ms / 60_000);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

module.exports = {
  muteChat,
  unmuteChat,
  isChatMuted,
  muteRemainingMs,
  formatMuteRemaining,
  parseMuteMinutes,
  DEFAULT_MUTE_MINUTES,
};
