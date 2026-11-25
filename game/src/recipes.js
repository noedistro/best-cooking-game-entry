// recipes.js — the dish catalogue: 12 recipes from an exact 3 bases x 4 mains
// matrix, one topping each, every topping in exactly 4 dishes. Dish names are
// invented for Teluk Arang; nothing is borrowed from another cooking game.
import { STATIONS } from './kitchen.js';

export const BASES = ['rice', 'noodles', 'flatbread'];
export const MAINS = ['chicken', 'fish', 'tofu', 'mushroom'];
export const TOPPINGS = ['greens', 'chilli', 'sauce'];

const BASE_LABELS = { rice: 'Rice', noodles: 'Noodles', flatbread: 'Flatbread' };
const MAIN_LABELS = { chicken: 'Chicken', fish: 'Fish', tofu: 'Tofu', mushroom: 'Mushroom' };
const NAME_PREFIXES = ['Arang', 'Ember', 'Bay', 'Teluk'];

// Every ingredient the pantry stocks, with how it is prepared. A null cook
// step means the ingredient goes straight from the pantry to the plate.
export const INGREDIENTS = {
  rice: { name: 'Steamed Rice', kind: 'base', chop: false, cook: { station: 'pot', action: 'boil' } },
  noodles: { name: 'Wok Noodles', kind: 'base', chop: false, cook: { station: 'pot', action: 'boil' } },
  flatbread: { name: 'Grilled Flatbread', kind: 'base', chop: false, cook: { station: 'grill', action: 'toast' } },
  chicken: { name: 'Chicken', kind: 'main', chop: true, cook: { station: 'grill', action: 'grill' } },
  fish: { name: 'Fish', kind: 'main', chop: true, cook: { station: 'pot', action: 'steam' } },
  tofu: { name: 'Tofu', kind: 'main', chop: true, cook: { station: 'grill', action: 'grill' } },
  mushroom: { name: 'Mushroom', kind: 'main', chop: true, cook: { station: 'grill', action: 'grill' } },
  greens: { name: 'Greens', kind: 'topping', chop: true, cook: null },
  chilli: { name: 'Chilli', kind: 'topping', chop: false, cook: null },
  sauce: { name: 'Sauce', kind: 'topping', chop: false, cook: null },
};

// The station route for one dish: cook the base, chop the main, cook the
// main, chop the topping when it needs it. Plate assembly is always
// base, then main, then topping.
export function buildSteps(base, main, topping) {
  const steps = [];
  const baseInfo = INGREDIENTS[base];
  if (baseInfo?.cook) steps.push({ ingredient: base, station: baseInfo.cook.station, action: baseInfo.cook.action });
  const mainInfo = INGREDIENTS[main];
  if (mainInfo?.chop) steps.push({ ingredient: main, station: 'chopping', action: 'chop' });
  if (mainInfo?.cook) steps.push({ ingredient: main, station: mainInfo.cook.station, action: mainInfo.cook.action });
  const toppingInfo = INGREDIENTS[topping];
  if (toppingInfo?.chop) steps.push({ ingredient: topping, station: 'chopping', action: 'chop' });
  return steps;
}

function buildRecipes() {
  const recipes = [];
  BASES.forEach((base, bi) => {
    MAINS.forEach((main, mi) => {
      const topping = TOPPINGS[(bi + mi) % TOPPINGS.length];
      const prefix = NAME_PREFIXES[(bi + mi) % NAME_PREFIXES.length];
      const name = `${prefix} ${MAIN_LABELS[main]} ${BASE_LABELS[base]}`;
      recipes.push({
        id: `${prefix.toLowerCase()}-${main}-${base}`,
        name,
        base,
        main,
        topping,
        steps: buildSteps(base, main, topping),
      });
    });
  });
  return recipes;
}

export const RECIPES = buildRecipes();

export function recipeById(id) {
  if (typeof id !== 'string' || id === '') return null;
  return RECIPES.find((r) => r.id === id) ?? null;
}

// The one recipe for a base + main pair (every pair has exactly one).
export function recipeFor(base, main) {
  if (typeof base !== 'string' || typeof main !== 'string') return null;
  return RECIPES.find((r) => r.base === base && r.main === main) ?? null;
}

// Validate one recipe object. Returns { ok: true } or { ok: false, error }.
export function validateRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    return { ok: false, error: 'not-an-object' };
  }
  if (typeof recipe.id !== 'string' || recipe.id === '') return { ok: false, error: 'bad-id' };
  if (typeof recipe.name !== 'string' || recipe.name === '') return { ok: false, error: 'bad-name' };
  if (!BASES.includes(recipe.base)) return { ok: false, error: 'unknown-base' };
  if (!MAINS.includes(recipe.main)) return { ok: false, error: 'unknown-main' };
  if (!TOPPINGS.includes(recipe.topping)) return { ok: false, error: 'unknown-topping' };
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    return { ok: false, error: 'empty-steps' };
  }
  const stationIds = new Set(STATIONS.map((s) => s.id));
  const seen = new Set();
  let coversBase = false;
  let coversMain = false;
  for (const step of recipe.steps) {
    if (!step || typeof step !== 'object') return { ok: false, error: 'bad-step' };
    if (!INGREDIENTS[step.ingredient]) return { ok: false, error: 'unknown-ingredient' };
    if (!stationIds.has(step.station)) return { ok: false, error: 'unknown-station' };
    if (typeof step.action !== 'string' || step.action === '') return { ok: false, error: 'bad-action' };
    const key = `${step.ingredient}|${step.station}|${step.action}`;
    if (seen.has(key)) return { ok: false, error: 'duplicate-step' };
    seen.add(key);
    if (step.ingredient === recipe.base) coversBase = true;
    if (step.ingredient === recipe.main) coversMain = true;
  }
  if (!coversBase) return { ok: false, error: 'steps-miss-base' };
  if (!coversMain) return { ok: false, error: 'steps-miss-main' };
  return { ok: true };
}
