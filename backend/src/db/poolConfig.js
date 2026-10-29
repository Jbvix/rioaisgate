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
  const url = new URL(connectionString);
  const host = url.hostname.toLowerCase();
  const mode = url.searchParams.get('sslmode');
  if (mode === 'no-verify') throw new Error('sslmode=no-verify is not supported');
  if (mode === 'disable') return false;
  if (mode || url.searchParams.get('ssl') === 'true') return true;
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.railway.internal')) return false;
  return true;
}

function buildPoolConfig({ connectionTimeoutMillis = 15000, statementTimeoutMs = 15000 } = {}) {
  const connectionString = resolveConnectionString();
  if (!connectionString) return null;

  const tls = needsSsl(connectionString);
  const url = new URL(connectionString);
  const caPath = process.env.PGSSLROOTCERT || url.searchParams.get('sslrootcert');
  // pg-connection-string otherwise overrides the explicit verified TLS options.
  for (const key of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey']) {
    if ((key === 'sslcert' || key === 'sslkey') && url.searchParams.has(key)) {
      throw new Error('Configure client TLS certificates separately; URL sslcert/sslkey are unsupported');
    }
    url.searchParams.delete(key);
  }
  return {
    connectionString: url.toString(),
    ssl: tls ? { rejectUnauthorized: true, ...(caPath ? { ca: require('fs').readFileSync(caPath, 'utf8') } : {}) } : false,
    connectionTimeoutMillis,
    idleTimeoutMillis: 30000,
    max: Number(process.env.PG_POOL_MAX) || 20,
    options: `-c statement_timeout=${statementTimeoutMs}`,
  };
}

module.exports = {
  buildPoolConfig,
  resolveConnectionString,
  connectionHost,
  needsSsl,
};
