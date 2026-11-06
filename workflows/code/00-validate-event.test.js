const test = require('node:test');
const assert = require('node:assert/strict');
const { validateEvent } = require('./00-validate-event.js');

const reservation = { id: 25, cliente: 'Carmen Ruiz', email: 'carmen@example.com', precio: 89.9, abonado: 10, pendiente: 79.9 };

test('valid events of the guide pass and keep their data', () => {
  assert.deepEqual(validateEvent({ evento: 'apartado.creado', datos: reservation }), { ok: true, evento: 'apartado.creado', datos: reservation });
  assert.equal(validateEvent({ evento: 'abono.registrado', datos: { ...reservation, importe: 20 } }).ok, true);
  assert.equal(validateEvent({ evento: 'venta.registrada', datos: { id: 3, concepto: 'Cordones', importe: 4.5, forma_pago: 'efectivo' } }).ok, true);
});

test('body that is not an object, missing or non-text evento, missing or wrong datos are invalid', () => {
  for (const body of [undefined, null, 'texto', [], 7]) assert.equal(validateEvent(body).ok, false);
  assert.equal(validateEvent({ datos: {} }).ok, false);
  assert.equal(validateEvent({ evento: '', datos: {} }).ok, false);
  assert.equal(validateEvent({ evento: '  ', datos: {} }).ok, false);
  assert.equal(validateEvent({ evento: 5, datos: {} }).ok, false);
  assert.equal(validateEvent({ evento: 'apartado.creado' }).ok, false);
  assert.equal(validateEvent({ evento: 'apartado.creado', datos: 'cadena' }).ok, false);
  assert.equal(validateEvent({ evento: 'apartado.creado', datos: [] }).ok, false);
});

test('importe as text or missing id is invalid', () => {
  assert.equal(validateEvent({ evento: 'abono.registrado', datos: { ...reservation, importe: 'veinte' } }).reason, 'datos.importe debe ser un número');
  assert.equal(validateEvent({ evento: 'abono.registrado', datos: { ...reservation, importe: null } }).ok, false);
  assert.equal(validateEvent({ evento: 'apartado.creado', datos: { ...reservation, id: undefined } }).reason, 'datos.id debe ser un número');
  assert.equal(validateEvent({ evento: 'venta.registrada', datos: { importe: '4,50' } }).ok, false);
});

test('email: absent, null and empty are allowed; a malformed or non-text one is not', () => {
  for (const email of [undefined, null, '']) assert.equal(validateEvent({ evento: 'apartado.creado', datos: { ...reservation, email } }).ok, true);
  for (const email of ['sin-arroba', 'a@b', 'dos @example.com', 42, {}]) {
    assert.equal(validateEvent({ evento: 'apartado.creado', datos: { ...reservation, email } }).reason, 'datos.email no es un email válido');
  }
});

test('unknown events pass through; routed ones are the only ones with field rules', () => {
  assert.equal(validateEvent({ evento: 'apartado.vencido', datos: { apartado: {}, vale: {} } }).ok, true);
  assert.equal(validateEvent({ evento: 'algo.nuevo', datos: {} }).ok, true);
});

test('the reason never repeats a value from the payload', () => {
  const secretValues = ['Carmen Ruiz', 'persona privada', '612 345 001'];
  const bodies = [
    { evento: 'abono.registrado', datos: { ...reservation, cliente: secretValues[0], telefono: secretValues[2], importe: secretValues[1] } },
    { evento: 'apartado.creado', datos: { ...reservation, cliente: secretValues[0], email: secretValues[1] } },
  ];
  for (const body of bodies) {
    const { reason } = validateEvent(body);
    for (const value of secretValues) assert.equal(reason.includes(value), false);
  }
});
