const FEED_TZ = process.env.AIS_FEED_TIMEZONE || 'America/Sao_Paulo';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://riogateais.netlify.app').split(',')[0].trim();

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatEventTime(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FEED_TZ,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * @param {{ event_type: string, mmsi: string, lat: number, lon: number, speed?: number, occurred_at?: string|Date }} event
 * @param {{ name?: string, ship_type_label?: string, flag?: string }} vessel
 */
function formatGeofenceTelegramHtml(event, vessel = {}) {
  const isEntry = event.event_type === 'ENTRY';
  const emoji = isEntry ? '🟢' : '🔴';
  const label = isEntry ? 'ENTRY' : 'EXIT';
  const action = isEntry ? 'Entrada na baía' : 'Saída da baía';
  const name = vessel.name && vessel.name !== 'N/D' ? vessel.name : 'N/D';
  const type = vessel.ship_type_label || 'Desconhecido';
  const flag = vessel.flag || '—';
  const speed = event.speed != null ? `${Number(event.speed).toFixed(1)} kn` : '—';
  const lat = Number(event.lat).toFixed(4);
  const lon = Number(event.lon).toFixed(4);
  const when = formatEventTime(event.occurred_at || new Date());
  const mapUrl = FRONTEND_URL.replace(/\/$/, '');

  return (
    `${emoji} <b>${label}</b> — ${action}\n` +
    `<b>Navio:</b> ${escapeHtml(name)} (<code>${escapeHtml(event.mmsi)}</code>)\n` +
    `<b>Tipo:</b> ${escapeHtml(type)} · <b>Bandeira:</b> ${escapeHtml(flag)}\n` +
    `<b>Horário:</b> ${when} (${escapeHtml(FEED_TZ)})\n` +
    `<b>SOG:</b> ${escapeHtml(speed)} · <b>Pos:</b> ${lat}, ${lon}\n` +
    `<a href="${escapeHtml(mapUrl)}">Abrir RioAISGate</a>`
  );
}

module.exports = { formatGeofenceTelegramHtml, formatEventTime, escapeHtml };
