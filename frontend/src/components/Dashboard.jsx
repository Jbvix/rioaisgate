import React from 'react';

function KPI({ label, value, sub, color = 'ocean' }) {
  const colors = {
    ocean:  'from-ocean-600 to-ocean-500',
    green:  'from-emerald-700 to-emerald-500',
    amber:  'from-amber-700 to-amber-500',
    rose:   'from-rose-700 to-rose-500',
  };
  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-lg sm:rounded-xl p-2.5 sm:p-4 flex flex-col gap-0.5 sm:gap-1 shadow-lg min-w-0`}>
      <span className="text-[10px] sm:text-xs text-white/70 uppercase tracking-wide sm:tracking-widest leading-tight">{label}</span>
      <span className="text-xl sm:text-3xl font-bold text-white tabular-nums">{value ?? '—'}</span>
      {sub && <span className="text-[10px] sm:text-xs text-white/60 leading-tight">{sub}</span>}
    </div>
  );
}

export default function Dashboard({ stats, vessels }) {
  const vesselList = Object.values(vessels);
  const inside = vesselList.filter(v => v.insideBay).length;

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 p-2 sm:p-4">
      <KPI
        label="Embarcações ativas"
        value={vesselList.length}
        sub="últimos 30 min"
        color="ocean"
      />
      <KPI
        label="Dentro da baía"
        value={inside}
        sub="em tempo real"
        color="green"
      />
      <KPI
        label="Entradas hoje"
        value={stats?.entries ?? '—'}
        sub="cruzamentos registrados"
        color="amber"
      />
      <KPI
        label="Saídas hoje"
        value={stats?.exits ?? '—'}
        sub="cruzamentos registrados"
        color="rose"
      />
    </div>
  );
}
