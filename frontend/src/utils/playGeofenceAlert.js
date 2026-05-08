/**
 * Alerta sonoro curto (Web Audio API — sem ficheiros).
 * Chamado após interação do utilizador (ex.: clicar em ativar alerta) para respeitar autoplay.
 */
export function playGeofenceAlert(kind) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const entry = kind === 'entry';
    osc.type = 'sine';
    osc.frequency.value = entry ? 880 : 520;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);

    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.type = 'sine';
    osc2.frequency.value = entry ? 1108 : 392;
    g2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
    g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.45);

    const endAt = (ctx.currentTime + 0.5) * 1000;
    setTimeout(() => ctx.close().catch(() => {}), endAt);
  } catch {
    // ignorar
  }
}
