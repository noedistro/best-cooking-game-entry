// shots.js — the deterministic staged-screenshot mode (?shot=<name>&seed=<n>).
// A staged scene is a plain state object: the game renders it immediately,
// with the shift timer frozen and no randomness leaking in. Bad parameters
// fall back to normal play, never a blank screen.
import { createRng } from './random.js';
import { RECIPES, recipeById } from './recipes.js';
import { createTicket } from './orders.js';

export const SHOT_NAMES = ['cover', 'play', 'rush', 'serve'];

export function parseShotParams(search) {
  if (typeof search !== 'string' || search === '') return { shot: null, seed: 1 };
  let params;
  try {
    params = new URLSearchParams(search);
  } catch {
    return { shot: null, seed: 1 };
  }
  const rawShot = params.get('shot');
  const shot = SHOT_NAMES.includes(rawShot) ? rawShot : null;
  const rawSeed = Number.parseInt(params.get('seed') ?? '', 10);
  const seed = Number.isFinite(rawSeed) ? Math.abs(Math.floor(rawSeed)) || 1 : 1;
  return { shot, seed };
}

function stagedTicket(rng, id, rush) {
  const recipe = RECIPES[Math.floor(rng() * RECIPES.length)];
  return createTicket(id, recipe, rng, rush);
}

// Build the staged scene for a shot name, or null for an unknown shot.
// Every value comes from the seed: the same shot + seed stages the same scene.
export function buildStagedScene(shot, seed) {
  if (!SHOT_NAMES.includes(shot)) return null;
  const rng = createRng(seed);
  if (shot === 'cover') {
    // The money shot: everything criterion 1 asks for in one frame.
    const tickets = [
      stagedTicket(rng, 'order-1', false),
      stagedTicket(rng, 'order-2', false),
      stagedTicket(rng, 'order-3', false),
    ];
    tickets[2].patience = 8;
    tickets[2].maxPatience = 96;
    const recipe = recipeById('arang-chicken-rice');
    return {
      shot, seed, remaining: 151, score: 120, coins: 120, streak: 1, rush: false,
      tickets,
      counterIngredients: ['rice', 'noodles', 'chicken', 'greens'],
      plating: { recipeId: recipe.id, recipeName: recipe.name, layers: ['rice', 'chicken'] },
      windowDish: recipe.id,
      chef: { x: 700, y: 300, held: null },
      grillItem: 'chicken', grillState: 'ready',
      potItem: 'rice', potState: 'cooking',
      choppingItem: 'greens', chopProgress: 0.6,
      tipPopup: null,
    };
  }
  if (shot === 'play') {
    const tickets = [stagedTicket(rng, 'order-1', false), stagedTicket(rng, 'order-2', false)];
    const recipe = recipeById('arang-chicken-rice');
    return {
      shot, seed, remaining: 100, score: 85, coins: 85, streak: 1, rush: false,
      tickets,
      counterIngredients: ['rice', 'chicken'],
      plating: { recipeId: recipe.id, recipeName: recipe.name, layers: ['rice'] },
      windowDish: null,
      chef: { x: 520, y: 430, held: 'chicken' },
      grillItem: null, grillState: null,
      potItem: 'noodles', potState: 'cooking',
      choppingItem: null, chopProgress: 0,
      tipPopup: null,
    };
  }
  if (shot === 'rush') {
    const tickets = [
      stagedTicket(rng, 'order-1', true),
      stagedTicket(rng, 'order-2', true),
      stagedTicket(rng, 'order-3', true),
      stagedTicket(rng, 'order-4', true),
    ];
    tickets[0].patience = 6;
    tickets[0].maxPatience = 80;
    tickets[1].patience = 8;
    tickets[1].maxPatience = 78;
    const recipe = recipeById('arang-chicken-rice');
    return {
      shot, seed, remaining: 70, score: 240, coins: 240, streak: 2, rush: true,
      tickets,
      counterIngredients: ['rice', 'fish', 'greens'],
      plating: { recipeId: recipe.id, recipeName: recipe.name, layers: ['rice', 'chicken'] },
      windowDish: null,
      chef: { x: 480, y: 520, held: null },
      grillItem: 'chicken', grillState: 'cooking',
      potItem: 'fish', potState: 'ready',
      choppingItem: 'tofu', chopProgress: 0.4,
      tipPopup: null,
    };
  }
  // serve
  const recipe = recipeById('arang-chicken-rice');
  return {
    shot, seed, remaining: 45, score: 320, coins: 320, streak: 3, rush: false,
    tickets: [stagedTicket(rng, 'order-1', false)],
    counterIngredients: ['sauce'],
    plating: { recipeId: recipe.id, recipeName: recipe.name, layers: [] },
    windowDish: recipe.id,
    chef: { x: 990, y: 580, held: null },
    grillItem: null, grillState: null,
    potItem: null, potState: null,
    choppingItem: null, chopProgress: 0,
    tipPopup: '+45',
  };
}
