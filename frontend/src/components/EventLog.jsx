import React, { useState } from 'react';
import { formatOccurredAt } from '../utils/formatOccurredAt';

const TYPE_STYLES = {
  ENTRY: { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-400', label: '▶ ENTRADA' },
  EXIT:  { bg: 'bg-rose-500/20 border-rose-500/40',       text: 'text-rose-400',    label: '◀ SAÍDA' },
};

export default function EventLog({ events, onSelectVessel }) {
  const [filter, setFilter] = useState('ALL');
  const visible = events.filter((e) => filter === 'ALL' || e.event_type === filter);
  if (!events.length) {
    return (
      <div className="flex items-center justify-center h-full text-white/65 text-sm text-center px-5">
        Nenhum cruzamento disponível. Novas entradas e saídas aparecerão aqui.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 px-3 py-3" aria-label="Filtrar cruzamentos">
        {[['ALL','Todos'],['ENTRY','Entradas'],['EXIT','Saídas']].map(([value,label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)} className={`min-h-11 flex-1 rounded-lg border py-2 text-xs ${filter === value ? 'border-ocean-400 text-ocean-400 bg-ocean-600/20' : 'border-navy-600 text-white/70'}`}>{label}</button>)}
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto dark-scroll flex-1 min-h-0 px-3 pb-3">
      {!visible.length && <p className="text-sm text-white/65 text-center py-4">Nenhum evento neste filtro.</p>}
      {visible.map((e, i) => {
        const style = TYPE_STYLES[e.event_type] || TYPE_STYLES.ENTRY;
        return (
          <button
            key={e.id ?? i}
            onClick={() => onSelectVessel?.(e.mmsi)}
            className={`w-full text-left rounded-lg border px-3 py-2 ${style.bg} hover:brightness-125 transition-all`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
              <span className="text-xs text-white/65 whitespace-nowrap">{formatOccurredAt(e.occurred_at)}</span>
            </div>
            <div className="text-sm text-white font-medium truncate mt-0.5">
              {e.name || 'Embarcação desconhecida'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/50">MMSI: {e.mmsi}</span>
              {e.ship_type_label && (
                <span className="text-xs text-white/65">· {e.ship_type_label}</span>
              )}
              {e.flag && <span className="text-xs text-white/65">· {e.flag}</span>}
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
