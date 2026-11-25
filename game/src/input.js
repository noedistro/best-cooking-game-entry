// input.js — keyboard input mapping: which keys move, which act, which
// mute or restart. Pure functions only; the browser listener lives in main.js.
// Unknown keys and malformed events are ignored, never thrown.
import { KEYS } from './config.js';

const DIRECTIONS = new Map();
for (const key of KEYS.up) DIRECTIONS.set(key, { x: 0, y: -1 });
for (const key of KEYS.down) DIRECTIONS.set(key, { x: 0, y: 1 });
for (const key of KEYS.left) DIRECTIONS.set(key, { x: -1, y: 0 });
for (const key of KEYS.right) DIRECTIONS.set(key, { x: 1, y: 0 });

const ACTIONS = new Map();
for (const key of KEYS.interact) ACTIONS.set(key, 'interact');
for (const key of KEYS.mute) ACTIONS.set(key, 'mute');
for (const key of KEYS.restart) ACTIONS.set(key, 'restart');

// The movement vector for a key, or null when the key does not move.
export function directionForKey(key) {
  if (typeof key !== 'string') return null;
  const found = DIRECTIONS.get(key);
  return found ? { x: found.x, y: found.y } : null;
}

// The action for a key ('interact' | 'mute' | 'restart'), or null.
export function actionForKey(key) {
  if (typeof key !== 'string') return null;
  return ACTIONS.get(key) ?? null;
}

// Pull the key out of a keyboard event, or null for a malformed event.
export function normalizeKeyEvent(event) {
  if (!event || typeof event !== 'object') return null;
  if (typeof event.key !== 'string' || event.key === '') return null;
  return { key: event.key };
}

// True when the event is a held-key repeat: interact must not double-trigger.
export function isRepeat(event) {
  return !!(event && typeof event === 'object' && event.repeat === true);
}
