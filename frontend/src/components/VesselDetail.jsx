import React, { useEffect, useState } from 'react';
import { API_URL } from '../config';

const NAV_STATUS = [
  'Navegando (motor)', 'Fundeado', 'Não governável', 'Manob. restrita',
  'Calado restrito', 'Amarrado', 'Encalhado', 'Pescando', 'Navegando (vela)',
];

export default function VesselDetail({ mmsi, vessels, onClose }) {
  const vessel = vessels[mmsi];
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!mmsi) return;
    fetch(`${API_URL}/api/vessels/${mmsi}/history?limit=10`)
      .then(r => r.json())
      .then(setHistory)
      .catch(() => {});
  }, [mmsi]);

  if (!mmsi) return null;

  return (
    <div className="bg-navy-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl border border-navy-600">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-white font-bold text-lg leading-tight">
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
                <span className="text-white/50">
                  {new Date(e.occurred_at).toLocaleString('pt-BR')}
                </span>
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
