// main.js — Nadia's Ember Kitchen: bootstrap, game loop, state and the
// interactions that tie the modules together. The kitchen is a loop the chef
// walks: pantry -> chopping board -> grill / pot -> plating counter ->
// serving window, one held item at a time, against a 180-second shift.
import { CANVAS_W, CANVAS_H } from './config.js';
import { createRng } from './random.js';
import { RECIPES, recipeById, recipeFor, INGREDIENTS } from './recipes.js';
import {
  tickTicket, tipFor, rushPhaseAtRemaining,
  maxLiveTickets, spawnTicket, shiftRemaining,
} from './orders.js';
import { startChop, tickChop, finishChop, startCook, tickCook, takeCooked } from './cooking.js';
import { createPlate, addLayer, plateReady, scoreServe } from './plating.js';
import { createChef, moveChef, nearestStation, stationAt, isBinSlot, stationById } from './kitchen.js';
import { directionForKey, actionForKey, normalizeKeyEvent, isRepeat } from './input.js';
import { parseShotParams, buildStagedScene } from './shots.js';
import { drawGame } from './render.js';
import { sounds, setMuted, ensureAudio } from './audio.js';

// Pantry crate geometry, kept in step with render.js drawPantry:
// 10 crates in rows of 3, each a 48x48 box starting at (+34, +40) in the station.
const PANTRY_CRATES = ['rice', 'noodles', 'flatbread', 'chicken', 'fish', 'tofu', 'mushroom', 'greens', 'chilli', 'sauce'];

function pantryIngredientAt(station, x, y) {
  for (let i = 0; i < PANTRY_CRATES.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const cx = station.x + 34 + col * 56;
    const cy = station.y + 40 + row * 58;
    if (x >= cx - 24 && x <= cx + 24 && y >= cy - 24 && y <= cy + 24) return PANTRY_CRATES[i];
  }
  return null;
}

export function createState(seed) {
  return {
    mode: 'title',
    seed,
    elapsed: 0,
    t: 0,
    score: 0,
    coins: 0,
    streak: 0,
    bestStreak: 0,
    served: 0,
    expired: 0,
    tickets: [],
    nextTicketId: 1,
    spawnTimer: 0,
    rng: createRng(seed),
    chef: createChef(),
    chopJob: null,
    grillJob: null,
    potJob: null,
    plate: null,
    plateParts: null,
    rushPhase: 0,
    muted: false,
    keys: new Set(),
    moveTarget: null,
    particles: [],
    popups: [],
    results: null,
    windowDish: null,
    windowDishTimer: 0,
    tipPopup: null,
    tipPopupTimer: 0,
    staged: null,
  };
}

function gradeFor(served) {
  if (served >= 12) return 'S';
  if (served >= 9) return 'A';
  if (served >= 6) return 'B';
  if (served >= 3) return 'C';
  return 'D';
}

function addPopup(state, label, x, y) {
  state.popups.push({ label, x, y, life: 1 });
}

function addPuff(state, x, y, color = '#f7ead2') {
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 60,
      vy: -20 - Math.random() * 30,
      life: 1,
      size: 3 + Math.random() * 3,
      color,
    });
  }
}

function startShift(state) {
  state.mode = 'playing';
  state.elapsed = 0;
  state.score = 0;
  state.coins = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.served = 0;
  state.expired = 0;
  state.tickets = [];
  state.nextTicketId = 1;
  state.spawnTimer = 5;
  state.chef = createChef();
  state.chopJob = null;
  state.grillJob = null;
  state.potJob = null;
  state.plate = null;
  state.plateParts = null;
  state.rushPhase = 0;
  state.particles = [];
  state.popups = [];
  state.results = null;
  state.windowDish = null;
  state.tipPopup = null;
  // Two tickets on the board from the first second: the shift starts busy.
  for (let i = 0; i < 2; i++) {
    const ticket = spawnTicket(state.tickets, RECIPES, state.rng, 0, state.nextTicketId);
    if (ticket) {
      state.tickets.push(ticket);
      state.nextTicketId += 1;
    }
  }
}

function endShift(state) {
  state.mode = 'results';
  state.results = {
    served: state.served,
    coins: state.coins,
    score: state.score,
    bestStreak: state.bestStreak,
    grade: gradeFor(state.served),
  };
}

// The next ingredient the most urgent ticket still needs, counting what is
// already held, cooking, chopping or on the plate as sourced.
function nextNeededIngredient(state) {
  const active = state.tickets
    .filter((t) => t.state === 'active')
    .sort((a, b) => a.patience - b.patience);
  if (active.length === 0) return 'rice';
  const sourced = new Set();
  const held = state.chef.held;
  if (held?.kind === 'ingredient') sourced.add(held.ingredient);
  if (state.chopJob) sourced.add(state.chopJob.ingredient);
  if (state.grillJob) sourced.add(state.grillJob.ingredient);
  if (state.potJob) sourced.add(state.potJob.ingredient);
  if (state.plate) state.plate.layers.forEach((i) => sourced.add(i));
  if (state.plateParts?.base) sourced.add(state.plateParts.base);
  for (const ticket of active) {
    for (const ingredient of [ticket.base, ticket.main, ticket.topping]) {
      if (!sourced.has(ingredient)) return ingredient;
    }
  }
  return active[0].base;
}

function pickUp(state, ingredient) {
  if (state.chef.held) return false;
  if (!INGREDIENTS[ingredient]) return false;
  state.chef.held = { kind: 'ingredient', ingredient, state: 'raw' };
  sounds.pickup();
  addPuff(state, state.chef.x, state.chef.y - 40);
  return true;
}

function cookableAt(held, stationId) {
  if (!held || held.kind !== 'ingredient') return false;
  const info = INGREDIENTS[held.ingredient];
  if (!info?.cook || info.cook.station !== stationId) return false;
  // Mains must be chopped before they cook; bases go in raw.
  if (info.kind === 'main') return held.state === 'chopped';
  if (info.kind === 'base') return held.state === 'raw';
  return false;
}

function interactCook(state, stationId) {
  const key = stationId === 'grill' ? 'grillJob' : 'potJob';
  const job = state[key];
  if (job) {
    if (state.chef.held) {
      sounds.error();
      return;
    }
    const taken = takeCooked(job);
    if (taken.ok) {
      state.chef.held = { kind: 'ingredient', ingredient: taken.item, state: 'cooked' };
      state[key] = null;
      sounds.pickup();
    } else if (taken.error === 'burnt') {
      state.chef.held = { kind: 'ingredient', ingredient: job.ingredient, state: 'burnt' };
      state[key] = null;
      sounds.error();
      addPopup(state, 'burnt! bin it', state.chef.x, state.chef.y - 60);
    }
    return;
  }
  const held = state.chef.held;
  if (!cookableAt(held, stationId)) {
    if (held) sounds.error();
    return;
  }
  const started = startCook(held.ingredient, stationId);
  if (!started.ok) {
    sounds.error();
    return;
  }
  state[key] = started.job;
  state.chef.held = null;
  sounds.sizzle();
}

function interactPlating(state, point) {
  const chef = state.chef;
  // Burnt food goes to the bin slot at the counter's right end.
  if (chef.held?.kind === 'ingredient' && chef.held.state === 'burnt') {
    const atBin = (point && isBinSlot(point.x, point.y)) || isBinSlot(chef.x, chef.y);
    if (atBin) {
      chef.held = null;
      sounds.place();
      addPuff(state, 726, 570, '#9aa0a8');
      return;
    }
    sounds.error();
    return;
  }
  // Take a finished plate off the counter.
  if (!chef.held && state.plate && plateReady(state.plate)) {
    chef.held = { kind: 'plate', plate: state.plate };
    state.plate = null;
    sounds.pickup();
    return;
  }
  if (!chef.held || chef.held.kind !== 'ingredient') return;
  const held = chef.held;
  if (held.state === 'burnt') {
    sounds.error();
    return;
  }
  const info = INGREDIENTS[held.ingredient];
  if (!info) return;
  // A layer must be cooked (base/main), chopped (greens) or raw (chilli/sauce).
  const readyToPlate = held.state === 'cooked' || (info.kind === 'topping' && ((info.chop && held.state === 'chopped') || (!info.chop && held.state === 'raw')));
  if (!readyToPlate) {
    sounds.error();
    addPopup(state, 'cook it first', chef.x, chef.y - 60);
    return;
  }
  // First layer: a base starts the plate. Second layer: a main fixes the dish.
  if (!state.plate && !state.plateParts) {
    if (info.kind !== 'base') {
      sounds.error();
      addPopup(state, 'start with a base', chef.x, chef.y - 60);
      return;
    }
    state.plateParts = { base: held.ingredient };
    chef.held = null;
    sounds.place();
    return;
  }
  if (state.plateParts && !state.plate) {
    if (info.kind !== 'main') {
      sounds.error();
      return;
    }
    const recipe = recipeFor(state.plateParts.base, held.ingredient);
    if (!recipe) {
      sounds.error();
      return;
    }
    const plate = createPlate(recipe);
    addLayer(plate, state.plateParts.base);
    addLayer(plate, held.ingredient);
    state.plate = plate;
    state.plateParts = null;
    chef.held = null;
    sounds.place();
    return;
  }
  // Third layer: the topping the dish's recipe calls for.
  const added = addLayer(state.plate, held.ingredient);
  if (!added.ok) {
    sounds.error();
    addPopup(state, 'wrong order', chef.x, chef.y - 60);
    return;
  }
  chef.held = null;
  sounds.place();
  addPuff(state, chef.x, chef.y - 40, '#f2b234');
}

function interactWindow(state) {
  const held = state.chef.held;
  if (!held || held.kind !== 'plate' || !plateReady(held.plate)) return;
  const ticket = state.tickets
    .filter((t) => t.state === 'active' && t.recipeId === held.plate.recipeId)
    .sort((a, b) => a.patience - b.patience)[0];
  if (!ticket) {
    sounds.error();
    addPopup(state, 'no order for this dish', state.chef.x, state.chef.y - 60);
    return;
  }
  const result = scoreServe(held.plate, ticket, state.streak);
  if (!result.ok) {
    sounds.error();
    return;
  }
  state.score += result.score;
  state.coins += result.coins;
  state.streak = result.newStreak;
  state.bestStreak = Math.max(state.bestStreak, state.streak);
  state.served += 1;
  state.tickets = state.tickets.filter((t) => t !== ticket);
  state.windowDish = { layers: [...held.plate.layers] };
  state.windowDishTimer = 2;
  state.tipPopup = `+${result.coins}`;
  state.tipPopupTimer = 1.6;
  state.chef.held = null;
  sounds.bell();
  addPopup(state, `+${result.coins}`, 1150, 500);
  addPuff(state, 1150, 590, '#f2b234');
}

export function interactAtStation(state, stationId, point) {
  if (!state || state.mode !== 'playing' || state.staged) return;
  if (typeof stationId !== 'string') return;
  switch (stationId) {
    case 'pantry': {
      if (state.chef.held) {
        sounds.error();
        return;
      }
      const station = stationById('pantry');
      const picked = point && station ? pantryIngredientAt(station, point.x, point.y) : null;
      pickUp(state, picked ?? nextNeededIngredient(state));
      return;
    }
    case 'chopping': {
      if (state.chopJob) {
        if (state.chopJob.done) {
          if (state.chef.held) {
            sounds.error();
            return;
          }
          const finished = finishChop(state.chopJob);
          if (finished.ok) {
            state.chef.held = { kind: 'ingredient', ingredient: finished.item, state: 'chopped' };
            state.chopJob = null;
            sounds.pickup();
          }
        }
        return;
      }
      const held = state.chef.held;
      if (!held || held.kind !== 'ingredient' || held.state !== 'raw') {
        if (held) sounds.error();
        return;
      }
      const started = startChop(held.ingredient);
      if (!started.ok) {
        sounds.error();
        return;
      }
      state.chopJob = started.job;
      state.chef.held = null;
      sounds.chop();
      return;
    }
    case 'grill':
    case 'pot':
      interactCook(state, stationId);
      return;
    case 'plating':
      interactPlating(state, point);
      return;
    case 'window':
      interactWindow(state);
      return;
    default:
      return;
  }
}

function spawnBurst(state) {
  const cap = maxLiveTickets(state.rushPhase);
  while (state.tickets.length < cap) {
    const ticket = spawnTicket(state.tickets, RECIPES, state.rng, state.rushPhase, state.nextTicketId);
    if (!ticket) break;
    state.tickets.push(ticket);
    state.nextTicketId += 1;
  }
}

export function update(state, dt) {
  if (state.mode !== 'playing' || state.staged) return;
  state.t += dt;
  state.elapsed += dt;
  const remaining = shiftRemaining(state.elapsed);
  if (remaining <= 0) {
    endShift(state);
    return;
  }
  // Movement from held keys, or toward a click target.
  let dir = { x: 0, y: 0 };
  for (const key of state.keys) {
    const d = directionForKey(key);
    if (d) {
      dir.x += d.x;
      dir.y += d.y;
    }
  }
  if (dir.x !== 0 || dir.y !== 0) {
    moveChef(state.chef, dir, dt);
    state.moveTarget = null;
  } else if (state.moveTarget) {
    const target = state.moveTarget;
    const dx = target.x - state.chef.x;
    const dy = target.y - state.chef.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 14) {
      state.moveTarget = null;
      if (target.stationId) interactAtStation(state, target.stationId, target.point);
    } else {
      moveChef(state.chef, { x: dx / dist, y: dy / dist }, dt);
    }
  }
  // Rush phases fire at fixed moments; a new rush spawns a burst.
  const phase = rushPhaseAtRemaining(remaining);
  if (phase > state.rushPhase) {
    state.rushPhase = phase;
    sounds.rush();
    addPopup(state, `RUSH ${phase}`, CANVAS_W / 2, 220);
    spawnBurst(state);
  }
  // Steady ticket flow between rushes.
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = state.rushPhase > 0 ? 3.5 : 5;
    const ticket = spawnTicket(state.tickets, RECIPES, state.rng, state.rushPhase, state.nextTicketId);
    if (ticket) {
      state.tickets.push(ticket);
      state.nextTicketId += 1;
    }
  }
  // Patience decay and expiry.
  for (const ticket of [...state.tickets]) {
    if (tickTicket(ticket, dt) === 'expired') {
      state.tickets = state.tickets.filter((t) => t !== ticket);
      state.score = Math.max(0, state.score - 5);
      state.streak = 0;
      state.expired += 1;
      sounds.expire();
      addPopup(state, 'order lost', CANVAS_W / 2, 220);
    }
  }
  // Chopping and cooking progress.
  if (state.chopJob) {
    tickChop(state.chopJob, dt);
    if (state.chopJob.done && !state.chopJob.announced) {
      state.chopJob.announced = true;
      sounds.ready();
    }
  }
  if (state.grillJob) {
    const before = state.grillJob.state;
    tickCook(state.grillJob, dt);
    if (state.grillJob.state === 'ready' && before !== 'ready') sounds.ready();
  }
  if (state.potJob) {
    const before = state.potJob.state;
    tickCook(state.potJob, dt);
    if (state.potJob.state === 'ready' && before !== 'ready') sounds.ready();
  }
  // Particles, popups and the served-dish display decay.
  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt * 1.6;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const p of state.popups) {
    p.y -= 30 * dt;
    p.life -= dt * 0.9;
  }
  state.popups = state.popups.filter((p) => p.life > 0);
  if (state.windowDishTimer > 0) {
    state.windowDishTimer -= dt;
    if (state.windowDishTimer <= 0) state.windowDish = null;
  }
  if (state.tipPopupTimer > 0) {
    state.tipPopupTimer -= dt;
    if (state.tipPopupTimer <= 0) state.tipPopup = null;
  }
}

// The view the renderer draws: live state, or a frozen staged scene.
export function buildView(state) {
  if (state.staged) {
    const scene = state.staged;
    const recipe = scene.windowDish ? recipeById(scene.windowDish) : null;
    return {
      mode: 'playing',
      t: 0,
      remaining: scene.remaining,
      score: scene.score,
      coins: scene.coins,
      streak: scene.streak,
      served: scene.tickets.length,
      rush: scene.rush,
      tickets: scene.tickets.map((t) => ({ ...t, tip: tipFor(t) })),
      chef: {
        x: scene.chef.x,
        y: scene.chef.y,
        facing: 1,
        held: scene.chef.held
          ? { kind: 'ingredient', ingredient: scene.chef.held, state: 'chopped' }
          : null,
      },
      chop: scene.choppingItem
        ? { ingredient: scene.choppingItem, progress: scene.chopProgress, done: scene.chopProgress >= 1 }
        : null,
      grill: scene.grillItem
        ? { ingredient: scene.grillItem, state: scene.grillState, elapsed: 3, readyAt: 6, burnAt: 11 }
        : null,
      pot: scene.potItem
        ? { ingredient: scene.potItem, state: scene.potState, elapsed: 2.5, readyAt: 5, burnAt: 10 }
        : null,
      plate: scene.plating.layers.length > 0
        ? { recipeId: scene.plating.recipeId, layers: [...scene.plating.layers] }
        : null,
      counterIngredients: scene.counterIngredients,
      windowDish: recipe ? { layers: [recipe.base, recipe.main, recipe.topping] } : null,
      tipPopup: scene.tipPopup,
      particles: [],
      popups: [],
      results: null,
    };
  }
  const plateLayers = state.plate
    ? [...state.plate.layers]
    : state.plateParts
      ? [state.plateParts.base]
      : [];
  return {
    mode: state.mode,
    t: state.t,
    remaining: shiftRemaining(state.elapsed),
    score: state.score,
    coins: state.coins,
    streak: state.streak,
    served: state.served,
    rush: state.rushPhase > 0,
    tickets: state.tickets.map((t) => ({ ...t, tip: tipFor(t) })),
    chef: state.chef,
    chop: state.chopJob,
    grill: state.grillJob,
    pot: state.potJob,
    plate: plateLayers.length > 0 ? { layers: plateLayers } : null,
    counterIngredients: [],
    windowDish: state.windowDish,
    tipPopup: state.tipPopup,
    particles: state.particles,
    popups: state.popups,
    results: state.results,
  };
}

function startFromQuery() {
  const params = parseShotParams(window.location.search);
  const scene = params.shot ? buildStagedScene(params.shot, params.seed) : null;
  const seed = (Date.now() % 2147483647) || 1;
  const state = createState(seed);
  if (scene) {
    state.staged = scene;
    state.mode = 'playing';
  }
  return state;
}

function boot() {
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const state = startFromQuery();
  // A hook for play-testing: the state and the current view, read-only-ish.
  window.__nadia = { state, view: () => buildView(state) };

  window.addEventListener('keydown', (event) => {
    const normalized = normalizeKeyEvent(event);
    if (!normalized) return;
    const key = normalized.key;
    ensureAudio();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) event.preventDefault();
    if (state.mode === 'title' && (key === 'Enter' || key === ' ')) {
      startShift(state);
      return;
    }
    if (state.mode === 'results' && actionForKey(key) === 'restart') {
      state.rng = createRng((Date.now() % 2147483647) || 1);
      startShift(state);
      return;
    }
    if (state.mode !== 'playing' || state.staged) return;
    const action = actionForKey(key);
    if (action === 'mute') {
      state.muted = !state.muted;
      setMuted(state.muted);
      return;
    }
    if (action === 'interact' && !isRepeat(event)) {
      const station = nearestStation(state.chef);
      // Keyboard interact carries no click point: the pantry smart-picks the
      // next needed ingredient instead of the crate under the chef's feet.
      if (station) interactAtStation(state, station.id, null);
      return;
    }
    if (directionForKey(key)) state.keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    const normalized = normalizeKeyEvent(event);
    if (normalized) state.keys.delete(normalized.key);
  });
  canvas.addEventListener('click', (event) => {
    ensureAudio();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((event.clientY - rect.top) / rect.height) * CANVAS_H;
    if (state.mode === 'title') {
      startShift(state);
      return;
    }
    if (state.mode !== 'playing' || state.staged) return;
    const station = stationAt(x, y);
    if (station) {
      const near = nearestStation(state.chef);
      if (near && near.id === station.id) {
        interactAtStation(state, station.id, { x, y });
        return;
      }
      state.moveTarget = {
        x: Math.max(station.x + 10, Math.min(station.x + station.w - 10, x)),
        y: Math.max(station.y + 10, Math.min(station.y + station.h - 10, y)),
        stationId: station.id,
        point: { x, y },
      };
      return;
    }
    state.moveTarget = { x, y };
  });

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    try {
      update(state, dt);
    } catch {
      // One bad frame never kills the game.
    }
    try {
      drawGame(ctx, buildView(state));
    } catch {
      // A failed render never kills the loop either.
    }
  }
  requestAnimationFrame(frame);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
