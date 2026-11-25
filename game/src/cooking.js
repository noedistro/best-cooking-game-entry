// cooking.js — the chopping, grilling and boiling state machines. Every
// transition returns a result value ({ ok, ... }) or the job itself; nothing
// here ever throws, so a bad interaction can never kill the game loop.
import { CHOP_SECONDS, GRILL_READY_S, GRILL_BURN_S, POT_READY_S, POT_BURN_S } from './config.js';
import { INGREDIENTS } from './recipes.js';

const COOK_TIMINGS = {
  grill: { readyAt: GRILL_READY_S, burnAt: GRILL_BURN_S },
  pot: { readyAt: POT_READY_S, burnAt: POT_BURN_S },
};

// --- chopping ---------------------------------------------------------------

export function startChop(ingredient) {
  const info = typeof ingredient === 'string' ? INGREDIENTS[ingredient] : undefined;
  if (!info || !info.chop) return { ok: false, error: 'cannot-chop' };
  return { ok: true, job: { kind: 'chop', ingredient, progress: 0, done: false } };
}

export function tickChop(job, dt) {
  if (!job || typeof job !== 'object' || job.kind !== 'chop') return job;
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return job;
  if (job.done) return job;
  job.progress = Math.min(1, job.progress + dt / CHOP_SECONDS);
  job.done = job.progress >= 1;
  return job;
}

export function finishChop(job) {
  if (!job || typeof job !== 'object' || job.kind !== 'chop') return { ok: false, error: 'no-chop-job' };
  if (!job.done) return { ok: false, error: 'not-ready' };
  return { ok: true, item: job.ingredient, chopped: true };
}

// --- grilling / boiling -----------------------------------------------------

export function cookStateAt(elapsed, readyAt, burnAt) {
  if (typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0) return 'cooking';
  if (elapsed >= burnAt) return 'burnt';
  if (elapsed >= readyAt) return 'ready';
  return 'cooking';
}

export function startCook(ingredient, station) {
  const info = typeof ingredient === 'string' ? INGREDIENTS[ingredient] : undefined;
  if (!info || !info.cook) return { ok: false, error: 'cannot-cook' };
  if (info.cook.station !== station) return { ok: false, error: 'wrong-station' };
  const timing = COOK_TIMINGS[station];
  if (!timing) return { ok: false, error: 'wrong-station' };
  return {
    ok: true,
    job: {
      kind: 'cook',
      ingredient,
      station,
      action: info.cook.action,
      elapsed: 0,
      readyAt: timing.readyAt,
      burnAt: timing.burnAt,
      state: 'cooking',
    },
  };
}

export function tickCook(job, dt) {
  if (!job || typeof job !== 'object' || job.kind !== 'cook') return job;
  if (typeof dt !== 'number' || !Number.isFinite(dt) || dt <= 0) return job;
  job.elapsed += dt;
  job.state = cookStateAt(job.elapsed, job.readyAt, job.burnAt);
  return job;
}

export function takeCooked(job) {
  if (!job || typeof job !== 'object' || job.kind !== 'cook') return { ok: false, error: 'no-cook-job' };
  if (job.state === 'ready') return { ok: true, item: job.ingredient, cooked: true };
  if (job.state === 'burnt') return { ok: false, error: 'burnt' };
  return { ok: false, error: 'not-ready' };
}

// Burnt food can only go to the bin: a trip, not a chore.
export function binJob(job) {
  if (!job || typeof job !== 'object' || job.kind !== 'cook') return { ok: false, error: 'no-cook-job' };
  if (job.state !== 'burnt') return { ok: false, error: 'not-burnt' };
  return { ok: true, binned: true, item: job.ingredient };
}
