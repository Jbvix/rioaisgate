/**
 * Alerta sonoro curto (Web Audio API — sem ficheiros).
 * ENTRY: tom mais agudo · EXIT: tom mais grave.
 * Chame unlockGeofenceAudio() após clique do utilizador (política autoplay).
 */

let sharedCtx = null;

function getContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx) sharedCtx = new Ctx();
  return sharedCtx;
}

export function unlockGeofenceAudio() {
  const ctx = getContext();
  if (!ctx) return Promise.resolve(false);
  if (ctx.state === 'suspended') return ctx.resume().then(() => true).catch(() => false);
  return Promise.resolve(true);
}

export function playGeofenceAlert(kind) {
  try {
    const ctx = getContext();
    if (!ctx) return;

    const run = () => {
      const entry = kind === 'entry';
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

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
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(run).catch(() => {});
      return;
    }
    run();
  } catch {
    // ignorar
  }
}
