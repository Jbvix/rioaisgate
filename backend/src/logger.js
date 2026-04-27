const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const envLevel = String(process.env.LOG_LEVEL || 'info').toLowerCase();
const currentLevel = LEVELS[envLevel] ?? LEVELS.info;

function canLog(level) {
  return LEVELS[level] <= currentLevel;
}

function write(level, ...args) {
  if (!canLog(level)) return;
  if (level === 'error') return console.error(...args);
  if (level === 'warn') return console.warn(...args);
  return console.log(...args);
}

module.exports = {
  error: (...args) => write('error', ...args),
  warn: (...args) => write('warn', ...args),
  info: (...args) => write('info', ...args),
  debug: (...args) => write('debug', ...args),
};
