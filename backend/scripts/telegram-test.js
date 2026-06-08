require('dotenv').config();
const { sendTestMessage } = require('../src/notifications/telegram');

// Uso: npm run telegram:test
//      npm run telegram:test -- -1001234567890
if (process.argv[2]) {
  process.env.TELEGRAM_CHAT_IDS = process.argv[2];
}

const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
const chats = String(process.env.TELEGRAM_CHAT_IDS || '').trim();

if (!token) {
  console.error('Falha: defina TELEGRAM_BOT_TOKEN no arquivo backend/.env');
  console.error('  1. Telegram → @BotFather → /newbot → copie o token');
  process.exit(1);
}
if (!chats) {
  console.error('Falha: defina TELEGRAM_CHAT_IDS no backend/.env');
  console.error('  1. Adicione o bot a um grupo e envie /start');
  console.error('  2. npm run telegram:chat-id');
  console.error('  3. Cole o chat_id em TELEGRAM_CHAT_IDS=-100...');
  console.error('  Ou: npm run telegram:test -- -1001234567890');
  process.exit(1);
}

sendTestMessage()
  .then(() => {
    console.log('OK — verifique o Telegram.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha:', err.message);
    process.exit(1);
  });
