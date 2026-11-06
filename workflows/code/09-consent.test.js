const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseEmail, decideConsent, missingConsents } = require('./09-consent.js');

const HOY = '2026-10-28';
const rows = [
  { email: 'carmen@example.com', estado: 'activo', fecha: '2026-09-02', origen: 'tienda' },
  { email: 'ana@example.com', estado: 'retirado', fecha: '2026-09-07', origen: 'tienda' },
];

test('normalise: trim and lowercase; anything that is not an address gives null', () => {
  assert.equal(normaliseEmail('  Carmen@Example.COM '), 'carmen@example.com');
  for (const bad of ['', '   ', 'sin-arroba', 'a@b', 'dos @example.com', null, undefined, 42]) assert.equal(normaliseEmail(bad), null);
});

test('active consent allows the send, whatever the case or spaces of the email', () => {
  assert.deepEqual(decideConsent(' Carmen@Example.com ', rows), { permitido: true, razon: 'activo', insertar: null });
});

test('withdrawn consent blocks the send', () => {
  assert.deepEqual(decideConsent('ana@example.com', rows), { permitido: false, razon: 'consentimiento_retirado', insertar: null });
});

test('an email that is not in the register blocks the send', () => {
  assert.deepEqual(decideConsent('nuevo@example.com', rows), { permitido: false, razon: 'sin_consentimiento', insertar: null });
  assert.equal(decideConsent('nuevo@example.com', []).permitido, false);
});

test('no email and invalid email are told apart and both block', () => {
  assert.equal(decideConsent('', rows).razon, 'sin_email');
  assert.equal(decideConsent(undefined, rows).razon, 'sin_email');
  assert.equal(decideConsent('sin-arroba', rows).razon, 'email_invalido');
  assert.equal(decideConsent('sin-arroba', rows).permitido, false);
});

test('unreadable register blocks the send (fail closed), even for a known email', () => {
  assert.deepEqual(decideConsent('carmen@example.com', [{ error: 'tabla no encontrada' }]), { permitido: false, razon: 'registro_ilegible', insertar: null });
  assert.equal(decideConsent('carmen@example.com', undefined).razon, 'registro_ilegible');
  assert.equal(decideConsent('carmen@example.com', [rows[0], { error: 'x' }]).permitido, false);
});

test('registrar: a new reservation with an email creates the row and is allowed', () => {
  const result = decideConsent('Nuevo@Example.com', rows, { registrar: true, hoy: HOY });
  assert.deepEqual(result, {
    permitido: true,
    razon: 'registrado',
    insertar: { email: 'nuevo@example.com', estado: 'activo', fecha: HOY, origen: 'tienda' },
  });
});

test('registrar never overwrites a withdrawn row and does not duplicate an active one', () => {
  assert.deepEqual(decideConsent('ana@example.com', rows, { registrar: true, hoy: HOY }), { permitido: false, razon: 'consentimiento_retirado', insertar: null });
  assert.deepEqual(decideConsent('carmen@example.com', rows, { registrar: true, hoy: HOY }), { permitido: true, razon: 'activo', insertar: null });
});

test('registrar without a usable email writes nothing', () => {
  assert.equal(decideConsent('', rows, { registrar: true, hoy: HOY }).insertar, null);
  assert.equal(decideConsent('x', rows, { registrar: true, hoy: HOY }).insertar, null);
});

test('the register row carries nothing but email, estado, fecha and origen', () => {
  const { insertar } = decideConsent('nuevo@example.com', [], { registrar: true, hoy: HOY });
  assert.deepEqual(Object.keys(insertar).sort(), ['email', 'estado', 'fecha', 'origen']);
});

test('backfill: distinct valid emails that are not in the register yet', () => {
  const reservations = [
    { id: 1, email: 'Carmen@example.com' },
    { id: 2, email: 'jorge@example.com' },
    { id: 3, email: ' JORGE@example.com ' },
    { id: 4, email: 'ana@example.com' },
    { id: 5, email: '' },
    { id: 6 },
    { id: 7, email: 'mal-email' },
    { id: 8, email: 'lucia@example.com' },
  ];
  assert.deepEqual(missingConsents(reservations, rows, { hoy: HOY }), [
    { email: 'jorge@example.com', estado: 'activo', fecha: HOY, origen: 'tienda (migración)' },
    { email: 'lucia@example.com', estado: 'activo', fecha: HOY, origen: 'tienda (migración)' },
  ]);
});

test('backfill is idempotent: with every email already in the register nothing is added', () => {
  const first = missingConsents([{ email: 'jorge@example.com' }], rows, { hoy: HOY });
  assert.equal(first.length, 1);
  assert.deepEqual(missingConsents([{ email: 'jorge@example.com' }], [...rows, ...first], { hoy: HOY }), []);
  assert.deepEqual(missingConsents([], rows), []);
  assert.deepEqual(missingConsents(undefined, undefined), []);
});
