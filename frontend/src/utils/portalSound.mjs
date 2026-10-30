let context;
let playing = false;

// Short original Web Audio effect; only invoked by an explicit user gesture.
export async function playPortalSound() {
  if (playing || typeof window === 'undefined') return false;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return false;
  const nodes = [];
  try {
    context ||= new AudioContext();
    if (context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return false;
    playing = true;
    const now = context.currentTime;
    const duration = 2.1;
    const output = context.createGain();
    output.gain.setValueAtTime(0, now);
    output.gain.linearRampToValueAtTime(0.18, now + 0.15);
    output.gain.setValueAtTime(0.18, now + 1.3);
    output.gain.exponentialRampToValueAtTime(0.001, now + duration);
    output.connect(context.destination);
    nodes.push(output);

    const reverb = context.createConvolver();
    const impulse = context.createBuffer(2, context.sampleRate * 1.1, context.sampleRate);
    let seed = 42;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < data.length; i++) data[i] = (random() * 2 - 1) * (1 - i / data.length) ** 3;
    }
    reverb.buffer = impulse;
    const wet = context.createGain(); wet.gain.value = 0.22;
    reverb.connect(wet); wet.connect(output); nodes.push(reverb, wet);

    for (const [start, end, level, type] of [[55, 110, 0.4, 'sine'], [110, 440, 0.1, 'triangle'], [660, 1320, 0.07, 'sine']]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(start, now);
      oscillator.frequency.exponentialRampToValueAtTime(end, now + 1.25);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(level, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.75);
      oscillator.connect(gain); gain.connect(output); gain.connect(reverb);
      oscillator.start(now); oscillator.stop(now + 1.8);
      nodes.push(oscillator, gain);
    }

    const noise = context.createBuffer(1, context.sampleRate * 1.5, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
    const source = context.createBufferSource(); source.buffer = noise;
    const filter = context.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(3000, now + 0.9);
    filter.frequency.exponentialRampToValueAtTime(500, now + 1.5);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.3, now + 0.9);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    source.connect(filter); filter.connect(noiseGain); noiseGain.connect(output); noiseGain.connect(reverb);
    source.start(now); source.stop(now + 1.5); nodes.push(source, filter, noiseGain);
    setTimeout(() => {
      for (const node of nodes) node.disconnect();
      playing = false;
    }, (duration + 0.2) * 1000);
    return true;
  } catch {
    for (const node of nodes) { try { node.disconnect(); } catch { /* already detached */ } }
    playing = false;
    return false;
  }
}
