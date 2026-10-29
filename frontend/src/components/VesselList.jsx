import React, { useState } from 'react';

export default function VesselList({ vessels, onSelect, selectedMmsi }) {
  const [filter, setFilter] = useState('');
  const [zone, setZone] = useState('all');
  const list = Object.values(vessels)
    .filter(v => !filter || (v.name || '').toLowerCase().includes(filter.toLowerCase()) || String(v.mmsi).includes(filter))
    .filter(v => zone === 'all' || (zone === 'bay' ? v.insideBay === true : v.insideBay === false))
    .sort((a, b) => (b.speed ?? 0) - (a.speed ?? 0));

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 pt-3 pb-2">
        <input
          type="search"
          autoComplete="off"
          aria-label="Buscar embarcação por nome ou MMSI"
          placeholder="Buscar embarcação…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="w-full bg-navy-700 text-white placeholder-white/30 text-base sm:text-sm min-h-11 rounded-lg px-3 py-2 border border-navy-600 focus:outline-none focus:border-ocean-500"
        />
        <div className="mt-3 flex gap-1" aria-label="Filtrar por localização">
          {[['all','Todas'],['bay','Na baía'],['sea','No mar']].map(([value,label]) => (
            <button type="button" key={value} aria-pressed={zone === value} onClick={() => setZone(value)} className={`min-h-11 flex-1 rounded-lg border px-2 py-2 text-xs ${zone === value ? 'bg-ocean-600/20 border-ocean-400 text-ocean-400' : 'border-navy-600 text-white/70'}`}>{label}</button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-white/60" role="status">{list.length} embarcações · maior velocidade primeiro</p>
      </div>
      <div className="flex-1 overflow-y-auto dark-scroll px-3 pb-3 flex flex-col gap-1">
        {list.length === 0 && (
          <div className="text-center text-white/30 text-sm pt-4">{filter || zone !== 'all' ? 'Nenhuma embarcação corresponde aos filtros.' : 'Nenhuma posição disponível. Verifique o sinal AIS.'}</div>
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
                {v.name || 'Nome não informado'}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                v.insideBay ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'
              }`}>
                {v.insideBay ? 'BAÍA' : 'MAR'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-white/65">
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
