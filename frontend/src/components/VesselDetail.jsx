import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';
import { formatOccurredAt } from '../utils/formatOccurredAt';

const NAV_STATUS = [
  'Navegando (motor)', 'Fundeado', 'Não governável', 'Manob. restrita',
  'Calado restrito', 'Amarrado', 'Encalhado', 'Pescando', 'Navegando (vela)',
];

export default function VesselDetail({
  mmsi,
  vessels,
  onClose,
  geofenceWatchRule,
  onToggleGeofenceWatch,
}) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!mmsi) return;
    fetch(`${API_URL}/api/vessels/${mmsi}/history?limit=10`)
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {});
  }, [mmsi]);

  if (!mmsi) return null;

  const vessel = vessels[mmsi] || vessels[String(mmsi)];
  const watching = geofenceWatchRule != null && geofenceWatchRule !== '';

  return (
    <div className="bg-navy-800 rounded-xl p-3 sm:p-4 flex flex-col gap-2 sm:gap-3 shadow-xl border border-navy-600">
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="text-white font-bold text-base sm:text-lg leading-tight truncate">
            {vessel?.name || 'Embarcação desconhecida'}
          </div>
          <div className="text-white/50 text-xs mt-0.5">MMSI: {mmsi}</div>
        </div>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white transition-colors text-xl leading-none"
        >
          ×
        </button>
      </div>

      {onToggleGeofenceWatch && (
        <div className="rounded-lg border border-navy-600 bg-navy-700/50 p-3">
          <button
            type="button"
            onClick={() => onToggleGeofenceWatch(!watching)}
            className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              watching
                ? 'bg-amber-600/30 text-amber-200 border border-amber-500/40 hover:bg-amber-600/40'
                : 'bg-ocean-500/20 text-ocean-300 border border-ocean-500/40 hover:bg-ocean-500/30'
            }`}
          >
            {watching ? '🔕 Desativar alerta da barra' : '🔔 Alerta ao cruzar a barra'}
          </button>
          <p className="text-xs text-white/45 mt-2 leading-relaxed">
            {watching ? (
              geofenceWatchRule === 'ENTRY' ? (
                <>Alerta ativo: toca quando a embarcação <span className="text-emerald-400/90">entrar</span> na baía.</>
              ) : geofenceWatchRule === 'EXIT' ? (
                <>Alerta ativo: toca quando a embarcação <span className="text-rose-400/90">sair</span> da baía.</>
              ) : (
                <>Alerta ativo: toca em <span className="text-white/60">entrada ou saída</span> (posição desconhecida no momento da ativação).</>
              )
            ) : vessel?.insideBay === false ? (
              'Fora da baía: o som toca na entrada. Reativar o alerta se a embarcação mudar de lado.'
            ) : vessel?.insideBay === true ? (
              'Dentro da baía: o som toca na saída. Reativar o alerta se a embarcação mudar de lado.'
            ) : (
              'Quando a posição em relação à baía for desconhecida, o alerta dispara em qualquer cruzamento.'
            )}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <Info label="Tipo" value={vessel?.ship_type_label} />
        <Info label="Bandeira" value={vessel?.flag} />
        <Info label="Velocidade" value={vessel?.speed != null ? `${vessel.speed} nós` : null} />
        <Info label="Rumo" value={vessel?.heading != null ? `${vessel.heading}°` : null} />
        <Info label="Status" value={vessel?.nav_status != null ? NAV_STATUS[vessel.nav_status] ?? vessel.nav_status : null} />
        <Info label="Posição" value={vessel?.lat != null ? `${vessel.lat.toFixed(4)}, ${vessel.lon.toFixed(4)}` : null} />
        <Info label="Na baía" value={vessel?.insideBay != null ? (vessel.insideBay ? 'Sim' : 'Não') : null} />
      </div>

      {history.length > 0 && (
        <div>
          <div className="text-xs text-white/40 uppercase tracking-widest mb-1">Histórico de cruzamentos</div>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto dark-scroll">
            {history.map((e, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={e.event_type === 'ENTRY' ? 'text-emerald-400' : 'text-rose-400'}>
                  {e.event_type === 'ENTRY' ? '▶' : '◀'} {e.event_type}
                </span>
                <span className="text-white/50">{formatOccurredAt(e.occurred_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="bg-navy-700 rounded-lg px-2 py-1.5">
      <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
      <div className="text-white text-sm font-medium mt-0.5">{value ?? '—'}</div>
    </div>
  );
}
