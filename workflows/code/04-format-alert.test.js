const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAlert } = require('./04-format-alert.js');

// Payload shape from docs/guia-de-la-app.md (seeded sample data).
const sale = { id: 257, fecha: '2026-10-20', concepto: 'Botas de piel', importe: 189.5, forma_pago: 'tarjeta' };

test('1 · alert shows concept, euros, payment method and date in Spanish', () => {
  const { subject, body } = buildAlert(sale, '150');
  assert.equal(subject, 'Venta grande: 189,50 € · Botas de piel');
  assert.match(body, /Concepto:\s+Botas de piel/);
  assert.match(body, /Importe:\s+189,50 €/);
  assert.match(body, /Forma de pago:\s+tarjeta/);
  assert.match(body, /Fecha:\s+20\/10\/2026/);
});

test('2 · returns the numbers the IF node compares, untouched', () => {
  const { importe, umbral } = buildAlert({ ...sale, importe: 4.5 }, '100');
  assert.equal(importe, 4.5);
  assert.equal(umbral, 100);
});

test('3 · decimal threshold with a dot is accepted, with surrounding spaces too', () => {
  assert.equal(buildAlert(sale, '99.99').umbral, 99.99);
  assert.equal(buildAlert(sale, ' 150 ').umbral, 150);
});

test('4 · empty, missing, non-numeric, comma or negative threshold fails so flow 08 alerts', () => {
  for (const raw of ['', '   ', undefined, null, 'abc', '99,99', '-5']) {
    assert.throws(() => buildAlert(sale, raw), /TIENDA_UMBRAL_VENTA_GRANDE/, `threshold ${JSON.stringify(raw)}`);
  }
});

test('5 · missing or non-numeric importe fails so flow 08 alerts', () => {
  for (const importe of [undefined, null, '189.5', NaN]) {
    assert.throws(() => buildAlert({ ...sale, importe }, '150'), /importe/, `importe ${JSON.stringify(importe)}`);
  }
  assert.throws(() => buildAlert(undefined, '150'), /sin datos/);
});

test('6 · amounts over a thousand keep two decimals', () => {
  assert.match(buildAlert({ ...sale, importe: 1234.5 }, '150').body, /Importe:\s+1234,50 €/);
});
