/** Prefer private URL on Railway (service-to-service, no public proxy). */
function resolveConnectionString() {
  return (
    process.env.DATABASE_PRIVATE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    null
  );
}

function connectionHost(connectionString) {
  try {
    return new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'postgresql://')).hostname;
  } catch {
    return '(invalid URL)';
  }
}

function needsSsl(connectionString) {
  // Railway private network — TCP only, SSL breaks or stalls the handshake
  if (/\.railway\.internal\b/i.test(connectionString)) return false;
  if (/localhost|127\.0\.0\.1/i.test(connectionString)) return false;
  if (/sslmode=disable/i.test(connectionString)) return false;
  if (/sslmode=require/i.test(connectionString)) return true;
  if (connectionString.includes('supabase')) return true;
  if (connectionString.includes('railway')) return true;
  if (process.env.NODE_ENV === 'production') return true;
  return false;
}

function buildPoolConfig({ connectionTimeoutMillis = 15000 } = {}) {
  const connectionString = resolveConnectionString();
  if (!connectionString) return null;

  return {
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30000,
    max: 10,
  };
}

module.exports = {
  buildPoolConfig,
  resolveConnectionString,
  connectionHost,
  needsSsl,
};
