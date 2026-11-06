const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCTS, optionLabel, validateRequest, nextRef, checkDuplicate, planEmails, customerEmail, verifyEmails,
} = require('./11-home-reservations.js');

const TODAY = '2026-10-29';
const form = (overrides = {}) => ({
  nombre: ' Ana  Pérez ', telefono: '612000000', email: ' Ana@Example.com ',
  producto: optionLabel(PRODUCTS[1]), talla: '38', consentimiento: ['Acepto'], ...overrides,
});
const solicitud = (overrides = {}) => ({
  nombre: 'Ana Pérez', telefono: '612000000', email: 'ana@example.com', producto: 'Zueco cuero negro', talla: 38, precio: 64.5, ...overrides,
});
const row = (overrides = {}) => ({ ref: 'SOL-0001', ...solicitud(), estado: 'pendiente', fecha: TODAY, ...overrides });

test('1 · valid request is cleaned and priced from the list', () => {
  const result = validateRequest(form());
  assert.equal(result.valido, true);
  assert.deepEqual(result.solicitud, solicitud());
});

test('2 · the price is never read from the form', () => {
  const result = validateRequest(form({ precio: 1, importe: 1 }));
  assert.equal(result.solicitud.precio, 64.5);
});

test('3 · every invalid field is reported', () => {
  const result = validateRequest(form({ nombre: ' ', email: 'ana', producto: 'Otro - 1,00 €', talla: '50', consentimiento: [] }));
  assert.equal(result.valido, false);
  assert.equal(result.errores.length, 5);
});

test('4 · missing or empty consent is refused', () => {
  assert.equal(validateRequest(form({ consentimiento: [] })).valido, false);
  assert.equal(validateRequest(form({ consentimiento: undefined })).valido, false);
});

test('5 · a model label with a wrong price is refused', () => {
  assert.equal(validateRequest(form({ producto: 'Zueco cuero negro - 1,00 €' })).valido, false);
});

test('6 · references: first, next, gaps and the empty-table item', () => {
  assert.equal(nextRef([{}]), 'SOL-0001');
  assert.equal(nextRef([row({ ref: 'SOL-0001' }), row({ ref: 'SOL-0007' })]), 'SOL-0008');
  assert.equal(nextRef([row({ ref: 'SOL-0099' })]), 'SOL-0100');
});

test('7 · same customer, model and size still pending is a duplicate', () => {
  const result = checkDuplicate(solicitud(), [row()], TODAY);
  assert.deepEqual(result, { duplicado: true, ref: 'SOL-0001' });
});

test('8 · another model, or a confirmed or cancelled row, is not a duplicate', () => {
  assert.equal(checkDuplicate(solicitud({ producto: 'Bota alta negra' }), [row()], TODAY).duplicado, false);
  assert.equal(checkDuplicate(solicitud(), [row({ estado: 'confirmada' })], TODAY).duplicado, false);
  assert.equal(checkDuplicate(solicitud(), [row({ estado: 'cancelada' })], TODAY).duplicado, false);
});

test('9 · a new request becomes a pending row with the next reference', () => {
  const result = checkDuplicate(solicitud({ email: 'otra@example.com' }), [row()], TODAY);
  assert.equal(result.duplicado, false);
  assert.equal(result.row.ref, 'SOL-0002');
  assert.equal(result.row.estado, 'pendiente');
  assert.equal(result.row.fecha, TODAY);
});

test('10 · consent allowed: shop and customer emails, reference as the concept', () => {
  const emails = planEmails({ row: row(), permitido: true, shopAddress: 'tienda@example.com', paymentInstructions: 'Bizum al 600 000 000.' });
  assert.equal(emails.length, 2);
  assert.equal(emails[0].to, 'tienda@example.com');
  assert.equal(emails[1].to, 'ana@example.com');
  assert.match(emails[1].body, /SOL-0001 como concepto/);
  assert.match(emails[1].body, /64,50 €/);
  assert.match(emails[1].body, /5,00 €/);
});

test('11 · consent withheld: only the shop is told, and it is told to call', () => {
  const emails = planEmails({ row: row(), permitido: false, shopAddress: 'tienda@example.com' });
  assert.equal(emails.length, 1);
  assert.match(emails[0].body, /Contáctala por otro medio/);
});

test('12 · missing payment instructions fall back to asking the shop', () => {
  assert.match(customerEmail(row(), undefined).body, /Pregunta en la tienda/);
});

test('13 · a failed email fails the run, none passes', () => {
  assert.throws(() => verifyEmails([{ error: 'smtp' }, {}]), /1 correo/);
  assert.doesNotThrow(() => verifyEmails([{}, {}]));
});
