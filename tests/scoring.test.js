// scoring.test.js — coins, tips, streaks, combo multiplier, shift totals.
// Serves score through plating.scoreServe; tips through orders.tipFor.
// TDD first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTicket, tipFor } from '../game/src/orders.js';
import { createPlate, addLayer, scoreServe, comboMultiplier } from '../game/src/plating.js';
import { recipeById, RECIPES } from '../game/src/recipes.js';
import { createRng } from '../game/src/random.js';

function servedTicket(patience, maxPatience) {
  const ticket = createTicket('order-x', RECIPES[0], createRng(3), false);
  ticket.patience = patience;
  ticket.maxPatience = maxPatience;
  return ticket;
}

function readyPlate() {
  const plate = createPlate(recipeById('arang-chicken-rice'));
  addLayer(plate, 'rice');
  addLayer(plate, 'chicken');
  addLayer(plate, 'greens');
  return plate;
}

test('score starts at 0 and an on-time serve adds base + tip', () => {
  const ticket = servedTicket(120, 120);
  const result = scoreServe(readyPlate(), ticket, 0);
  assert.equal(result.ok, true);
  assert.equal(result.coins, 50, 'full patience pays base 10 + full bonus 40');
  assert.equal(result.newStreak, 1, 'first on-time serve starts the streak');
  assert.equal(result.multiplier, 1, 'streak 1 multiplies by 1');
  assert.equal(result.score, 50);
});

test('combo multiplier grows with the streak and caps at x3', () => {
  assert.equal(comboMultiplier(0), 1);
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(2), 2);
  assert.equal(comboMultiplier(3), 3);
  assert.equal(comboMultiplier(10), 3, 'the combo caps at x3');
  assert.equal(comboMultiplier(-1), 1, 'negative streak is treated as none');
  const ticket = servedTicket(120, 120);
  const second = scoreServe(readyPlate(), ticket, 1);
  assert.equal(second.newStreak, 2);
  assert.equal(second.multiplier, 2);
  assert.equal(second.score, 100, 'second consecutive serve scores double');
  const fourth = scoreServe(readyPlate(), ticket, 3);
  assert.equal(fourth.multiplier, 3);
  assert.equal(fourth.score, 150, 'the x3 cap applies from the third streak on');
});

test('a late serve (patience nearly gone) pays almost the base only', () => {
  const ticket = servedTicket(1, 120);
  // 1 s of 120 left: fraction 1/120, bonus round(40 * (1/120) / 0.5) = 1.
  assert.equal(tipFor(ticket), 11, '1 s left of 120 pays base 10 + 1 bonus');
  const result = scoreServe(readyPlate(), ticket, 0);
  assert.equal(result.coins, 11);
  assert.equal(result.score, 11);
});

test('serving an incomplete plate is refused and scores nothing', () => {
  const plate = createPlate(recipeById('arang-chicken-rice'));
  addLayer(plate, 'rice');
  const ticket = servedTicket(100, 120);
  const result = scoreServe(plate, ticket, 2);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'incomplete');
  assert.equal(scoreServe(null, ticket, 0).ok, false, 'null plate refused');
  assert.equal(scoreServe(readyPlate(), null, 0).ok, false, 'null ticket refused');
});

test('score stays a finite non-negative integer at extreme values', () => {
  const ticket = servedTicket(120, 120);
  let total = 0;
  let streak = 0;
  for (let i = 0; i < 1000; i++) {
    const result = scoreServe(readyPlate(), ticket, streak);
    assert.ok(Number.isInteger(result.score) && result.score >= 0 && Number.isFinite(result.score));
    total += result.score;
    streak = result.newStreak;
  }
  // Serve 1 scores 50 (x1), serve 2 scores 100 (x2), serves 3-1000 score 150 (x3 cap).
  assert.equal(total, 50 + 100 + 998 * 150, 'totals match the sum of individual serves');
  assert.ok(Number.isFinite(total) && total > 0);
});

test('results totals match the sum of individual serves', () => {
  const serves = [
    { patience: 120, max: 120, streakBefore: 0 },
    { patience: 60, max: 120, streakBefore: 1 },
    { patience: 30, max: 120, streakBefore: 2 },
  ];
  let totalCoins = 0;
  let totalScore = 0;
  let streak = 0;
  let dishes = 0;
  for (const s of serves) {
    const ticket = servedTicket(s.patience, s.max);
    const result = scoreServe(readyPlate(), ticket, streak);
    assert.equal(result.ok, true);
    totalCoins += result.coins;
    totalScore += result.score;
    streak = result.newStreak;
    dishes++;
  }
  // Serve 1: 50 coins x1 = 50. Serve 2: 50 coins (50% patience -> full bonus) x2 = 100.
  // Serve 3: 25% patience -> base 10 + half bonus 20 = 30 coins x3 = 90.
  assert.equal(totalCoins, 130);
  assert.equal(totalScore, 240);
  assert.equal(dishes, 3);
  assert.equal(streak, 3);
});
