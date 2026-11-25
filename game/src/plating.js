// plating.js — plate assembly in recipe order, serving, and the score.
// A plate takes base, then main, then topping; anything else is refused
// with the plate unchanged. Serving scores coins x the streak combo.
import { tipFor } from './orders.js';

// The combo from a streak of on-time serves: x1, then x2, capped at x3.
export function comboMultiplier(streak) {
  if (typeof streak !== 'number' || !Number.isFinite(streak) || streak <= 0) return 1;
  return Math.min(3, Math.max(1, Math.floor(streak)));
}

export function createPlate(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  if (!recipe.base || !recipe.main || !recipe.topping) return null;
  return {
    recipeId: recipe.id ?? null,
    recipeName: recipe.name ?? '',
    expected: [recipe.base, recipe.main, recipe.topping],
    layers: [],
  };
}

export function addLayer(plate, ingredient) {
  if (!plate || typeof plate !== 'object' || !Array.isArray(plate.layers) || !Array.isArray(plate.expected)) {
    return { ok: false, error: 'bad-input' };
  }
  if (typeof ingredient !== 'string' || ingredient === '') return { ok: false, error: 'bad-input' };
  if (plate.layers.length >= plate.expected.length) return { ok: false, error: 'plate-full' };
  if (ingredient !== plate.expected[plate.layers.length]) return { ok: false, error: 'wrong-order' };
  plate.layers.push(ingredient);
  return { ok: true, layers: plate.layers.length };
}

export function plateReady(plate) {
  if (!plate || !Array.isArray(plate.layers) || !Array.isArray(plate.expected)) return false;
  return plate.layers.length === plate.expected.length;
}

export function resetPlate(plate) {
  if (plate && Array.isArray(plate.layers)) plate.layers = [];
  return plate;
}

// Serve a finished plate against a ticket. `streak` is the streak before
// this serve; the new streak and the combo apply to this serve.
export function scoreServe(plate, ticket, streak) {
  if (!plateReady(plate)) return { ok: false, error: 'incomplete' };
  if (!ticket || typeof ticket !== 'object') return { ok: false, error: 'bad-ticket' };
  const coins = tipFor(ticket);
  const safeStreak = typeof streak === 'number' && Number.isFinite(streak) ? Math.max(0, Math.floor(streak)) : 0;
  const newStreak = safeStreak + 1;
  const multiplier = comboMultiplier(newStreak);
  return { ok: true, coins, score: coins * multiplier, newStreak, multiplier };
}
