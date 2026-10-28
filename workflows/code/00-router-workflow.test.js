// Runs the HU-14 Code nodes of the generated router against fake requests, and checks its graph.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const router = JSON.parse(fs.readFileSync('workflows/00-event-router.json', 'utf8'));
const nodeOf = (name) => router.nodes.find((item) => item.name === name);
const SECRET = 'fake-secret-for-tests';

function runCode(name, { input, env = {}, nodes = {} }) {
  const fake = (nodeName) => ({ first: () => ({ json: nodes[nodeName] }) });
  const $input = { first: () => ({ json: input }) };
  const run = new Function('$', '$input', '$env', nodeOf(name).parameters.jsCode);
  return run(fake, $input, env).map((item) => item.json);
}
const checkToken = (request, ...configured) => runCode('Check Token', { input: request, env: { TIENDA_WEBHOOK_TOKEN: configured.length ? configured[0] : SECRET } })[0];
const body = { evento: 'abono.registrado', datos: { id: 25, importe: 20, email: 'carmen@example.com' } };

test('the webhook answers through Respond to Webhook: 200 when accepted, 401 when not', () => {
  assert.equal(nodeOf('Receive App Event').parameters.responseMode, 'responseNode');
  assert.equal(nodeOf('Respond Accepted').parameters.options.responseCode, 200);
  assert.equal(nodeOf('Respond Unauthorized').parameters.options.responseCode, 401);
  assert.deepEqual(router.connections['Token Accepted?'].main.map((targets) => targets[0].node), ['Respond Accepted', 'Respond Unauthorized']);
});

test('nothing but the accepted path reaches the event handling', () => {
  const reachable = new Set();
  const visit = (name) => {
    if (reachable.has(name)) return;
    reachable.add(name);
    for (const targets of router.connections[name]?.main || []) for (const target of targets) visit(target.node);
  };
  visit('Respond Unauthorized');
  assert.deepEqual([...reachable].sort(), ['Raise Token Misconfiguration', 'Respond Unauthorized']);
});

test('Check Token: query token (the app), header token and rejection', () => {
  assert.equal(checkToken({ query: { token: SECRET }, headers: {}, body }).authorized, true);
  assert.equal(checkToken({ query: {}, headers: { 'x-webhook-token': SECRET }, body }).authorized, true);
  assert.equal(checkToken({ query: { token: 'wrong' }, headers: {}, body }).authorized, false);
  assert.equal(checkToken({ query: {}, headers: {}, body }).authorized, false);
  assert.deepEqual(checkToken({ body }).misconfigured, false);
});

test('Check Token: an unset or empty TIENDA_WEBHOOK_TOKEN rejects even a request with no token', () => {
  for (const configured of [undefined, '']) {
    const result = checkToken({ query: {}, headers: {}, body }, configured);
    assert.deepEqual([result.authorized, result.misconfigured], [false, true]);
  }
});

test('a wrong token ends quietly; an unset token raises the alert and names no secret', () => {
  const wrong = checkToken({ query: { token: 'wrong' }, headers: {}, body });
  assert.deepEqual(runCode('Raise Token Misconfiguration', { input: {}, nodes: { 'Check Token': wrong } }), []);
  const unset = checkToken({ query: {}, headers: {}, body }, '');
  assert.throws(() => runCode('Raise Token Misconfiguration', { input: {}, nodes: { 'Check Token': unset } }), /TIENDA_WEBHOOK_TOKEN está vacío/);
});

test('Extract Event: a valid body becomes evento and datos', () => {
  assert.deepEqual(runCode('Extract Event', { input: { body } }), [{ evento: body.evento, datos: body.datos }]);
});

test('Extract Event: an invalid body stops with the field named and no personal data', () => {
  const bad = { evento: 'abono.registrado', datos: { id: 25, importe: 'veinte', email: 'carmen@example.com', cliente: 'Carmen Ruiz' } };
  assert.throws(() => runCode('Extract Event', { input: { body: bad } }), (error) => {
    assert.match(error.message, /datos\.importe debe ser un número/);
    assert.equal(/Carmen|carmen@|veinte/.test(error.message), false);
    return true;
  });
  assert.throws(() => runCode('Extract Event', { input: { body: { datos: {} } } }), /falta evento/);
  assert.throws(() => runCode('Extract Event', { input: { body: undefined } }), /no es un objeto JSON/);
});

test('routes: reservation and deposit go through the consent check, the sale alert and unknown events do not', () => {
  const routes = router.connections['Route by Event'].main.map((targets) => targets[0].node);
  assert.deepEqual(routes, ['Mark New Reservation', 'Check Consent for Deposit (flow 09)', 'Call Large Sale Alert (flow 04)', 'Ignore Unhandled Event']);
  assert.deepEqual(runCode('Mark New Reservation', { input: { evento: 'apartado.creado', datos: {} } }), [{ evento: 'apartado.creado', datos: {}, registrar: true }]);
});

test('flows 01 and 02 are only called after the consent answer; a refusal ends in a no-op', () => {
  const next = (name) => router.connections[name].main.map((targets) => targets[0].node);
  assert.deepEqual(next('May Confirm Reservation?'), ['Call Reservation Confirmation (flow 01)', 'Skip Message Without Consent']);
  assert.deepEqual(next('May Send Receipt?'), ['Call Deposit Receipt (flow 02)', 'Skip Message Without Consent']);
  const callsTo = (target) => Object.entries(router.connections).filter(([, out]) => out.main.some((targets) => targets.some((t) => t.node === target))).map(([from]) => from);
  assert.deepEqual(callsTo('Call Reservation Confirmation (flow 01)'), ['May Confirm Reservation?']);
  assert.deepEqual(callsTo('Call Deposit Receipt (flow 02)'), ['May Send Receipt?']);
  for (const name of ['Check Consent for New Reservation (flow 09)', 'Check Consent for Deposit (flow 09)']) {
    assert.equal(nodeOf(name).parameters.options.waitForSubWorkflow, true);
  }
});

test('consent condition: allowed, or no email at all (flows 01 and 02 then only warn the shop)', () => {
  const expression = nodeOf('May Send Receipt?').parameters.conditions.conditions[0].leftValue;
  const evaluate = (json) => new Function('$json', `return ${expression.slice(3, -2)};`)(json);
  assert.equal(evaluate({ permitido: true, razon: 'activo' }), true);
  assert.equal(evaluate({ permitido: false, razon: 'sin_email' }), true);
  for (const razon of ['sin_consentimiento', 'consentimiento_retirado', 'email_invalido', 'registro_ilegible']) {
    assert.equal(evaluate({ permitido: false, razon }), false);
  }
});

test('the exported router holds no credentials, no localhost and no token value', () => {
  const text = JSON.stringify(router);
  assert.ok(!router.nodes.some((item) => item.credentials));
  assert.equal(text.includes('localhost'), false);
  assert.equal(text.includes('cambia-este-secreto'), false);
  assert.equal(text.includes(SECRET), false);
});
