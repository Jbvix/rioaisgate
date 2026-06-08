/**
 * Lista chats recentes que falaram com o bot (getUpdates).
 * 1. Defina TELEGRAM_BOT_TOKEN no .env
 * 2. Envie /start ou qualquer msg no grupo onde o bot está
 * 3. npm run telegram:chat-id
 */
require('dotenv').config();

const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
if (!token) {
  console.error('Defina TELEGRAM_BOT_TOKEN no .env');
  process.exit(1);
}

(async () => {
  const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20`);
  const data = await res.json();
  if (!data.ok) {
    console.error('API:', data.description || 'erro');
    process.exit(1);
  }

  const seen = new Map();
  for (const u of data.result || []) {
    const msg = u.message || u.channel_post;
    if (!msg?.chat) continue;
    const c = msg.chat;
    const key = `${c.type}:${c.id}`;
    if (seen.has(key)) continue;
    seen.set(key, {
      chat_id: c.id,
      type: c.type,
      title: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || '—',
    });
  }

  if (seen.size === 0) {
    console.log('Nenhum chat encontrado. Adicione o bot a um grupo e envie uma mensagem.');
    process.exit(0);
  }

  console.log('Copie o chat_id para TELEGRAM_CHAT_IDS:\n');
  for (const row of seen.values()) {
    console.log(`  ${row.chat_id}  (${row.type}: ${row.title})`);
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
