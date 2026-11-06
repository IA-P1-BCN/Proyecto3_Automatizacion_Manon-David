const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractRefs, decideRequest, buildApartadoBody, claimHolds, interpretCreation, afterRowUpdate, toResult,
} = require('./11b-match-request.js');

const request = (overrides = {}) => ({
  ref: 'SOL-0007', nombre: 'Ana Pérez', telefono: '612000000', email: 'ana@example.com',
  producto: 'Zueco cuero negro', talla: 38, precio: 64.5, estado: 'pendiente', ...overrides,
});
const payment = (overrides = {}) => ({ ordenante: 'ANA PEREZ LOPEZ', importe: 20, concepto: 'SOL-0007', tipo: 'bizum', ...overrides });
const reservation = (overrides = {}) => ({ id: 3, cliente: 'Ana Pérez', estado: 'activo', ...overrides });
const decide = (overrides = {}) => decideRequest({ payment: payment(), requests: [request()], reservations: [], allowRegistration: true, ...overrides });

test('1 · references are normalised and de-duplicated', () => {
  assert.deepEqual(extractRefs('sol-7 y SOL 0007'), ['SOL-0007']);
  assert.deepEqual(extractRefs('zuecos'), []);
  assert.deepEqual(extractRefs('SOL-1 SOL-2'), ['SOL-0001', 'SOL-0002']);
});

test('2 · reference and payer name fit: the request is the candidate', () => {
  const result = decide();
  assert.equal(result.decision, 'candidate');
  assert.equal(result.crear, true);
  assert.equal(result.request.ref, 'SOL-0007');
});

test('3 · reference wins even when the payer also has an active reservation', () => {
  const result = decide({ reservations: [reservation()] });
  assert.equal(result.decision, 'candidate');
});

test('4 · unknown reference, several references, wrong payer: review, nothing reassigned', () => {
  assert.equal(decide({ payment: payment({ concepto: 'SOL-0099' }) }).decision, 'review');
  assert.equal(decide({ payment: payment({ concepto: 'SOL-0007 SOL-0008' }) }).decision, 'review');
  const stranger = decide({ payment: payment({ ordenante: 'ANTONIO FERNANDEZ SOTO' }) });
  assert.equal(stranger.decision, 'review');
  assert.match(stranger.reason, /no coincide/);
});

test('5 · a request that is not pending admits no payment', () => {
  for (const estado of ['confirmada', 'cancelada', 'procesando']) {
    const result = decide({ requests: [request({ estado })] });
    assert.equal(result.decision, 'review');
    assert.match(result.reason, new RegExp(estado));
  }
});

test('6 · abbreviated payer is accepted only with the reference', () => {
  assert.equal(decide({ payment: payment({ ordenante: 'ANA P.' }) }).decision, 'candidate');
  const withoutRef = decide({ payment: payment({ ordenante: 'ANA P.', concepto: 'zuecos' }) });
  assert.equal(withoutRef.decision, 'not_mine');
});

test('7 · no reference: one request fits and no reservation does', () => {
  const result = decide({ payment: payment({ concepto: 'zuecos' }) });
  assert.equal(result.decision, 'candidate');
});

test('8 · no reference: a matching active reservation makes it ambiguous', () => {
  const result = decide({ payment: payment({ concepto: 'zuecos' }), reservations: [reservation()] });
  assert.equal(result.decision, 'review');
});

test('9 · no reference: two requests fit, or none: review or not mine', () => {
  const two = decide({ payment: payment({ concepto: '' }), requests: [request(), request({ ref: 'SOL-0008', producto: 'Bota alta negra' })] });
  assert.equal(two.decision, 'review');
  assert.equal(decide({ payment: payment({ concepto: '', ordenante: 'LUCIA GOMEZ PEREZ' }) }).decision, 'not_mine');
});

test('10 · the nine bank-sample style payments without SOL-… stay with flow 03', () => {
  for (const ordenante of ['CARMEN RUIZ GARCIA', 'JORGE M.', 'LUCIA GOMEZ PEREZ', 'LAURA O.', 'ROMERO D', 'PAULA RAMOS LEON']) {
    assert.equal(decide({ payment: payment({ ordenante, concepto: 'apartado 2' }) }).decision, 'not_mine');
  }
});

test('11 · registration disabled: preview only, nothing to write', () => {
  const result = decide({ allowRegistration: false });
  assert.equal(result.decision, 'review');
  assert.equal(result.crear, false);
  assert.match(result.reason, /Vista previa.*20,00 €/);
});

test('12 · invalid amount is not handled here', () => {
  assert.equal(decide({ payment: payment({ importe: 0 }) }).decision, 'not_mine');
  assert.equal(decide({ payment: payment({ importe: NaN }) }).decision, 'not_mine');
});

test('13 · apartado body: the request plus the paid amount, optional fields omitted', () => {
  assert.deepEqual(buildApartadoBody(request(), payment()), {
    cliente: 'Ana Pérez', producto: 'Zueco cuero negro', talla: '38', precio: 64.5, abono_inicial: 20, forma_pago: 'bizum',
    telefono: '612000000', email: 'ana@example.com',
  });
  const bare = buildApartadoBody(request({ telefono: '', email: '' }), payment());
  assert.equal('telefono' in bare, false);
  assert.equal('email' in bare, false);
});

test('14 · the claim holds only for the payment whose key is stored', () => {
  const rows = [request({ estado: 'procesando', payment_key: 'k1' })];
  assert.equal(claimHolds(rows, request(), 'k1'), true);
  assert.equal(claimHolds(rows, request(), 'k2'), false);
  assert.equal(claimHolds([request()], request(), 'k1'), false);
  assert.equal(claimHolds([{}], request(), 'k1'), false);
});

test('15 · app answers: 201 confirms, 4xx releases, anything else stays uncertain', () => {
  const created = interpretCreation({ statusCode: 201, body: { id: 31 } }, request());
  assert.deepEqual([created.decision, created.accion, created.apartado_id], ['created', 'confirmar', 31]);
  const refused = interpretCreation({ statusCode: 422, body: { detail: 'El abono inicial mínimo es de 5 €' } }, request());
  assert.deepEqual([refused.decision, refused.accion], ['review', 'liberar']);
  assert.match(refused.reason, /mínimo es de 5 €/);
  for (const response of [{ statusCode: 500, body: {} }, { statusCode: 201, body: {} }, undefined]) {
    const unknown = interpretCreation(response, request());
    assert.deepEqual([unknown.decision, unknown.accion], ['uncertain', 'dejar']);
  }
});

test('16 · a failed row update after the app answered becomes an uncertain outcome', () => {
  const context = { decision: 'created', reason: '', request: request(), payment_key: 'k1' };
  assert.equal(afterRowUpdate(context, { id: 1 }), context);
  const broken = afterRowUpdate(context, { error: 'table unreadable' });
  assert.equal(broken.decision, 'uncertain');
  assert.match(broken.reason, /SOL-0007.*solicitudes_apartado/);
});

test('17 · the result keeps flow 03 fields and drops working fields', () => {
  const result = toResult({ payment: payment(), payment_key: 'k1', decision: 'created', reason: '', crear: false, claimed: true, body: {}, accion: 'confirmar', request: request() }, {});
  assert.deepEqual(Object.keys(result).sort(), ['candidates', 'decision', 'payment', 'payment_key', 'reason', 'registration_allowed', 'request_ref'].sort());
  assert.equal(result.request_ref, 'SOL-0007');
});

test('18 · a payment that is not about a request keeps every field and only gains decision not_mine', () => {
  const original = { payment: payment(), payment_key: 'k1', result: 'extracted', reason: 'missing_payment_concept' };
  const result = toResult({ ...original, decision: 'not_mine', reason: '', crear: false, request: null }, original);
  assert.deepEqual(result, { ...original, decision: 'not_mine' });
  assert.equal(result.reason, 'missing_payment_concept');
  assert.equal('decision' in original, false);
});
