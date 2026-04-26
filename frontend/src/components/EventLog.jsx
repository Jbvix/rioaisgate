import React from 'react';

const TYPE_STYLES = {
  ENTRY: { bg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-400', label: '▶ ENTRADA' },
  EXIT:  { bg: 'bg-rose-500/20 border-rose-500/40',       text: 'text-rose-400',    label: '◀ SAÍDA' },
};

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function EventLog({ events, onSelectVessel }) {
  if (!events.length) {
    return (
      <div className="flex items-center justify-center h-full text-navy-600 text-sm">
        Aguardando eventos de cruzamento…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto dark-scroll h-full px-3 pb-3">
      {events.map((e, i) => {
        const style = TYPE_STYLES[e.event_type] || TYPE_STYLES.ENTRY;
        return (
          <button
            key={e.id ?? i}
            onClick={() => onSelectVessel?.(e.mmsi)}
            className={`w-full text-left rounded-lg border px-3 py-2 ${style.bg} hover:brightness-125 transition-all`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-bold ${style.text}`}>{style.label}</span>
              <span className="text-xs text-white/40">{formatTime(e.occurred_at)}</span>
            </div>
            <div className="text-sm text-white font-medium truncate mt-0.5">
              {e.name || 'Embarcação desconhecida'}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-white/50">MMSI: {e.mmsi}</span>
              {e.ship_type_label && (
                <span className="text-xs text-white/40">· {e.ship_type_label}</span>
              )}
              {e.flag && <span className="text-xs text-white/40">· {e.flag}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
