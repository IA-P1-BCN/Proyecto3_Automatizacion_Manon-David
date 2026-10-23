const test = require('node:test');
const assert = require('node:assert/strict');
const { buildReceipt } = require('./02-format-receipt.js');

// Payloads from docs/guia-de-la-app.md (seeded sample data, no real customers).
const partialDeposit = {
  id: 25, fecha: '2026-10-20', cliente: 'Carmen Ruiz', telefono: '612 345 001', email: 'carmen@example.com',
  producto: 'Botín piel marrón', talla: '38', precio: 89.9, fecha_limite: '2027-01-18',
  estado: 'activo', abonado: 30.0, pendiente: 59.9, importe: 20.0,
};
const finalDeposit = { ...partialDeposit, estado: 'liquidado', abonado: 89.9, pendiente: 0, importe: 12.0 };

test('1 · partial deposit shows paid, pending and deadline in Spanish format', () => {
  const { recibo, emailValido, liquidado, to } = buildReceipt(partialDeposit);
  assert.equal(emailValido, true);
  assert.equal(liquidado, false);
  assert.equal(to, 'carmen@example.com');
  assert.equal(recibo.subject, 'Recibo de tu abono · Botín piel marrón');
  assert.match(recibo.body, /Hola Carmen Ruiz,/);
  assert.match(recibo.body, /abono de 20,00 € .*«Botín piel marrón» \(talla 38\)/);
  assert.match(recibo.body, /Pendiente por pagar: 59,90 €/);
  assert.match(recibo.body, /Fecha límite: 18\/01\/2027/);
});

test('2 · pending is shown as the event carries it, never recomputed', () => {
  const { recibo } = buildReceipt({ ...partialDeposit, precio: 100, abonado: 5, pendiente: 59.9 });
  assert.match(recibo.body, /Pendiente por pagar: 59,90 €/);
});

test('3 · settled reservation says to collect the shoes and shows no pending amount', () => {
  const { recogida, liquidado } = buildReceipt(finalDeposit);
  assert.equal(liquidado, true);
  assert.match(recogida.subject, /Ya puedes recoger tus zapatos/);
  assert.match(recogida.body, /último abono de 12,00 €/);
  assert.match(recogida.body, /recoger tus zapatos/);
  assert.doesNotMatch(recogida.body, /Pendiente/);
});

test('4 · empty, missing or @-less email is not usable', () => {
  for (const email of ['', '   ', undefined, null, 'carmen.example.com']) {
    assert.equal(buildReceipt({ ...partialDeposit, email }).emailValido, false, `email ${JSON.stringify(email)}`);
  }
});

test('5 · shop alert has number, customer, phone, amount and reason', () => {
  const { aviso } = buildReceipt({ ...partialDeposit, email: '' });
  assert.equal(aviso.subject, 'Abono sin recibo: el apartado nº 25 no tiene email válido');
  assert.match(aviso.body, /Apartado nº: 25/);
  assert.match(aviso.body, /Cliente:\s+Carmen Ruiz/);
  assert.match(aviso.body, /Teléfono:\s+612 345 001/);
  assert.match(aviso.body, /Abonado:\s+20,00 €/);
  assert.match(aviso.body, /Motivo:/);
});

test('6 · shop alert leaves out the phone line when there is none', () => {
  const { aviso } = buildReceipt({ ...partialDeposit, email: '', telefono: '' });
  assert.doesNotMatch(aviso.body, /Teléfono/);
});

test('7 · amounts over a thousand and cents keep two decimals', () => {
  const { recibo } = buildReceipt({ ...partialDeposit, importe: 5, pendiente: 1234.5 });
  assert.match(recibo.body, /abono de 5,00 €/);
  assert.match(recibo.body, /Pendiente por pagar: 1234,50 €/);
});

test('9 · reservation without a size leaves the size out, never prints "null"', () => {
  for (const talla of [null, undefined, '']) {
    const { recibo, recogida } = buildReceipt({ ...partialDeposit, talla });
    assert.match(recibo.body, /para tu apartado de «Botín piel marrón»\./);
    assert.doesNotMatch(recibo.body + recogida.body, /null|undefined|talla/);
  }
});

test('8 · event without a valid amount fails so flow 08 alerts', () => {
  assert.throws(() => buildReceipt({ ...partialDeposit, importe: undefined }), /importe/);
  assert.throws(() => buildReceipt({ ...partialDeposit, pendiente: '59.9' }), /pendiente/);
  assert.throws(() => buildReceipt({ ...partialDeposit, id: undefined }), /número de apartado/);
  assert.throws(() => buildReceipt(undefined), /sin datos/);
});
