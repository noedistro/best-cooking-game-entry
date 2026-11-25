// cooking.test.js — chopping / grilling / boiling state machines and plating:
// start, progress, ready, burnt, bin, layer-order validation, serving.
// Invalid transitions return a defined error value, never a throw.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startChop, tickChop, finishChop,
  startCook, tickCook, takeCooked, binJob, cookStateAt,
} from '../game/src/cooking.js';
import { createPlate, addLayer, plateReady, resetPlate } from '../game/src/plating.js';
import { recipeById } from '../game/src/recipes.js';

test('chop: idle -> chopping -> chopped, progress never exceeds 1', () => {
  const started = startChop('chicken');
  assert.equal(started.ok, true);
  const job = started.job;
  assert.equal(job.progress, 0);
  assert.equal(job.done, false);
  tickChop(job, 0.4);
  assert.ok(job.progress > 0 && job.progress < 1, 'halfway through chopping');
  tickChop(job, 10);
  assert.equal(job.progress, 1, 'progress clamps at 1');
  assert.equal(job.done, true);
  const finished = finishChop(job);
  assert.equal(finished.ok, true);
  assert.equal(finished.item, 'chicken');
  assert.equal(finished.chopped, true);
  // Chopping an already-chopped item is a no-op, not an error.
  const again = finishChop(job);
  assert.equal(again.ok, true, 're-finishing a done chop still reports the item');
});

test('chop rejects what cannot be chopped, with an error value', () => {
  assert.equal(startChop('rice').ok, false, 'rice is boiled, not chopped');
  assert.equal(startChop('sauce').ok, false, 'sauce needs no prep');
  assert.equal(startChop('unicorn').ok, false, 'unknown ingredient');
  assert.equal(startChop(null).ok, false, 'null ingredient');
  assert.equal(startChop(42).ok, false, 'wrong-type ingredient');
  const early = startChop('greens').job;
  assert.equal(finishChop(early).ok, false, 'finishing before the chop completes is refused');
  assert.equal(tickChop(null, 1), null, 'ticking a null job returns null, never throws');
  assert.equal(tickChop(early, NaN), early, 'NaN dt leaves the job untouched');
  assert.equal(tickChop(early, -1), early, 'negative dt leaves the job untouched');
});

test('grill: raw -> grilling -> ready in the green window -> burnt past the burn point', () => {
  const started = startCook('chicken', 'grill');
  assert.equal(started.ok, true);
  const job = started.job;
  assert.equal(job.state, 'cooking');
  tickCook(job, job.readyAt - 0.5);
  assert.equal(job.state, 'cooking', 'just before the ready point it is still cooking');
  tickCook(job, 0.5);
  assert.equal(job.state, 'ready', 'exactly at the ready point it is ready');
  assert.equal(takeCooked(job).ok, true, 'a ready item can be taken');
  // A second grill job left too long burns.
  const late = startCook('tofu', 'grill').job;
  tickCook(late, late.burnAt);
  assert.equal(late.state, 'burnt', 'exactly at the burn point it is burnt');
  assert.equal(takeCooked(late).ok, false, 'a burnt item cannot be taken as cooked');
  assert.equal(takeCooked(late).error, 'burnt');
  const binned = binJob(late);
  assert.equal(binned.ok, true, 'a burnt item can only go to the bin');
  assert.equal(binJob(job).ok, false, 'a ready (not burnt) item cannot be binned');
});

test('pot: same ready/burnt shape with different timings; fish steams, chicken does not', () => {
  const fish = startCook('fish', 'pot');
  assert.equal(fish.ok, true, 'fish steams in the pot');
  assert.notEqual(fish.job.readyAt, startCook('chicken', 'grill').job.readyAt, 'pot and grill timings differ');
  const wrong = startCook('chicken', 'pot');
  assert.equal(wrong.ok, false, 'chicken belongs on the grill, not in the pot');
  assert.equal(startCook('greens', 'grill').ok, false, 'greens are chopped, never grilled');
  assert.equal(startCook('rice', 'grill').ok, false, 'rice belongs in the pot');
  assert.equal(startCook('rice', 'pot').ok, true, 'rice boils in the pot');
  assert.equal(startCook(null, 'pot').ok, false, 'null ingredient rejected');
  assert.equal(startCook('chicken', 'moon').ok, false, 'unknown station rejected');
  assert.equal(takeCooked(null).ok, false, 'taking from a null job is an error value');
  assert.equal(binJob(null).ok, false, 'binning a null job is an error value');
});

test('cookStateAt boundaries: exactly ready, exactly burnt, and the green window', () => {
  assert.equal(cookStateAt(0, 6, 11), 'cooking');
  assert.equal(cookStateAt(5.999, 6, 11), 'cooking');
  assert.equal(cookStateAt(6, 6, 11), 'ready', 'exactly the ready point is ready');
  assert.equal(cookStateAt(8, 6, 11), 'ready', 'inside the green window is ready');
  assert.equal(cookStateAt(10.999, 6, 11), 'ready');
  assert.equal(cookStateAt(11, 6, 11), 'burnt', 'exactly the burn point is burnt');
  assert.equal(cookStateAt(99, 6, 11), 'burnt');
  assert.equal(cookStateAt(NaN, 6, 11), 'cooking', 'NaN elapsed is treated as not started');
});

test('plating accepts layers only in recipe order and refuses wrong ones unchanged', () => {
  const recipe = recipeById('arang-chicken-rice');
  const plate = createPlate(recipe);
  assert.equal(plate.layers.length, 0);
  assert.equal(plateReady(plate), false);
  const wrong = addLayer(plate, 'chicken');
  assert.equal(wrong.ok, false, 'main before base is refused');
  assert.equal(wrong.error, 'wrong-order');
  assert.equal(plate.layers.length, 0, 'a refused layer leaves the plate unchanged');
  assert.equal(addLayer(plate, 'rice').ok, true);
  assert.equal(addLayer(plate, 'rice').ok, false, 'a duplicate base is refused');
  assert.equal(addLayer(plate, 'chicken').ok, true);
  assert.equal(plateReady(plate), false, 'two of three layers is not ready');
  assert.equal(addLayer(plate, 'greens').ok, true);
  assert.equal(plateReady(plate), true, 'three layers in order is ready to serve');
  assert.equal(addLayer(plate, 'sauce').ok, false, 'a full plate refuses more layers');
});

test('plating handles bad input gracefully and two plates never share state', () => {
  assert.equal(createPlate(null), null, 'null recipe makes no plate');
  assert.equal(createPlate({ id: 'x' }), null, 'recipe without layers makes no plate');
  assert.equal(addLayer(null, 'rice').ok, false, 'null plate is an error value');
  const recipe = recipeById('arang-chicken-rice');
  const a = createPlate(recipe);
  const b = createPlate(recipe);
  addLayer(a, 'rice');
  addLayer(a, 'chicken');
  assert.equal(a.layers.length, 2, 'plate A has two layers');
  assert.equal(b.layers.length, 0, 'plate B is untouched by plate A');
  resetPlate(a);
  assert.equal(a.layers.length, 0, 'reset clears the plate for the next dish');
  assert.equal(plateReady(a), false);
});
