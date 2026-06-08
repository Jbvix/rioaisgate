const telegram = require('./telegram');

/**
 * Dispara notificações externas para um evento geofence confirmado.
 * Fire-and-forget — erros são logados, não propagados ao feed AIS.
 *
 * @param {object} event — linha retornada por db.recordEvent + occurred_at
 * @param {object} vessel — estado em memória (name, ship_type_label, flag)
 */
function notifyGeofenceEvent(event, vessel = {}) {
  void telegram.notifyGeofenceEvent(event, vessel).catch((err) => {
    const logger = require('../logger');
    logger.error(`[NOTIFY] telegram: ${err.message}`);
  });
}

module.exports = {
  notifyGeofenceEvent,
  telegram,
};
