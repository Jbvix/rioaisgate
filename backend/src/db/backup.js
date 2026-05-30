/**
 * Exporta vessels, vessel_events e vessel_positions para arquivos JSONL + manifest.
 *
 * Uso (na pasta backend, com DATABASE_URL ou DATABASE_PRIVATE_URL no .env):
 *   npm run backup
 *   node src/db/backup.js --out=../backups/meu-backup
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const logger = require('../logger');
const {
  buildPoolConfig,
  resolveConnectionString,
  connectionHost,
} = require('./poolConfig');

const BATCH_SIZE = Number(process.env.BACKUP_BATCH_SIZE) || 5000;

function parseOutDir(argv) {
  const flag = argv.find((a) => a.startsWith('--out='));
  if (flag) return path.resolve(flag.slice('--out='.length));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return path.resolve(__dirname, '../../../backups', `rioaisgate-${stamp}`);
}

function formatDbError(err) {
  if (!err) return 'Unknown error';
  return [err.message, err.code ? `code=${err.code}` : null].filter(Boolean).join(' | ');
}

async function countRows(pool, table) {
  const res = await pool.query(`SELECT COUNT(*)::bigint AS n FROM ${table}`);
  return Number(res.rows[0].n);
}

async function exportTableJsonl(pool, table, orderBy, outPath) {
  let offset = 0;
  let total = 0;
  const stream = fs.createWriteStream(outPath, { encoding: 'utf8' });

  while (true) {
    const res = await pool.query(
      `SELECT * FROM ${table} ORDER BY ${orderBy} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset],
    );
    if (res.rows.length === 0) break;
    for (const row of res.rows) {
      stream.write(`${JSON.stringify(row)}\n`);
    }
    total += res.rows.length;
    offset += res.rows.length;
    if (res.rows.length < BATCH_SIZE) break;
    logger.info(`[BACKUP] ${table}: ${total} linhas…`);
  }

  await new Promise((resolve, reject) => {
    stream.end(() => resolve());
    stream.on('error', reject);
  });
  return total;
}

(async () => {
  const connectionString = resolveConnectionString();
  if (!connectionString) {
    const envPath = path.resolve(__dirname, '../../.env');
    logger.error('[BACKUP] DATABASE_URL vazia ou ausente.');
    logger.error(`[BACKUP] Edite o arquivo: ${envPath}`);
    logger.error('[BACKUP] Railway → Postgres → Variables → copie DATABASE_URL (rede pública).');
    process.exit(1);
  }

  const outDir = parseOutDir(process.argv.slice(2));
  fs.mkdirSync(outDir, { recursive: true });

  const pool = new Pool(buildPoolConfig({ connectionTimeoutMillis: 30000 }));

  try {
    await pool.query('SELECT 1');
    logger.info(`[BACKUP] Origem: ${connectionHost(connectionString)}`);
    logger.info(`[BACKUP] Destino: ${outDir}`);

    const [vesselsCount, eventsCount, positionsCount] = await Promise.all([
      countRows(pool, 'vessels'),
      countRows(pool, 'vessel_events'),
      countRows(pool, 'vessel_positions'),
    ]);

    logger.info(
      `[BACKUP] Contagem: vessels=${vesselsCount} events=${eventsCount} positions=${positionsCount}`,
    );

    const exported = {
      vessels: await exportTableJsonl(pool, 'vessels', 'mmsi', path.join(outDir, 'vessels.jsonl')),
      vessel_events: await exportTableJsonl(
        pool,
        'vessel_events',
        'id',
        path.join(outDir, 'vessel_events.jsonl'),
      ),
      vessel_positions: await exportTableJsonl(
        pool,
        'vessel_positions',
        'recorded_at, mmsi',
        path.join(outDir, 'vessel_positions.jsonl'),
      ),
    };

    const manifest = {
      exported_at: new Date().toISOString(),
      source_host: connectionHost(connectionString),
      tables: {
        vessels: { expected: vesselsCount, exported: exported.vessels },
        vessel_events: { expected: eventsCount, exported: exported.vessel_events },
        vessel_positions: { expected: positionsCount, exported: exported.vessel_positions },
      },
      files: ['vessels.jsonl', 'vessel_events.jsonl', 'vessel_positions.jsonl', 'manifest.json'],
      format: 'jsonl',
      note: 'Uma linha JSON por registro. Não commitar backups no git.',
    };

    fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    logger.info('[BACKUP] Concluído com sucesso.');
    logger.info(`[BACKUP] manifest: ${path.join(outDir, 'manifest.json')}`);
  } catch (err) {
    logger.error('[BACKUP] Falhou:', formatDbError(err));
    if (err?.stack) logger.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
