const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('./10-excel-migration.js');

const csv = (name) => m.parseCsv(fs.readFileSync(path.join(__dirname, '..', '..', 'data', name), 'utf8'));
const prepared = () => m.prepareMigration(csv('excel_actual_apartados.csv'), csv('excel_actual_ventas.csv'));
const emptyApp = (p) => m.planCreates({ reservations: p.reservations, sales: p.sales, existing: new Map(), appSales: [] });
const ok = (body) => ({ statusCode: 201, body });
const rejected = (detail) => ({ statusCode: 422, body: { detail } });

// Pretend app: answers every apartado with an id, every abono and venta with 201.
const answer = (requests, respond) => requests.map((request) => respond(request));

test('3 · parseCsv reads the sample files like n8n would: quoted total, BOM, CRLF', () => {
  assert.equal(csv('excel_actual_apartados.csv').length, 12);
  assert.equal(csv('excel_actual_ventas.csv').length, 10);
  const rows = m.parseCsv('﻿fecha,concepto\r\n"TOTAL, a mano","1.842,30"\r\n"a ""b""",x\r\n');
  assert.deepEqual(rows, [{ fecha: 'TOTAL, a mano', concepto: '1.842,30' }, { fecha: 'a "b"', concepto: 'x' }]);
  assert.deepEqual(m.parseCsv(''), []);
});

test('3 · stage 1 builds one POST per new apartado, each with its original fecha', () => {
  const { creates } = emptyApp(prepared());
  const requests = m.apartadoRequests(creates);
  assert.equal(requests.length, 7);
  assert.ok(requests.every((r) => r.kind === 'apartado' && r.method === 'POST' && r.path === '/api/apartados' && r.body.fecha));
});

test('3 · a stage with nothing to send passes one marker around the HTTP node, and real() drops it again', () => {
  assert.deepEqual(m.apartadoRequests([]), []);
  assert.deepEqual(m.withMarker([]), [{ empty: true }]);
  assert.deepEqual(m.withMarker([{ kind: 'venta' }]), [{ kind: 'venta' }]);
  assert.deepEqual(m.real([{ empty: true }]), []);
  assert.deepEqual(m.real([{ kind: 'venta' }, { empty: true }]), [{ kind: 'venta' }]);
});

test('3 · stage 2 turns created apartados into abono requests with the ids the app gave', () => {
  const { creates } = emptyApp(prepared());
  const requests = m.apartadoRequests(creates);
  let id = 100;
  const responses = answer(requests, () => ok({ id: id++ }));
  const stage = m.abonoRequests(creates, { requests, responses });
  assert.equal(stage.createdApartados, 7);
  assert.equal(stage.requests.filter((r) => r.kind === 'abono').length, 3);
  const carmen = stage.requests.find((r) => r.reservation.cliente === 'Carmen Ruiz');
  assert.match(carmen.path, /^\/api\/apartados\/10\d\/abonos$/);
  assert.deepEqual(carmen.body, { importe: 20, forma_pago: 'efectivo', fecha: '2026-09-05' });
  assert.deepEqual(stage.held, []);
});

test('3 · stage 2 reports which initial abonos used the default payment method', () => {
  const { creates } = emptyApp(prepared());
  const requests = m.apartadoRequests(creates);
  const responses = answer(requests, () => ok({ id: 1 }));
  const { defaults } = m.abonoRequests(creates, { requests, responses });
  assert.equal(defaults.length, 5);
  assert.ok(defaults.every((label) => /\d{2}\/\d{2}\/2026 · .+ · .+ · \d+,\d{2} €/.test(label)));
});

test('3 · a 422 on an apartado holds it and its abonos, and the run goes on', () => {
  const { creates } = emptyApp(prepared());
  const requests = m.apartadoRequests(creates);
  const responses = answer(requests, (request) => (request.reservation?.cliente === 'Carmen Ruiz' ? rejected('El abono inicial mínimo es de 5 €') : ok({ id: 7 })));
  const stage = m.abonoRequests(creates, { requests, responses });
  assert.equal(stage.createdApartados, 6);
  assert.equal(stage.held.length, 2);
  assert.match(stage.held[0].motivo, /La app lo rechazó: El abono inicial mínimo es de 5 €/);
  assert.match(stage.held[1].motivo, /Depende del apartado de Carmen Ruiz/);
  assert.equal(stage.requests.filter((r) => r.kind === 'abono').length, 2);
});

test('3 · 401, 5xx and an unreachable app stop the run instead of becoming doubtful rows', () => {
  const { creates } = emptyApp(prepared());
  const requests = m.apartadoRequests(creates);
  for (const bad of [{ statusCode: 401, body: { detail: 'Falta la cabecera X-API-Key o no es válida' } }, { statusCode: 500, body: {} }, { error: { message: 'ECONNREFUSED' } }]) {
    const responses = answer(requests, () => bad);
    assert.throws(() => m.abonoRequests(creates, { requests, responses }), /app/);
  }
});

test('3 · a missing response stops the run (never pairs a request with the wrong answer)', () => {
  const { creates } = emptyApp(prepared());
  const requests = m.apartadoRequests(creates);
  assert.throws(() => m.abonoRequests(creates, { requests, responses: [ok({ id: 1 })] }), /una respuesta por cada petición/);
});

test('3 · an existing apartado with a missing abono gets its abono request on the known id', () => {
  const { reservations } = prepared();
  const carmen = reservations.find((r) => r.cliente === 'Carmen Ruiz');
  const existing = new Map([[carmen.key, { id: 9, abonos: [{ fecha: '2026-09-02', importe: 10 }] }]]);
  const { creates } = m.planCreates({ reservations: [carmen], sales: [], existing, appSales: [] });
  const requests = m.apartadoRequests(creates);
  assert.deepEqual(requests, []);
  const stage = m.abonoRequests(creates, { requests, responses: [] });
  assert.equal(stage.requests.length, 1);
  assert.equal(stage.requests[0].path, '/api/apartados/9/abonos');
  assert.equal(stage.createdApartados, 0);
});

test('3 · stage 3 counts created abonos, holds a rejected one with its reason, and lists defaults', () => {
  const { creates } = emptyApp(prepared());
  const apartados = m.apartadoRequests(creates);
  const stage = m.abonoRequests(creates, { requests: apartados, responses: answer(apartados, () => ok({ id: 5 })) });
  const responses = stage.requests.map((request, index) => (index === 0 ? rejected('El abono supera lo pendiente') : ok({})));
  const result = m.resolveAbonos({ requests: stage.requests, responses });
  assert.equal(result.created, 2);
  assert.equal(result.held.length, 1);
  assert.match(result.held[0].motivo, /La app lo rechazó: El abono supera lo pendiente/);
});

test('3 · validation errors from FastAPI (a list) become readable text', () => {
  assert.equal(m.detailOf({ body: { detail: [{ msg: 'field required' }, { msg: 'bad value' }] } }), 'field required; bad value');
  assert.equal(m.detailOf({ body: {} }), 'sin detalle');
});

test('3 · sales: one POST each plus the read; a 422 holds that sale only', () => {
  const { sales } = prepared();
  const requests = m.saleRequests(sales);
  assert.equal(requests.length, 6);
  assert.deepEqual(requests[0].body, { concepto: 'Calcetines pack 3', importe: 6.5, forma_pago: 'efectivo', fecha: '2026-10-01' });
  const responses = requests.map((request, index) => (index === 2 ? rejected('Importe no válido') : ok({ id: index })));
  const result = m.resolveSales({ requests, responses });
  assert.equal(result.created, 5);
  assert.equal(result.held.length, 1);
  assert.match(result.held[0].motivo, /Importe no válido/);
  assert.deepEqual(m.saleRequests([]), []);
});

test('3 · salesRange gives the first and last date, or null without sales', () => {
  assert.deepEqual(m.salesRange(prepared().sales), { desde: '2026-10-01', hasta: '2026-10-06' });
  assert.equal(m.salesRange([]), null);
});
