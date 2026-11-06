// Runs the Code nodes of the generated flows 09 and 09b against fake n8n inputs, and checks the exported graphs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const load = (file) => JSON.parse(fs.readFileSync(`workflows/${file}`, 'utf8'));
const check = load('09-consent-check.json');
const backfill = load('09b-consent-backfill.json');
const nodeOf = (workflow, name) => workflow.nodes.find((item) => item.name === name);

// n8n gives a Code node `$('Name').all()`, `$input.all()` and `$now`; this fakes just those.
function runCode(workflow, name, { nodes = {}, input = [] } = {}) {
  const fake = (nodeName) => ({ all: () => (nodes[nodeName] || []).map((json) => ({ json })) });
  const $now = { setZone: () => ({ toFormat: () => '2026-10-28' }) };
  const $input = { all: () => input.map((json) => ({ json })) };
  const run = new Function('$', '$now', '$input', nodeOf(workflow, name).parameters.jsCode);
  return run(fake, $now, $input).map((item) => item.json);
}

const register = [
  { email: 'carmen@example.com', estado: 'activo', fecha: '2026-09-02', origen: 'tienda' },
  { email: 'ana@example.com', estado: 'retirado', fecha: '2026-09-07', origen: 'tienda' },
];
const decide = (inputs, rows = register) => runCode(check, 'Decide', { nodes: { 'When Called By Another Flow': inputs, 'Read Consent Register': rows } });

test('both graphs are inactive, carry no credentials and every link points to an existing node', () => {
  for (const workflow of [check, backfill]) {
    assert.equal(workflow.active, false);
    const names = new Set(workflow.nodes.map((item) => item.name));
    for (const item of workflow.nodes) assert.ok(!item.credentials, `${item.name} must not carry credentials`);
    for (const [from, outputs] of Object.entries(workflow.connections)) {
      assert.ok(names.has(from), from);
      for (const targets of outputs.main) for (const target of targets) assert.ok(names.has(target.node), target.node);
    }
  }
  assert.ok(!JSON.stringify([check, backfill]).includes('localhost'));
});

test('the check reads the register by name and fails closed if the read fails', () => {
  const read = nodeOf(check, 'Read Consent Register');
  assert.equal(read.parameters.dataTableId.value, 'consentimientos');
  assert.equal(read.parameters.returnAll, true);
  assert.equal(read.onError, 'continueRegularOutput');
  assert.equal(read.alwaysOutputData, true);
});

test('Decide: active allowed, withdrawn and unknown blocked, items from the router keep their event', () => {
  const [ok, withdrawn, unknown] = decide([
    { evento: 'abono.registrado', datos: { id: 1, email: 'Carmen@Example.com' } },
    { evento: 'abono.registrado', datos: { id: 2, email: 'ana@example.com' } },
    { evento: 'abono.registrado', datos: { id: 3, email: 'nuevo@example.com' } },
  ]);
  assert.deepEqual([ok.permitido, ok.razon, ok.evento, ok.datos.id], [true, 'activo', 'abono.registrado', 1]);
  assert.deepEqual([withdrawn.permitido, withdrawn.razon], [false, 'consentimiento_retirado']);
  assert.deepEqual([unknown.permitido, unknown.razon], [false, 'sin_consentimiento']);
});

test('Decide: a flat item from flows 06 and 06b uses its own email field', () => {
  const [result] = decide([{ email: 'carmen@example.com', id: 9 }]);
  assert.equal(result.permitido, true);
  assert.equal(result.id, 9);
});

test('Decide: registrar creates the row once even if two items of the call share the new email', () => {
  const out = decide([
    { evento: 'apartado.creado', registrar: true, datos: { email: 'Nuevo@example.com' } },
    { evento: 'apartado.creado', registrar: true, datos: { email: 'nuevo@example.com' } },
  ]);
  assert.equal(out[0].permitido, true);
  assert.deepEqual(out[0].insertar, { email: 'nuevo@example.com', estado: 'activo', fecha: '2026-10-28', origen: 'tienda' });
  assert.equal(out[1].insertar, null);
  assert.equal(out[1].razon, 'activo');
});

test('Decide: an event without email and a withdrawn customer who reserves again write nothing', () => {
  const out = decide([
    { evento: 'apartado.creado', registrar: true, datos: { email: '' } },
    { evento: 'apartado.creado', registrar: true, datos: { email: 'ana@example.com' } },
  ]);
  assert.deepEqual(out.map((item) => [item.permitido, item.razon, item.insertar]), [[false, 'sin_email', null], [false, 'consentimiento_retirado', null]]);
});

test('Decide: an empty register (one empty item) is a valid register', () => {
  const [result] = decide([{ datos: { email: 'a@example.com' } }], [{}]);
  assert.equal(result.razon, 'sin_consentimiento');
});

test('Decide: a read error blocks every send with a usable email', () => {
  const out = decide([{ datos: { email: 'carmen@example.com' } }, { datos: { email: '' } }], [{ error: 'tabla no encontrada' }]);
  assert.deepEqual(out.map((item) => item.razon), ['registro_ilegible', 'sin_email']);
});

test('Return Decisions: removes the insert payload; raises the alert when the register was unreadable', () => {
  const returned = runCode(check, 'Return Decisions', { nodes: { Decide: [{ permitido: true, razon: 'registrado', insertar: { email: 'a@example.com' }, datos: { id: 1 } }] } });
  assert.deepEqual(returned, [{ permitido: true, razon: 'registrado', datos: { id: 1 } }]);
  assert.throws(
    () => runCode(check, 'Return Decisions', { nodes: { Decide: [{ permitido: false, razon: 'registro_ilegible', insertar: null }] } }),
    /No se pudo leer el registro/,
  );
});

test('the error text carries no email', () => {
  try {
    runCode(check, 'Return Decisions', { nodes: { Decide: [{ razon: 'registro_ilegible', email: 'secreto@example.com' }] } });
    assert.fail('expected a throw');
  } catch (error) {
    assert.equal(error.message.includes('secreto'), false);
  }
});

test('backfill: GET only, adds the missing emails once, touches no existing row and has no email node', () => {
  const fetch = nodeOf(backfill, 'Fetch Reservations');
  assert.equal(fetch.parameters.method, 'GET');
  assert.equal(fetch.parameters.genericAuthType, 'httpHeaderAuth');
  assert.ok(!backfill.nodes.some((item) => item.type.endsWith('.emailSend')));
  assert.deepEqual(backfill.nodes.filter((item) => item.type.endsWith('.dataTable')).map((item) => item.parameters.operation), ['get', 'insert']);
  const reservations = [{ email: 'Carmen@example.com' }, { email: 'jorge@example.com' }, { email: 'jorge@example.com' }, { email: '' }, {}];
  const planned = runCode(backfill, 'Plan Missing Consents', { nodes: { 'Fetch Reservations': reservations }, input: register });
  assert.deepEqual(planned, [{ email: 'jorge@example.com', estado: 'activo', fecha: '2026-10-28', origen: 'tienda (migración)' }]);
  const second = runCode(backfill, 'Plan Missing Consents', { nodes: { 'Fetch Reservations': reservations }, input: [...register, ...planned] });
  assert.deepEqual(second, []);
});
