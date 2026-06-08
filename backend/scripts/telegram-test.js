require('dotenv').config();
const { sendTestMessage } = require('../src/notifications/telegram');

sendTestMessage()
  .then(() => {
    console.log('OK — verifique o Telegram.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Falha:', err.message);
    process.exit(1);
  });
