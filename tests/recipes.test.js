// recipes.test.js — the 12-recipe matrix (3 bases x 4 mains), validation rules,
// and the exactly-6-stations count the title promises. TDD: written before the
// game modules exist, so this file fails until recipes.js + kitchen.js land.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASES, MAINS, TOPPINGS, INGREDIENTS, RECIPES,
  validateRecipe, recipeById, buildSteps,
} from '../game/src/recipes.js';
import { STATIONS } from '../game/src/kitchen.js';

test('recipe matrix is exactly 3 bases x 4 mains = 12 recipes', () => {
  assert.equal(RECIPES.length, 12);
  assert.deepEqual([...BASES].sort(), ['flatbread', 'noodles', 'rice']);
  assert.deepEqual([...MAINS].sort(), ['chicken', 'fish', 'mushroom', 'tofu']);
  assert.deepEqual([...TOPPINGS].sort(), ['chilli', 'greens', 'sauce']);
  const pairs = new Set(RECIPES.map((r) => `${r.base}|${r.main}`));
  assert.equal(pairs.size, 12, 'every base x main pair present exactly once');
  for (const base of BASES) {
    assert.equal(RECIPES.filter((r) => r.base === base).length, 4, `${base} in 4 recipes`);
  }
  for (const main of MAINS) {
    assert.equal(RECIPES.filter((r) => r.main === main).length, 3, `${main} in 3 recipes`);
  }
});

test('every topping appears in exactly 4 recipes', () => {
  for (const topping of TOPPINGS) {
    assert.equal(RECIPES.filter((r) => r.topping === topping).length, 4, `${topping} in 4 recipes`);
  }
});

test('every recipe validates: base + main + topping, non-empty steps, real stations', () => {
  const stationIds = new Set(STATIONS.map((s) => s.id));
  for (const recipe of RECIPES) {
    const result = validateRecipe(recipe);
    assert.equal(result.ok, true, `${recipe.id}: ${result.error ?? ''}`);
    assert.ok(recipe.steps.length >= 2, `${recipe.id} has steps`);
    for (const step of recipe.steps) {
      assert.ok(INGREDIENTS[step.ingredient], `${recipe.id}: known ingredient ${step.ingredient}`);
      assert.ok(stationIds.has(step.station), `${recipe.id}: known station ${step.station}`);
    }
  }
});

test('the kitchen has exactly 6 stations and the bin is not one of them', () => {
  assert.equal(STATIONS.length, 6);
  const ids = STATIONS.map((s) => s.id).sort();
  assert.deepEqual(ids, ['chopping', 'grill', 'pantry', 'plating', 'pot', 'window']);
  assert.ok(!ids.includes('bin'), 'bin is a disposal slot on the plating counter, never a station');
});

test('recipe lookup by id returns the right steps in order', () => {
  const recipe = recipeById('arang-chicken-rice');
  assert.ok(recipe, 'known recipe found');
  assert.equal(recipe.base, 'rice');
  assert.equal(recipe.main, 'chicken');
  assert.equal(recipe.steps[0].ingredient, 'rice');
  assert.equal(recipe.steps[0].station, 'pot');
  assert.equal(recipeById('no-such-dish'), null, 'unknown id returns null');
  assert.equal(recipeById(null), null, 'null id returns null, never throws');
  assert.equal(recipeById(42), null, 'wrong-type id returns null, never throws');
});

test('buildSteps derives the route from the ingredient catalogue', () => {
  // Rice is boiled in the pot, chicken is chopped then grilled, greens are chopped.
  const steps = buildSteps('rice', 'chicken', 'greens');
  assert.deepEqual(steps.map((s) => s.station), ['pot', 'chopping', 'grill', 'chopping']);
  assert.deepEqual(steps.map((s) => s.ingredient), ['rice', 'chicken', 'chicken', 'greens']);
  // Fish steams in the pot; chilli needs no prep step at all.
  const fishSteps = buildSteps('noodles', 'fish', 'chilli');
  assert.deepEqual(fishSteps.map((s) => s.station), ['pot', 'chopping', 'pot']);
  assert.equal(fishSteps.length, 3);
  // Flatbread toasts on the grill; sauce needs no prep step.
  const breadSteps = buildSteps('flatbread', 'tofu', 'sauce');
  assert.deepEqual(breadSteps.map((s) => s.station), ['grill', 'chopping', 'grill']);
});

test('validation rejects bad recipes with a defined error, never a throw', () => {
  const good = RECIPES[0];
  assert.equal(validateRecipe(null).ok, false);
  assert.equal(validateRecipe(undefined).ok, false);
  assert.equal(validateRecipe('rice').ok, false);
  assert.equal(validateRecipe([]).ok, false);
  assert.equal(validateRecipe({ ...good, base: 'pasta' }).ok, false, 'unknown base');
  assert.equal(validateRecipe({ ...good, main: 'beef' }).ok, false, 'unknown main');
  assert.equal(validateRecipe({ ...good, topping: 'cheese' }).ok, false, 'unknown topping');
  assert.equal(validateRecipe({ ...good, steps: [] }).ok, false, 'empty step list');
  assert.equal(validateRecipe({ ...good, steps: [{ ingredient: 'rice', station: 'moon', action: 'boil' }] }).ok, false, 'non-existent station');
  assert.equal(validateRecipe({ ...good, steps: [{ ingredient: 'unicorn', station: 'pot', action: 'boil' }] }).ok, false, 'unknown ingredient');
  const duplicated = { ...good, steps: [...good.steps, good.steps[0]] };
  assert.equal(validateRecipe(duplicated).ok, false, 'duplicate (ingredient, station, action) step');
  assert.equal(validateRecipe({ ...good, id: '' }).ok, false, 'empty id');
  assert.equal(validateRecipe({ ...good, name: '' }).ok, false, 'empty name');
});
