// orders.test.js — order tickets: spawn, patience ranges, decay, expiry, tips,
// board sorting, live-ticket caps, rush phases, shift timer. TDD first.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTicket, tickTicket, tipAmount, tipFor, sortBoard,
  rushPhaseAtRemaining, maxLiveTickets, spawnTicket, shiftRemaining,
} from '../game/src/orders.js';
import { RECIPES } from '../game/src/recipes.js';
import { createRng } from '../game/src/random.js';

const rng = () => createRng(7);

test('spawn creates a ticket with id, dish, patience and tip in range', () => {
  const ticket = createTicket('order-1', RECIPES[0], rng(), false);
  assert.equal(ticket.id, 'order-1');
  assert.equal(ticket.recipeId, RECIPES[0].id);
  assert.ok(ticket.patience >= 90 && ticket.patience <= 120, `normal patience 90-120, got ${ticket.patience}`);
  assert.equal(ticket.maxPatience, ticket.patience);
  assert.equal(ticket.state, 'active');
  assert.ok(ticket.baseTip > 0 && ticket.bonusTip > 0);
});

test('patience is 70-90 s during a rush', () => {
  for (let i = 0; i < 50; i++) {
    const ticket = createTicket(`order-r${i}`, RECIPES[i % 12], createRng(i + 1), true);
    assert.ok(ticket.patience >= 70 && ticket.patience <= 90, `rush patience 70-90, got ${ticket.patience}`);
  }
});

test('patience decays linearly and hits exactly 0 at expiry', () => {
  const ticket = createTicket('order-2', RECIPES[1], rng(), false);
  ticket.patience = 10;
  ticket.maxPatience = 100;
  assert.equal(tickTicket(ticket, 4), 'active');
  assert.equal(ticket.patience, 6);
  assert.equal(tickTicket(ticket, 6), 'expired');
  assert.equal(ticket.patience, 0, 'patience clamps at 0, never negative');
  assert.equal(ticket.state, 'expired');
  assert.equal(tickTicket(ticket, 5), 'expired', 'ticking an expired ticket stays expired');
});

test('tick handles wrong types and extreme dt gracefully, never throws', () => {
  const ticket = createTicket('order-3', RECIPES[2], rng(), false);
  const before = ticket.patience;
  assert.equal(tickTicket(ticket, NaN), 'active');
  assert.equal(ticket.patience, before);
  assert.equal(tickTicket(ticket, -5), 'active', 'negative dt ignored');
  assert.equal(ticket.patience, before);
  assert.equal(tickTicket(ticket, 'x'), 'active');
  assert.equal(tickTicket(null, 1), null, 'null ticket returns null');
  assert.equal(tickTicket(ticket, 10000), 'expired', '10,000 s in one frame expires cleanly');
  assert.equal(ticket.patience, 0);
});

test('tip scales with remaining patience: full bonus at >=50%, base only at expiry', () => {
  assert.equal(tipAmount(10, 40, 1), 50, 'full patience pays base + full bonus');
  assert.equal(tipAmount(10, 40, 0.5), 50, 'exactly 50% still pays the full bonus');
  assert.equal(tipAmount(10, 40, 0.75), 50, 'above 50% pays the full bonus');
  assert.equal(tipAmount(10, 40, 0.25), 30, '25% left pays base + half the bonus');
  assert.equal(tipAmount(10, 40, 0), 10, 'at expiry only the base payment remains');
  assert.equal(tipAmount(10, 40, -0.5), 10, 'negative fraction clamps to base only');
  assert.equal(tipAmount(10, 40, 2), 50, 'fraction above 1 clamps to the full bonus');
  assert.equal(tipAmount(0, 0, 0.5), 0, 'zero tip values stay zero');
  const ticket = createTicket('order-4', RECIPES[3], rng(), false);
  ticket.patience = 60;
  ticket.maxPatience = 120;
  assert.equal(tipFor(ticket), 50, 'tipFor uses the ticket fraction (50% -> full bonus)');
  ticket.patience = 0;
  assert.equal(tipFor(ticket), 10, 'expired ticket pays base only');
});

test('board sorts by patience ascending, most urgent first, stable on ties', () => {
  const mk = (id, patience) => ({ id, patience, maxPatience: 100, state: 'active' });
  const board = [mk('a', 50), mk('b', 10), mk('c', 50), mk('d', 30)];
  const sorted = sortBoard(board);
  assert.deepEqual(sorted.map((t) => t.id), ['b', 'd', 'a', 'c'], 'ties keep their original order');
  assert.notEqual(sorted, board, 'sort returns a new array, does not mutate the board');
});

test('rush phases fire at exactly 120, 75 and 35 s remaining', () => {
  assert.equal(rushPhaseAtRemaining(180), 0);
  assert.equal(rushPhaseAtRemaining(121), 0);
  assert.equal(rushPhaseAtRemaining(120), 1, 'Rush 1 at 120 s remaining');
  assert.equal(rushPhaseAtRemaining(76), 1);
  assert.equal(rushPhaseAtRemaining(75), 2, 'Rush 2 at 75 s remaining');
  assert.equal(rushPhaseAtRemaining(36), 2);
  assert.equal(rushPhaseAtRemaining(35), 3, 'Rush 3 at 35 s remaining');
  assert.equal(rushPhaseAtRemaining(0), 3);
  assert.equal(rushPhaseAtRemaining(-5), 3, 'negative remaining is still the last rush');
});

test('max live tickets grows 2 -> 3 -> 4 across rush phases', () => {
  assert.equal(maxLiveTickets(0), 2);
  assert.equal(maxLiveTickets(1), 3);
  assert.equal(maxLiveTickets(2), 3);
  assert.equal(maxLiveTickets(3), 4);
  assert.equal(maxLiveTickets(99), 2, 'unknown phase falls back to the calm cap');
  assert.equal(maxLiveTickets(-1), 2);
  assert.ok(maxLiveTickets(0) <= maxLiveTickets(1) && maxLiveTickets(1) <= maxLiveTickets(3), 'monotonic');
});

test('spawnTicket respects the cap, yields unique ids, and handles an empty recipe list', () => {
  const board = [];
  const first = spawnTicket(board, RECIPES, rng(), 0, 1);
  assert.ok(first, 'first spawn succeeds');
  board.push(first);
  const second = spawnTicket(board, RECIPES, rng(), 0, 2);
  assert.ok(second, 'second spawn succeeds at the phase-0 cap of 2');
  board.push(second);
  assert.equal(spawnTicket(board, RECIPES, rng(), 0, 3), null, 'third spawn refused at the cap');
  assert.equal(spawnTicket([], [], rng(), 0, 4), null, 'empty recipe list spawns nothing, no crash');
  assert.equal(spawnTicket([], null, rng(), 0, 5), null, 'null recipe list spawns nothing, no crash');
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(spawnTicket([], RECIPES, createRng(i), 0, i).id);
  assert.equal(ids.size, 100, '100 spawns yield 100 unique ids');
});

test('shift timer counts 180 down to 0 and never goes negative', () => {
  assert.equal(shiftRemaining(0), 180);
  assert.equal(shiftRemaining(29), 151, '29 s elapsed leaves 02:31 — the cover-shot timer');
  assert.equal(shiftRemaining(60), 120, 'Rush 1 at 60 s elapsed');
  assert.equal(shiftRemaining(180), 0);
  assert.equal(shiftRemaining(500), 0, 'past the end stays 0');
  assert.equal(shiftRemaining(NaN), 180, 'bad elapsed treated as the shift start');
  assert.equal(shiftRemaining(-10), 180, 'negative elapsed treated as the shift start');
});
