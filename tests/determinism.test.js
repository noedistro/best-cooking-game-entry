// determinism.test.js — seeded RNG, shuffle, and the staged ?shot= mode:
// same seed -> same sequence, bad params fall back gracefully, never a blank screen.
// TDD first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng, mulberry32, shuffle, pick, intInRange } from '../game/src/random.js';
import { parseShotParams, buildStagedScene } from '../game/src/shots.js';

test('same seed gives the same sequence, different seeds differ', () => {
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b(), `draw ${i} matches`);
  const c = createRng(43);
  assert.notEqual(a(), c(), 'a different seed draws differently');
  assert.notEqual(createRng(1)(), createRng(2)());
});

test('seed 0, negative and huge seeds are deterministic and never NaN', () => {
  for (const seed of [0, -1, -999, 2147483647, 4294967295, 1e12, 2 ** 53 - 1]) {
    const first = createRng(seed);
    const second = createRng(seed);
    for (let i = 0; i < 20; i++) {
      const v = first();
      assert.ok(Number.isFinite(v) && v >= 0 && v < 1, `seed ${seed}: draw in [0,1)`);
      assert.equal(v, second(), `seed ${seed}: deterministic`);
      assert.ok(!Number.isNaN(v), 'never NaN');
    }
  }
  assert.equal(createRng(NaN)(), createRng(1)(), 'NaN seed falls back to seed 1');
  assert.equal(createRng('x')(), createRng(1)(), 'wrong-type seed falls back to seed 1');
  assert.equal(createRng(null)(), createRng(1)(), 'null seed falls back to seed 1');
});

test('mulberry32 is the same generator createRng wraps', () => {
  const a = mulberry32(9);
  const b = createRng(9);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test('shuffle is deterministic per seed and never mutates its input', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const once = shuffle(input, createRng(5));
  const twice = shuffle(input, createRng(5));
  assert.deepEqual(once, twice, 'same seed shuffles the same way');
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8], 'input untouched');
  assert.deepEqual([...once].sort((x, y) => x - y), input, 'a shuffle is a permutation');
  assert.notDeepEqual(shuffle(input, createRng(6)), shuffle(input, createRng(7)), 'different seeds shuffle differently');
  assert.deepEqual(shuffle([], createRng(1)), [], 'empty input shuffles to empty');
  assert.deepEqual(shuffle([7], createRng(1)), [7], 'one element stays put');
});

test('pick and intInRange handle empty input and inverted bounds gracefully', () => {
  assert.equal(pick(createRng(1), []), null, 'picking from nothing returns null');
  assert.equal(pick(createRng(1), null), null, 'picking from null returns null');
  assert.equal(pick(createRng(1), ['only']), 'only');
  assert.equal(intInRange(createRng(1), 5, 5), 5, 'a zero-width range returns its bound');
  for (let i = 0; i < 50; i++) {
    const v = intInRange(createRng(i), 90, 120);
    assert.ok(v >= 90 && v <= 120, `in range 90-120, got ${v}`);
  }
  assert.equal(intInRange(createRng(1), 10, 5), 10, 'inverted bounds fall back to the lower bound');
});

test('parseShotParams: known shots parse, bad values fall back to normal play', () => {
  assert.deepEqual(parseShotParams('?shot=cover&seed=1'), { shot: 'cover', seed: 1 });
  assert.deepEqual(parseShotParams('?shot=play&seed=7'), { shot: 'play', seed: 7 });
  assert.deepEqual(parseShotParams('?shot=rush&seed=2'), { shot: 'rush', seed: 2 });
  assert.deepEqual(parseShotParams('?shot=serve&seed=3'), { shot: 'serve', seed: 3 });
  assert.deepEqual(parseShotParams('?shot=bogus&seed=1'), { shot: null, seed: 1 }, 'unknown shot falls back to normal play');
  assert.deepEqual(parseShotParams('?shot=cover&seed=abc'), { shot: 'cover', seed: 1 }, 'bad seed defaults to 1');
  assert.deepEqual(parseShotParams('?shot=cover'), { shot: 'cover', seed: 1 }, 'missing seed defaults to 1');
  assert.deepEqual(parseShotParams(''), { shot: null, seed: 1 }, 'no query means normal play');
  assert.deepEqual(parseShotParams(null), { shot: null, seed: 1 }, 'null query means normal play');
  assert.deepEqual(parseShotParams('?shot=cover&seed=-4'), { shot: 'cover', seed: 4 }, 'negative seed is made positive');
  assert.deepEqual(parseShotParams('?shot=COVER&seed=1'), { shot: null, seed: 1 }, 'shot names are case-sensitive, unknown casing falls back');
});

test('cover scene holds every criterion-1 element in one frame', () => {
  const scene = buildStagedScene('cover', 1);
  assert.equal(scene.shot, 'cover');
  assert.equal(scene.tickets.length, 3, 'order board shows 3 tickets');
  assert.equal(scene.remaining, 151, 'timer pinned at 02:31 (29 s elapsed, before Rush 1)');
  assert.equal(scene.counterIngredients.length >= 3, true, 'ingredients lie ON a counter surface');
  assert.equal(scene.plating.layers.length, 2, 'a plate mid-assembly with 2 of 3 layers');
  assert.equal(scene.windowDish, 'arang-chicken-rice', 'a separate finished dish waits on the serving window');
  assert.notEqual(scene.plating.recipeId, null);
  assert.ok(scene.score >= 0, 'a score is visible');
  assert.equal(scene.chef.held, null, 'the chef is free-handed in the cover pose');
});

test('play, rush and serve scenes stage their own moments', () => {
  const play = buildStagedScene('play', 1);
  assert.equal(play.tickets.length, 2);
  assert.equal(play.chef.held, 'chicken', 'the chef carries chopped chicken toward the grill');
  assert.equal(play.plating.layers.length, 1, 'a plate half-built on the counter');

  const rush = buildStagedScene('rush', 1);
  assert.equal(rush.tickets.length, 4, 'the board is full in a rush');
  assert.equal(rush.rush, true, 'the RUSH banner is up');
  assert.equal(rush.tickets.filter((t) => t.patience < 10).length, 2, 'two patience bars run red');
  assert.equal(rush.grillItem, 'chicken', 'the grill is busy');
  assert.equal(rush.potItem, 'fish', 'the pot is busy');

  const serve = buildStagedScene('serve', 1);
  assert.equal(serve.windowDish, 'arang-chicken-rice', 'the finished dish is at the window');
  assert.equal(serve.tipPopup, '+45', 'the tip popup is visible');
  assert.equal(serve.streak, 3, 'the streak flame is lit');
});

test('staged scenes are deterministic per seed and unknown shots return null', () => {
  const a = buildStagedScene('cover', 1);
  const b = buildStagedScene('cover', 1);
  assert.deepEqual(a, b, 'same shot and seed stage the same scene');
  assert.notDeepEqual(buildStagedScene('cover', 1), buildStagedScene('cover', 2), 'a different seed stages a different scene');
  assert.equal(buildStagedScene('bogus', 1), null, 'an unknown shot stages nothing');
  assert.equal(buildStagedScene(null, 1), null, 'a null shot stages nothing');
});
