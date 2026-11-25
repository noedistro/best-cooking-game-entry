// audio.js — every sound is synthesised with WebAudio oscillators and noise:
// no audio files, no network. The context is created lazily on the first
// user gesture and guarded, so a headless or staged render never touches it.
let context = null;
let muted = false;

export function setMuted(value) {
  muted = !!value;
}

export function isMuted() {
  return muted;
}

// Create (or reuse) the audio context. Returns null when audio is not
// available or not yet allowed: never throws, never blocks the first render.
export function ensureAudio() {
  if (typeof window === 'undefined') return null;
  if (muted) return null;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
    return context.state === 'running' ? context : null;
  } catch {
    return null;
  }
}

function tone(freq, seconds, type = 'sine', gain = 0.12, when = 0) {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = ctx.currentTime + when;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  } catch {
    // A failed blip is never a failed game.
  }
}

function noiseBurst(seconds, gain = 0.08, filterFreq = 1200) {
  const ctx = ensureAudio();
  if (!ctx) return;
  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const amp = ctx.createGain();
    amp.gain.value = gain;
    source.connect(filter);
    filter.connect(amp);
    amp.connect(ctx.destination);
    source.start();
  } catch {
    // A failed blip is never a failed game.
  }
}

export const sounds = {
  chop() { tone(180, 0.08, 'square', 0.1); noiseBurst(0.06, 0.1, 900); },
  pickup() { tone(520, 0.07, 'sine', 0.08); },
  place() { tone(340, 0.07, 'triangle', 0.09); },
  sizzle() { noiseBurst(0.35, 0.05, 2400); },
  ready() { tone(660, 0.12, 'sine', 0.09); tone(880, 0.16, 'sine', 0.08, 0.1); },
  bell() { tone(1046, 0.25, 'sine', 0.11); tone(1568, 0.3, 'sine', 0.07, 0.08); },
  error() { tone(140, 0.18, 'sawtooth', 0.08); },
  expire() { tone(220, 0.3, 'triangle', 0.07); tone(165, 0.35, 'triangle', 0.06, 0.12); },
  rush() { tone(392, 0.14, 'square', 0.07); tone(523, 0.14, 'square', 0.07, 0.13); tone(659, 0.2, 'square', 0.07, 0.26); },
};
