// orders.js — order tickets: spawn, patience decay, expiry, tips, board
// sorting, rush phases and the shift timer. All pure logic, no DOM.
import {
  SHIFT_SECONDS, RUSH_REMAINING, MAX_TICKETS_BY_PHASE,
  PATIENCE_NORMAL, PATIENCE_RUSH, BASE_TIP, BONUS_TIP,
} from './config.js';
import { intInRange } from './random.js';

// Which rush phase the shift is in, from seconds remaining: 0 calm, then
// rushes at exactly 120, 75 and 35 seconds remaining.
export function rushPhaseAtRemaining(remaining) {
  if (typeof remaining !== 'number' || Number.isNaN(remaining)) return 0;
  if (remaining > RUSH_REMAINING[0]) return 0;
  if (remaining > RUSH_REMAINING[1]) return 1;
  if (remaining > RUSH_REMAINING[2]) return 2;
  return 3;
}

export function maxLiveTickets(phase) {
  if (!Number.isInteger(phase) || phase < 0 || phase >= MAX_TICKETS_BY_PHASE.length) return 2;
  return MAX_TICKETS_BY_PHASE[phase];
}

// Seconds left in the shift after `elapsed` seconds; never negative.
export function shiftRemaining(elapsed) {
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0) return SHIFT_SECONDS;
  return Math.max(0, SHIFT_SECONDS - elapsed);
}

export function createTicket(id, recipe, rng, rush) {
  const range = rush ? PATIENCE_RUSH : PATIENCE_NORMAL;
  const patience = intInRange(rng, range.min, range.max);
  return {
    id,
    recipeId: recipe.id,
    recipeName: recipe.name,
    base: recipe.base,
    main: recipe.main,
    topping: recipe.topping,
    patience,
    maxPatience: patience,
    baseTip: BASE_TIP,
    bonusTip: BONUS_TIP,
    state: 'active',
  };
}

// Advance one ticket's patience by dt seconds. Returns 'active' or 'expired'.
export function tickTicket(ticket, dt) {
  if (!ticket || typeof ticket !== 'object') return null;
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return ticket.state;
  if (ticket.state === 'expired') return 'expired';
  ticket.patience = Math.max(0, ticket.patience - dt);
  if (ticket.patience === 0) {
    ticket.state = 'expired';
    return 'expired';
  }
  return 'active';
}

// The tip for a patience fraction: the full bonus at 50% or more remaining,
// tapering linearly to the base payment alone at expiry.
export function tipAmount(base, bonus, fraction) {
  if (typeof base !== 'number' || typeof bonus !== 'number') return 0;
  const f = typeof fraction !== 'number' || !Number.isFinite(fraction)
    ? 0
    : Math.max(0, Math.min(1, fraction));
  const factor = f >= 0.5 ? 1 : f / 0.5;
  return base + Math.round(bonus * factor);
}

export function tipFor(ticket) {
  if (!ticket || typeof ticket !== 'object') return 0;
  const fraction = ticket.maxPatience > 0 ? ticket.patience / ticket.maxPatience : 0;
  return tipAmount(ticket.baseTip, ticket.bonusTip, fraction);
}

// Most urgent first (least patience), stable when two tickets tie.
export function sortBoard(tickets) {
  if (!Array.isArray(tickets)) return [];
  return tickets
    .map((ticket, index) => ({ ticket, index }))
    .sort((a, b) => (a.ticket.patience - b.ticket.patience) || (a.index - b.index))
    .map((entry) => entry.ticket);
}

// Spawn one ticket onto the board, or null when the cap is reached or there
// is nothing to cook. `phase` is the rush phase; `nextId` keeps ids unique.
export function spawnTicket(board, recipes, rng, phase, nextId) {
  if (!Array.isArray(recipes) || recipes.length === 0) return null;
  if (!Array.isArray(board)) return null;
  const safePhase = Number.isInteger(phase) ? phase : 0;
  if (board.length >= maxLiveTickets(safePhase)) return null;
  const rand = typeof rng === 'function' ? rng : null;
  const recipe = recipes[Math.floor((rand ? rand() : 0.5) * recipes.length)];
  return createTicket(`order-${nextId}`, recipe, rng, safePhase > 0);
}
