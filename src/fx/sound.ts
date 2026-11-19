// Web Audio Synthesizer for HBC game events

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }
  audioCtx ??= new window.AudioContext();
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isAudioMuted(): boolean {
  return isMuted;
}

export function setAudioMuted(muted: boolean): void {
  isMuted = muted;
}

export function toggleAudioMuted(): boolean {
  isMuted = !isMuted;
  return isMuted;
}

function createNoiseBuffer(
  ctx: AudioContext,
  durationSec: number,
): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function createDistortionCurve(amount = 25): Float32Array<ArrayBuffer> {
  const samples = 256;
  const buffer = new ArrayBuffer(samples * 4);
  const curve = new Float32Array(buffer);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/**
 * Crisp wooden/stone piece placement tick.
 */
export function playPlaceSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Transient click from noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.02);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1400, now);
  noiseFilter.Q.setValueAtTime(3, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // Body thump (pitch drop)
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(380, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.05);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.25, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.055);
}

/**
 * Soft swish flip tone.
 */
export function playFlipSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Swish tone sweep
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(620, now + 0.07);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.12, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);

  // Soft air noise
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.07);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(900, now);
  noiseFilter.Q.setValueAtTime(2, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.08, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  osc.start(now);
  noise.start(now);
  osc.stop(now + 0.085);
}

/**
 * Metallic clang / shield deflection impact.
 */
export function playBlockSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Metallic partial 1
  const osc1 = ctx.createOscillator();
  osc1.type = "square";
  osc1.frequency.setValueAtTime(840, now);

  // Metallic partial 2
  const osc2 = ctx.createOscillator();
  osc2.type = "triangle";
  osc2.frequency.setValueAtTime(1260, now);

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(600, now);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

  osc1.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.23);
  osc2.stop(now + 0.23);
}

/**
 * Deep ominous low-frequency bass swell and void snap for COUNTER.
 */
export function playCounterSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(65, now);
  osc.frequency.exponentialRampToValueAtTime(32, now + 0.45);

  const subOsc = ctx.createOscillator();
  subOsc.type = "sine";
  subOsc.frequency.setValueAtTime(45, now);
  subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.5);

  // Void snap noise burst
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.08);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1800, now);
  noiseFilter.Q.setValueAtTime(5, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.2, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(260, now);
  filter.frequency.exponentialRampToValueAtTime(60, now + 0.45);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

  osc.connect(filter);
  subOsc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  subOsc.start(now);
  noise.start(now);
  osc.stop(now + 0.5);
  subOsc.stop(now + 0.5);
}

/**
 * Resonant distortion explosion tone with layered thunder for BOMB.
 */
export function playBombSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Low frequency sub pitch drop
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(160, now);
  osc.frequency.exponentialRampToValueAtTime(24, now + 0.45);

  // Noise explosion body
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.5);

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(900, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(45, now + 0.5);

  // Distortion waveshaper
  const shaper = ctx.createWaveShaper();
  shaper.curve = createDistortionCurve(35);

  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.38, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

  osc.connect(shaper);
  noise.connect(noiseFilter);
  noiseFilter.connect(shaper);
  shaper.connect(masterGain);
  masterGain.connect(ctx.destination);

  osc.start(now);
  noise.start(now);
  osc.stop(now + 0.52);
}

/**
 * High-pitched harmonic celestial chimes for PURIFY.
 */
export function playPurifySound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Tri-tone harmonic frequencies: A5 (880Hz), E6 (1320Hz), A6 (1760Hz), C#7 (2217Hz)
  const freqs = [880, 1320, 1760, 2217];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.01, now);
  gain.gain.linearRampToValueAtTime(0.14, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
  gain.connect(ctx.destination);

  for (const freq of freqs) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.62);
  }
}

/**
 * Sharp crystalline astral penetration strike with celestial chime for PIERCE.
 */
export function playPierceSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Sharp penetrative downward slice (triangle drop)
  const sliceOsc = ctx.createOscillator();
  sliceOsc.type = "triangle";
  sliceOsc.frequency.setValueAtTime(1600, now);
  sliceOsc.frequency.exponentialRampToValueAtTime(360, now + 0.14);

  const sliceGain = ctx.createGain();
  sliceGain.gain.setValueAtTime(0.01, now);
  sliceGain.gain.linearRampToValueAtTime(0.28, now + 0.01);
  sliceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  sliceOsc.connect(sliceGain);
  sliceGain.connect(ctx.destination);

  // 2. Air zip / sonic gust (bandpass noise sweep)
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.16);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(3600, now);
  noiseFilter.frequency.exponentialRampToValueAtTime(900, now + 0.14);
  noiseFilter.Q.setValueAtTime(3.5, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.18, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);

  // 3. Ethereal soaring astral chime (E6 1318.5Hz + E7 2637Hz)
  const chime1 = ctx.createOscillator();
  chime1.type = "sine";
  chime1.frequency.setValueAtTime(1318.5, now);

  const chime2 = ctx.createOscillator();
  chime2.type = "sine";
  chime2.frequency.setValueAtTime(2637, now);

  const chimeGain = ctx.createGain();
  chimeGain.gain.setValueAtTime(0.01, now);
  chimeGain.gain.linearRampToValueAtTime(0.16, now + 0.02);
  chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

  chime1.connect(chimeGain);
  chime2.connect(chimeGain);
  chimeGain.connect(ctx.destination);

  sliceOsc.start(now);
  noise.start(now);
  chime1.start(now);
  chime2.start(now);

  sliceOsc.stop(now + 0.2);
  noise.stop(now + 0.2);
  chime1.stop(now + 0.45);
  chime2.stop(now + 0.45);
}

/**
 * Game Over victory fanfare chord.
 */
export function playGameOverSound(): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.65);
  });
}
