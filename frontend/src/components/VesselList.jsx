import React, { useState } from 'react';

export default function VesselList({ vessels, onSelect, selectedMmsi }) {
  const [filter, setFilter] = useState('');
  const list = Object.values(vessels)
    .filter(v => !filter || (v.name || '').toLowerCase().includes(filter.toLowerCase()) || v.mmsi.includes(filter))
    .sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0));

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <input
          type="text"
          placeholder="Buscar embarcação…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-navy-700 text-white placeholder-white/30 text-sm rounded-lg px-3 py-2 border border-navy-600 focus:outline-none focus:border-ocean-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto dark-scroll px-3 pb-3 flex flex-col gap-1">
        {list.length === 0 && (
          <div className="text-center text-white/30 text-sm pt-4">Nenhuma embarcação visível</div>
        )}
        {list.map(v => (
          <button
            key={v.mmsi}
            onClick={() => onSelect(v.mmsi)}
            className={`w-full text-left rounded-lg px-3 py-2 transition-all border ${
              selectedMmsi === v.mmsi
                ? 'bg-ocean-600/30 border-ocean-500/60'
                : 'bg-navy-700/50 border-navy-600/40 hover:bg-navy-700'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-white font-medium truncate">
                {v.name || 'N/D'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                v.insideBay ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
              }`}>
                {v.insideBay ? 'BAÍA' : 'MAR'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40">
              <span>{v.mmsi}</span>
              {v.ship_type_label && <span>· {v.ship_type_label}</span>}
              {v.speed != null && <span>· {v.speed} nós</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
