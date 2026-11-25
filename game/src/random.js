// random.js — a small seeded RNG (mulberry32, written fresh) plus the helpers
// the game uses for deterministic spawns and shuffles. No Math.random anywhere
// in game logic: a seed fully decides what a shift looks like.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Normalize any seed to a deterministic uint32; bad input falls back to 1.
export function normalizeSeed(seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) return 1;
  const n = Math.abs(Math.floor(seed)) >>> 0;
  return n === 0 && seed !== 0 ? 1 : n;
}

export function createRng(seed) {
  return mulberry32(normalizeSeed(seed));
}

// Fisher-Yates on a copy: the input array is never mutated.
export function shuffle(array, rng) {
  if (!Array.isArray(array)) return [];
  const out = [...array];
  const rand = typeof rng === 'function' ? rng : createRng(1);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pick(rng, array) {
  if (!Array.isArray(array) || array.length === 0) return null;
  const rand = typeof rng === 'function' ? rng : createRng(1);
  return array[Math.floor(rand() * array.length)];
}

// An integer in [min, max], inclusive; inverted bounds fall back to min.
export function intInRange(rng, min, max) {
  if (typeof min !== 'number' || typeof max !== 'number') return 0;
  if (max < min) return min;
  const rand = typeof rng === 'function' ? rng : createRng(1);
  return Math.floor(rand() * (max - min + 1)) + min;
}
