import React from 'react';

const TITLE = 'RIOAISGATE';

export default function SplashScreen({ progress = 0, label = 'Carregando…', onOpenManual }) {
  const pct = Math.min(100, Math.max(0, Math.round(progress)));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-navy-900">
      <div className="splash-bg absolute inset-0 pointer-events-none" aria-hidden />

      <div className="relative z-10 flex flex-col items-center px-6 max-w-lg w-full">
        <div className="mb-2 text-4xl opacity-90" aria-hidden>
          ⚓
        </div>

        <h1 className="splash-title flex gap-0.5 sm:gap-1 mb-1" aria-label={TITLE}>
          {TITLE.split('').map((ch, i) => (
            <span
              key={`${ch}-${i}`}
              className="splash-letter text-3xl sm:text-4xl font-black tracking-tight text-white"
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              {ch}
            </span>
          ))}
        </h1>

        <p className="text-ocean-400 text-sm font-medium tracking-[0.25em] uppercase mb-1">
          Barra da Guanabara
        </p>
        <p className="text-white/35 text-[11px] mb-10">Jossian Brito · TugLife Systems</p>

        <div className="w-full mb-3">
          <div
            className="h-2 w-full rounded-full bg-navy-700/80 overflow-hidden border border-navy-600/60"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso de carregamento"
          >
            <div
              className="splash-progress h-full rounded-full bg-gradient-to-r from-ocean-600 via-ocean-400 to-emerald-400 transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-white/40">
            <span className="truncate pr-4">{label}</span>
            <span className="tabular-nums shrink-0">{pct}%</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenManual}
          className="mt-4 px-5 py-2.5 rounded-lg border border-ocean-500/50 bg-ocean-600/20 text-ocean-300 text-sm font-medium hover:bg-ocean-600/35 hover:text-white transition-colors"
        >
          Manual do usuário
        </button>
      </div>
    </div>
  );
}
