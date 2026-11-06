const test = require('node:test');
const assert = require('node:assert/strict');
const { isMigrationRunning, MAX_FLAG_AGE_MS } = require('./00-migration-flag.js');

const NOW = Date.parse('2026-10-27T10:00:00Z');
const at = (minutesAgo) => new Date(NOW - minutesAgo * 60 * 1000).toISOString();

test('flag on and recent: events are ignored', () => {
  assert.equal(isMigrationRunning({ activa: true, desde: at(1) }, NOW), true);
  assert.equal(isMigrationRunning({ activa: true, desde: at(29) }, NOW), true);
});

test('flag off: events are routed', () => {
  assert.equal(isMigrationRunning({ activa: false, desde: at(1) }, NOW), false);
});

test('flag left on by a crash for 30 minutes or more is treated as off', () => {
  assert.equal(MAX_FLAG_AGE_MS, 30 * 60 * 1000);
  assert.equal(isMigrationRunning({ activa: true, desde: at(30) }, NOW), false);
  assert.equal(isMigrationRunning({ activa: true, desde: at(600) }, NOW), false);
});

test('unreadable flag never silences the shop: no row, empty item, error item, bad date, text instead of boolean', () => {
  assert.equal(isMigrationRunning(undefined, NOW), false);
  assert.equal(isMigrationRunning({}, NOW), false);
  assert.equal(isMigrationRunning({ error: { message: 'table not found' } }, NOW), false);
  assert.equal(isMigrationRunning({ activa: true, desde: '' }, NOW), false);
  assert.equal(isMigrationRunning({ activa: true, desde: 'ayer' }, NOW), false);
  assert.equal(isMigrationRunning({ activa: 'true', desde: at(1) }, NOW), false);
});

test('a start time far in the future (clock mistake) does not count', () => {
  assert.equal(isMigrationRunning({ activa: true, desde: at(-120) }, NOW), false);
});
