// input.test.js — keyboard + mouse input mapping: movement vectors, actions,
// mute/restart, unknown keys ignored, wrong types ignored, held-key repeat.
// Pure mapping functions only; the browser event wiring is covered by the
// headless smoke test. TDD first.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  directionForKey, actionForKey, normalizeKeyEvent, isRepeat,
} from '../game/src/input.js';

test('WASD and arrows move in the right direction', () => {
  assert.deepEqual(directionForKey('w'), { x: 0, y: -1 });
  assert.deepEqual(directionForKey('ArrowUp'), { x: 0, y: -1 });
  assert.deepEqual(directionForKey('a'), { x: -1, y: 0 });
  assert.deepEqual(directionForKey('ArrowLeft'), { x: -1, y: 0 });
  assert.deepEqual(directionForKey('s'), { x: 0, y: 1 });
  assert.deepEqual(directionForKey('ArrowDown'), { x: 0, y: 1 });
  assert.deepEqual(directionForKey('d'), { x: 1, y: 0 });
  assert.deepEqual(directionForKey('ArrowRight'), { x: 1, y: 0 });
  assert.deepEqual(directionForKey('W'), { x: 0, y: -1 }, 'uppercase WASD also moves');
  assert.deepEqual(directionForKey('A'), { x: -1, y: 0 });
});

test('E/Space interact, M mutes, R restarts, anything else is ignored', () => {
  assert.equal(actionForKey('e'), 'interact');
  assert.equal(actionForKey('E'), 'interact');
  assert.equal(actionForKey(' '), 'interact', 'Space interacts');
  assert.equal(actionForKey('m'), 'mute');
  assert.equal(actionForKey('M'), 'mute');
  assert.equal(actionForKey('r'), 'restart');
  assert.equal(actionForKey('R'), 'restart');
  assert.equal(actionForKey('q'), null, 'unknown key maps to no action');
  assert.equal(actionForKey('Enter'), null);
  assert.equal(actionForKey('Tab'), null);
  assert.equal(actionForKey(''), null);
  assert.equal(actionForKey(null), null, 'null key is ignored, never throws');
  assert.equal(actionForKey(42), null, 'wrong-type key is ignored, never throws');
  assert.equal(directionForKey('e'), null, 'an action key is not a direction');
  assert.equal(directionForKey(null), null);
  assert.equal(directionForKey(13), null);
});

test('normalizeKeyEvent extracts the key and ignores malformed events', () => {
  assert.deepEqual(normalizeKeyEvent({ key: 'w' }), { key: 'w' });
  assert.deepEqual(normalizeKeyEvent({ key: 'ArrowUp', repeat: false }), { key: 'ArrowUp' });
  assert.equal(normalizeKeyEvent(null), null, 'null event ignored');
  assert.equal(normalizeKeyEvent(undefined), null);
  assert.equal(normalizeKeyEvent({}), null, 'event without a key ignored');
  assert.equal(normalizeKeyEvent({ key: 42 }), null, 'non-string key ignored');
  assert.equal(normalizeKeyEvent({ key: '' }), null, 'empty key ignored');
  assert.equal(normalizeKeyEvent('w'), null, 'a bare string is not an event');
});

test('held-key repeat is detectable so interact never double-triggers', () => {
  assert.equal(isRepeat({ key: 'e', repeat: true }), true);
  assert.equal(isRepeat({ key: 'e', repeat: false }), false);
  assert.equal(isRepeat({ key: 'e' }), false, 'missing repeat flag means a fresh press');
  assert.equal(isRepeat(null), false, 'null event is not a repeat');
  assert.equal(isRepeat({}), false);
});
