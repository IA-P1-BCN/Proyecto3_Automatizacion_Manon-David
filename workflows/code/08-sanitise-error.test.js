const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAlert } = require('./08-sanitise-error.js');

const NOW = new Date('2026-10-23T10:30:00Z'); // 12:30 in Madrid (CEST)

function failure(message, overrides = {}) {
  return {
    workflow: { id: '7', name: '99 Error Test' },
    execution: {
      id: '31', url: 'http://localhost:5678/workflow/7/executions/31',
      lastNodeExecuted: 'Throw error', mode: 'webhook',
      error: { message }, ...overrides,
    },
  };
}

test('1 · plain error keeps flow, step and message', () => {
  const { subject, body } = buildAlert(failure('Error: apartado 99 no encontrado'), NOW);
  assert.equal(subject, '⚠️ Falló la automatización «99 Error Test»');
  assert.match(body, /Flujo:\s+99 Error Test/);
  assert.match(body, /Paso:\s+Throw error/);
  assert.match(body, /Error:\s+Error: apartado 99 no encontrado/);
  assert.match(body, /Ejecución: http:\/\/localhost:5678\/workflow\/7\/executions\/31/);
});

test('2 · Authorization bearer token is hidden', () => {
  const { body } = buildAlert(failure('Request failed: Authorization: Bearer abc123SECRET'), NOW);
  assert.match(body, /Authorization: \[oculto\]/);
  assert.doesNotMatch(body, /abc123SECRET/);
});

test('2b · bare bearer token and x-api-key header are hidden', () => {
  const { body } = buildAlert(failure('sent Bearer zzTOKENzz with x-api-key: cambia-esta-clave'), NOW);
  assert.doesNotMatch(body, /zzTOKENzz|cambia-esta-clave/);
  assert.match(body, /x-api-key: \[oculto\]/i);
});

test('3 · JSON pair with a secret key is masked, other pairs stay', () => {
  const { body } = buildAlert(failure('{"api_key":"sk-test-123","detalle":"422"}'), NOW);
  assert.doesNotMatch(body, /sk-test-123/);
  assert.match(body, /"api_key":"\[oculto\]"/);
  assert.match(body, /"detalle":"422"/);
});

test('3b · key=value pairs and quoted values with spaces are masked', () => {
  const { body } = buildAlert(failure('password=hunter2 & {"token": "two words"} user=marisa'), NOW);
  assert.doesNotMatch(body, /hunter2|two words/);
  assert.match(body, /user=marisa/);
});

test('4 · a 2000-character message is cut to 500', () => {
  const { body } = buildAlert(failure('x'.repeat(2000)), NOW);
  const line = body.split('\n').find((l) => l.startsWith('Error:'));
  assert.equal(line.replace(/^Error:\s+/, '').replace('…', '').length, 500);
});

test('4b · a secret straddling the cut is masked before cutting', () => {
  const { body } = buildAlert(failure(`${'x'.repeat(495)} token=SECRETVALUE123`), NOW);
  assert.doesNotMatch(body, /SECRET/);
});

test('5 · missing message gives the fallback', () => {
  for (const error of [undefined, {}, { message: '' }]) {
    const { body } = buildAlert(failure('', { error }), NOW);
    assert.match(body, /Error:\s+error sin mensaje/);
  }
});

test('5b · missing last node means the trigger failed', () => {
  const { body } = buildAlert(failure('boom', { lastNodeExecuted: undefined }), NOW);
  assert.match(body, /Paso:\s+desconocido \(falló el disparador\)/);
});

test('5c · an empty event does not throw', () => {
  const { subject, body } = buildAlert({}, NOW);
  assert.match(subject, /«desconocido»/);
  assert.match(body, /error sin mensaje/);
});

test('time is shown in Madrid time', () => {
  const { body } = buildAlert(failure('x'), NOW);
  assert.match(body, /Cuándo:\s+23\/10\/26,? 12:30:00/);
});

test('customer data in other fields never reaches the email', () => {
  const event = failure('boom', {
    data: { nombre: 'Carmen Ruiz', telefono: '600123456', email: 'carmen@example.com' },
    error: { message: 'boom', context: { cliente: 'Carmen Ruiz', telefono: '600123456' } },
  });
  event.workflow.settings = { contact: 'carmen@example.com' };
  const { subject, body } = buildAlert(event, NOW);
  assert.doesNotMatch(subject + body, /Carmen|600123456|example\.com/);
});
