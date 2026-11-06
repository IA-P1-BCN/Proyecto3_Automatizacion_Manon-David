const test = require('node:test');
const assert = require('node:assert/strict');
const { buildConfirmation } = require('./01-format-confirmation.js');

// Payloads from docs/guia-de-la-app.md (seeded sample data, no real customers).
const normal = {
  id: 25, fecha: '2026-10-20', cliente: 'Carmen Ruiz', telefono: '612 345 001', email: 'carmen@example.com',
  producto: 'Botín piel marrón', talla: '38', precio: 89.9, fecha_limite: '2027-01-18',
  estado: 'activo', abonado: 10.0, pendiente: 79.9,
};

test('1 · normal reservation shows model, size, price, paid, pending and deadline in Spanish format', () => {
  const { confirmacion, emailValido, to } = buildConfirmation(normal);
  assert.equal(emailValido, true);
  assert.equal(to, 'carmen@example.com');
  assert.equal(confirmacion.subject, 'Tu apartado en Paso Firme: Botín piel marrón');
  assert.match(confirmacion.body, /Hola Carmen Ruiz,/);
  assert.match(confirmacion.body, /nº 25/);
  assert.match(confirmacion.body, /Modelo:\s+Botín piel marrón/);
  assert.match(confirmacion.body, /Talla:\s+38/);
  assert.match(confirmacion.body, /Precio:\s+89,90 €/);
  assert.match(confirmacion.body, /Abonado:\s+10,00 €/);
  assert.match(confirmacion.body, /Pendiente:\s+79,90 €/);
  assert.match(confirmacion.body, /Fecha límite: 18\/01\/2027/);
});

test('2 · pending is shown as the event carries it, never recomputed', () => {
  const { confirmacion } = buildConfirmation({ ...normal, precio: 64.5, abonado: 5, pendiente: 59.5 });
  assert.match(confirmacion.body, /Pendiente:\s+59,50 €/);
  const inconsistent = buildConfirmation({ ...normal, precio: 100, abonado: 5, pendiente: 59.9 });
  assert.match(inconsistent.confirmacion.body, /Pendiente:\s+59,90 €/);
});

test('3 · reservation without a size leaves the size line out, never prints "null"', () => {
  for (const talla of [null, undefined, '', '  ']) {
    const { confirmacion } = buildConfirmation({ ...normal, talla });
    assert.doesNotMatch(confirmacion.body, /Talla|null|undefined/);
  }
});

test('4 · settled reservation says to collect the shoes and shows no pending amount', () => {
  const { confirmacion } = buildConfirmation({ ...normal, estado: 'liquidado', abonado: 89.9, pendiente: 0 });
  assert.match(confirmacion.body, /recoger tus zapatos/);
  assert.doesNotMatch(confirmacion.body, /Pendiente|Fecha límite/);
});

test('5 · tricky decimals and amounts over a thousand keep two decimals', () => {
  const { confirmacion } = buildConfirmation({ ...normal, precio: 1234.5, abonado: 0.1, pendiente: 1234.4 });
  assert.match(confirmacion.body, /Precio:\s+1234,50 €/);
  assert.match(confirmacion.body, /Abonado:\s+0,10 €/);
});

test('6 · empty, missing or @-less email is not usable', () => {
  for (const email of ['', '   ', undefined, null, 'carmen.example.com']) {
    assert.equal(buildConfirmation({ ...normal, email }).emailValido, false, `email ${JSON.stringify(email)}`);
  }
});

test('7 · shop alert has number, customer, phone, model and reason', () => {
  const { aviso } = buildConfirmation({ ...normal, email: '' });
  assert.equal(aviso.subject, 'Apartado sin confirmación: el apartado nº 25 no tiene email válido');
  assert.match(aviso.body, /Apartado nº: 25/);
  assert.match(aviso.body, /Cliente:\s+Carmen Ruiz/);
  assert.match(aviso.body, /Teléfono:\s+612 345 001/);
  assert.match(aviso.body, /Modelo:\s+Botín piel marrón/);
  assert.match(aviso.body, /Motivo:/);
});

test('8 · shop alert leaves out the phone line when there is none', () => {
  const { aviso } = buildConfirmation({ ...normal, email: '', telefono: '' });
  assert.doesNotMatch(aviso.body, /Teléfono/);
});

test('9 · event without valid figures or number fails so flow 08 alerts', () => {
  assert.throws(() => buildConfirmation({ ...normal, precio: undefined }), /precio/);
  assert.throws(() => buildConfirmation({ ...normal, pendiente: '79.9' }), /pendiente/);
  assert.throws(() => buildConfirmation({ ...normal, id: undefined }), /número de apartado/);
  assert.throws(() => buildConfirmation(undefined), /sin datos/);
});
