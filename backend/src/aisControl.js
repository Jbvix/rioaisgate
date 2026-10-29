const { createHash, timingSafeEqual } = require('crypto');

// In-memory limit: five failures per address in fifteen minutes.
const failures = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_ADDRESSES = 10_000;

function requireControlPin(req, res, next) {
  res.set('Cache-Control', 'no-store');
  const expected = process.env.AIS_CONTROL_PIN || '';
  if (!/^\d{6,12}$/.test(expected)) {
    return res.status(503).json({ error: 'Controle AIS não configurado.' });
  }
  const now = Date.now();
  for (const [address, entry] of failures) if (entry.until <= now) failures.delete(address);
  const address = req.ip || req.socket.remoteAddress || 'unknown';
  const entry = failures.get(address);
  if (entry?.count >= MAX_FAILURES || (!entry && failures.size >= MAX_ADDRESSES)) {
    res.set('Retry-After', String(Math.max(1, Math.ceil(((entry?.until || now + WINDOW_MS) - now) / 1000))));
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde antes de tentar novamente.' });
  }
  const supplied = req.get('X-AIS-Control-PIN') || '';
  const digest = (value) => createHash('sha256').update(value).digest();
  if (!/^\d{6,12}$/.test(supplied) || !timingSafeEqual(digest(supplied), digest(expected))) {
    failures.set(address, { count: (entry?.count || 0) + 1, until: entry?.until || now + WINDOW_MS });
    return res.status(401).json({ error: 'PIN inválido.' });
  }
  failures.delete(address);
  next();
}

module.exports = { requireControlPin };
