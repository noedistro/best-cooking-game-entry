// kitchen.js — the kitchen itself: exactly six stations, the chef, movement and
// the bin (a disposal slot on the plating counter, never a station).
import { CANVAS_W, CANVAS_H, CHEF_SPEED } from './config.js';

// The six stations, in the order a dish travels them. Positions are canvas
// rectangles on the 1280x720 floor; the order board sits above them and is
// not a station.
export const STATIONS = [
  { id: 'pantry', name: 'Pantry', x: 24, y: 130, w: 180, h: 270 },
  { id: 'chopping', name: 'Chopping Board', x: 280, y: 380, w: 200, h: 120 },
  { id: 'grill', name: 'Charcoal Grill', x: 560, y: 380, w: 200, h: 130 },
  { id: 'pot', name: 'Stove Pot', x: 820, y: 380, w: 180, h: 130 },
  { id: 'plating', name: 'Plating Counter', x: 280, y: 540, w: 480, h: 110 },
  { id: 'window', name: 'Serving Window', x: 1060, y: 540, w: 196, h: 110 },
];

export function stationById(id) {
  if (typeof id !== 'string') return null;
  return STATIONS.find((s) => s.id === id) ?? null;
}

// The station whose rectangle holds the point, or null.
export function stationAt(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return STATIONS.find((s) => x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) ?? null;
}

// The bin: a small disposal slot at the right end of the plating counter,
// for burnt food only. It lives inside the plating rectangle on purpose.
export const BIN_SLOT = { x: 700, y: 540, w: 60, h: 110 };

export function isBinSlot(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') return false;
  return x >= BIN_SLOT.x && x <= BIN_SLOT.x + BIN_SLOT.w
    && y >= BIN_SLOT.y && y <= BIN_SLOT.y + BIN_SLOT.h;
}

export function createChef() {
  return { x: 640, y: 500, held: null, speed: CHEF_SPEED, facing: 1 };
}

// Move the chef by a direction vector for dt seconds, clamped to the floor.
export function moveChef(chef, dir, dt) {
  if (!chef || typeof chef !== 'object') return chef;
  if (!dir || typeof dir.x !== 'number' || typeof dir.y !== 'number') return chef;
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return chef;
  const len = Math.hypot(dir.x, dir.y);
  if (len === 0) return chef;
  const nx = chef.x + (dir.x / len) * chef.speed * dt;
  const ny = chef.y + (dir.y / len) * chef.speed * dt;
  chef.x = Math.max(20, Math.min(CANVAS_W - 20, nx));
  chef.y = Math.max(120, Math.min(CANVAS_H - 20, ny));
  if (dir.x !== 0) chef.facing = dir.x > 0 ? 1 : -1;
  return chef;
}

// Distance from a point to a station rectangle (0 when inside it).
export function distanceToStation(point, station) {
  if (!point || !station) return Infinity;
  const dx = Math.max(station.x - point.x, 0, point.x - (station.x + station.w));
  const dy = Math.max(station.y - point.y, 0, point.y - (station.y + station.h));
  return Math.hypot(dx, dy);
}

// The nearest station within reach, or null when nothing is close enough.
export function nearestStation(chef, maxDistance = 100) {
  if (!chef) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const station of STATIONS) {
    const d = distanceToStation(chef, station);
    if (d < bestDistance) {
      bestDistance = d;
      best = station;
    }
  }
  return bestDistance <= maxDistance ? best : null;
}
