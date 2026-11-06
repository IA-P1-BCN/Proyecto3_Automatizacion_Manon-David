const test = require('node:test');
const assert = require('node:assert/strict');
const { checkWebhookToken, sameSecret } = require('./00-check-token.js');

const SECRET = 'fake-secret-for-tests';
const ok = { authorized: true, misconfigured: false };
const rejected = { authorized: false, misconfigured: false };

test('valid token in the header is accepted', () => {
  assert.deepEqual(checkWebhookToken({ configured: SECRET, header: SECRET }), ok);
});

test('valid token in the query is accepted (the app can only send a URL)', () => {
  assert.deepEqual(checkWebhookToken({ configured: SECRET, query: SECRET }), ok);
});

test('wrong, missing, empty or partial tokens are rejected', () => {
  assert.deepEqual(checkWebhookToken({ configured: SECRET, header: 'other' }), rejected);
  assert.deepEqual(checkWebhookToken({ configured: SECRET }), rejected);
  assert.deepEqual(checkWebhookToken({ configured: SECRET, header: '', query: '' }), rejected);
  assert.deepEqual(checkWebhookToken({ configured: SECRET, query: SECRET.slice(0, -1) }), rejected);
  assert.deepEqual(checkWebhookToken({ configured: SECRET, query: `${SECRET}x` }), rejected);
});

test('a wrong header does not block a valid query token and vice versa', () => {
  assert.equal(checkWebhookToken({ configured: SECRET, header: 'bad', query: SECRET }).authorized, true);
  assert.equal(checkWebhookToken({ configured: SECRET, header: SECRET, query: 'bad' }).authorized, true);
});

test('empty or missing configured token rejects everything, even an empty token (fail closed)', () => {
  const closed = { authorized: false, misconfigured: true };
  assert.deepEqual(checkWebhookToken({ configured: '', header: '', query: '' }), closed);
  assert.deepEqual(checkWebhookToken({ configured: undefined, header: 'x' }), closed);
  assert.deepEqual(checkWebhookToken({ configured: '   ', query: '   ' }), closed);
});

test('tokens with special characters and non-string input', () => {
  const special = 'a+b/c=d&e%20é';
  assert.equal(checkWebhookToken({ configured: special, query: special }).authorized, true);
  assert.equal(checkWebhookToken({ configured: SECRET, header: ['x', SECRET] }).authorized, false);
  assert.equal(checkWebhookToken({ configured: SECRET, query: 123 }).authorized, false);
  assert.equal(sameSecret('abc', 'abd'), false);
});
