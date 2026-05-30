const db = require('./index');
const logger = require('../logger');

const POSITION_FLUSH_MS = Number(process.env.AIS_POSITION_FLUSH_MS) || 30_000;
const POSITION_BATCH_MAX = Number(process.env.AIS_POSITION_BATCH_MAX) || 40;
const UPSERT_FLUSH_MS = Number(process.env.AIS_UPSERT_FLUSH_MS) || 5_000;
/** Mínimo entre gravações de posição no DB por MMSI (mapa ao vivo não usa isso). */
const POSITION_PERSIST_MS =
  Number(process.env.AIS_POSITION_PERSIST_MINUTES) > 0
    ? Number(process.env.AIS_POSITION_PERSIST_MINUTES) * 60_000
    : Number(process.env.AIS_POSITION_PERSIST_MS) || 5 * 60_000;

const positionQueue = [];
const lastPersistByMmsi = new Map();
const upsertByMmsi = new Map();
let positionTimer = null;
let upsertTimer = null;
let flushingPositions = false;
let flushingUpserts = false;

function formatError(err) {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.stack) return err.stack;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function enqueuePosition(row) {
  const mmsi = row?.mmsi;
  if (!mmsi) return;
  const now = Date.now();
  const last = lastPersistByMmsi.get(mmsi) || 0;
  if (now - last < POSITION_PERSIST_MS) return;
  lastPersistByMmsi.set(mmsi, now);

  positionQueue.push(row);
  if (positionQueue.length > POSITION_BATCH_MAX * 3) {
    positionQueue.splice(0, POSITION_BATCH_MAX);
  }
  if (!positionTimer) {
    positionTimer = setTimeout(flushPositions, POSITION_FLUSH_MS);
  }
}

function enqueueUpsert(row) {
  upsertByMmsi.set(row.mmsi, row);
  if (!upsertTimer) {
    upsertTimer = setTimeout(flushUpserts, UPSERT_FLUSH_MS);
  }
}

async function flushPositions() {
  positionTimer = null;
  if (flushingPositions || positionQueue.length === 0) return;
  flushingPositions = true;
  const raw = positionQueue.splice(0, POSITION_BATCH_MAX);
  const deduped = new Map();
  for (const row of raw) deduped.set(row.mmsi, row);
  const batch = [...deduped.values()];
  try {
    for (const row of batch) {
      await db.savePosition(row);
    }
  } catch (err) {
    logger.error(`[DB] savePosition batch failed: ${formatError(err)}`);
  } finally {
    flushingPositions = false;
    if (positionQueue.length > 0 && !positionTimer) {
      positionTimer = setTimeout(flushPositions, POSITION_FLUSH_MS);
    }
  }
}

async function flushUpserts() {
  upsertTimer = null;
  if (flushingUpserts || upsertByMmsi.size === 0) return;
  flushingUpserts = true;
  const batch = [...upsertByMmsi.values()];
  upsertByMmsi.clear();
  try {
    for (const row of batch) {
      await db.upsertVessel(row);
    }
  } catch (err) {
    logger.error(`[DB] upsertVessel batch failed: ${formatError(err)}`);
  } finally {
    flushingUpserts = false;
    if (upsertByMmsi.size > 0 && !upsertTimer) {
      upsertTimer = setTimeout(flushUpserts, UPSERT_FLUSH_MS);
    }
  }
}

function startDbWriteQueue() {
  const persistPositions = process.env.AIS_SAVE_POSITIONS !== 'false';
  logger.info(
    `[DB] Write queue active — positions: ${persistPositions ? `flush ${POSITION_FLUSH_MS}ms, 1 grav./${Math.round(POSITION_PERSIST_MS / 60000)}min/MMSI` : 'disabled'}, upserts every ${UPSERT_FLUSH_MS}ms`,
  );
}

module.exports = {
  enqueuePosition,
  enqueueUpsert,
  startDbWriteQueue,
};
