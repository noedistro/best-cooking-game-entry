// config.js — the game's constants: canvas, shift, rushes, patience, tips,
// cooking timings, colours, key bindings. One place, no magic numbers elsewhere.
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

// One shift lasts 180 seconds; rushes fire at fixed moments of time remaining.
export const SHIFT_SECONDS = 180;
export const RUSH_REMAINING = [120, 75, 35];
export const MAX_TICKETS_BY_PHASE = [2, 3, 3, 4];

// Ticket patience: 90-120 s in normal play, 70-90 s during a rush.
export const PATIENCE_NORMAL = { min: 90, max: 120 };
export const PATIENCE_RUSH = { min: 70, max: 90 };

// A serve pays a base plus a bonus scaled by remaining patience.
export const BASE_TIP = 10;
export const BONUS_TIP = 40;

// Cooking timings, in seconds. Chopping is a sub-second interaction by design.
export const CHOP_SECONDS = 0.8;
export const GRILL_READY_S = 6;
export const GRILL_BURN_S = 11;
export const POT_READY_S = 5;
export const POT_BURN_S = 10;

export const CHEF_SPEED = 260;

export const COLORS = {
  ember: '#e8632c',
  emberDeep: '#b8431a',
  teal: '#14524f',
  tealDeep: '#0d3634',
  cream: '#f7ead2',
  counter: '#e8cfa8',
  counterEdge: '#a97e4f',
  board: '#fff8e7',
  ink: '#2b1d12',
  gold: '#f2b234',
  red: '#d93a2b',
  green: '#3f9e4d',
};

// Key bindings: WASD + arrows move, E/Space interact, M mute, R restart.
export const KEYS = {
  up: ['w', 'W', 'ArrowUp'],
  down: ['s', 'S', 'ArrowDown'],
  left: ['a', 'A', 'ArrowLeft'],
  right: ['d', 'D', 'ArrowRight'],
  interact: ['e', 'E', ' '],
  mute: ['m', 'M'],
  restart: ['r', 'R'],
};
