const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const m = require('./10-excel-migration.js');

const readCsv = (name) => m.parseCsv(fs.readFileSync(path.join(__dirname, '..', '..', 'data', name), 'utf8'));
const apartadosCsv = () => readCsv('excel_actual_apartados.csv');
const ventasCsv = () => readCsv('excel_actual_ventas.csv');

const apartadoRow = (overrides = {}) => ({
  fecha: '02/09/2026', cliente: 'Carmen Ruiz', telefono: '612 345 001', modelo: 'Botín piel marrón', talla: '38', precio: '89.90', abono: '10', resta: '79.90', notas: '', ...overrides,
});
const ventaRow = (overrides = {}) => ({ fecha: '01/10/2026', concepto: 'Calcetines pack 3', importe: '6.50', forma_pago: 'efectivo', ...overrides });

// ---- 2.1 clean ----

test('2.1 · formats are cleaned silently: 2-digit year, lower-case name, 15€, phone without spaces', () => {
  const { rows, held } = m.cleanApartados([apartadoRow({ fecha: '7/9/26', cliente: 'carmen  ruiz', telefono: '612345002', abono: '15€' })]);
  assert.deepEqual(held, []);
  assert.equal(rows[0].fecha, '2026-09-07');
  assert.equal(rows[0].cliente, 'Carmen Ruiz');
  assert.equal(rows[0].telefono, '612 345 002');
  assert.equal(rows[0].importe, 15);
});

test('2.1 · a missing phone is loaded as an empty phone, not held', () => {
  const { rows, held } = m.cleanApartados([apartadoRow({ telefono: '' })]);
  assert.equal(held.length, 0);
  assert.equal(rows[0].telefono, '');
});

test('2.1 · unreadable values are held with a reason and never guessed', () => {
  const bad = [
    apartadoRow({ fecha: '' }), apartadoRow({ fecha: '31/02/2026' }), apartadoRow({ cliente: '  ' }),
    apartadoRow({ abono: 'diez' }), apartadoRow({ precio: '' }), apartadoRow({ modelo: '' }),
  ];
  const { rows, held } = m.cleanApartados(bad);
  assert.equal(rows.length, 0);
  assert.equal(held.length, 6);
  assert.deepEqual(held.map((entry) => entry.linea), [2, 3, 4, 5, 6, 7]);
  assert.ok(held.every((entry) => entry.motivo.length > 10));
});

test('2.1 · amounts: comma and point decimals, thousands separators, €, and unreadable values', () => {
  assert.equal(m.parseAmount('89.90'), 89.9);
  assert.equal(m.parseAmount('64,5'), 64.5);
  assert.equal(m.parseAmount('1.842,30'), 1842.3);
  assert.equal(m.parseAmount('15 €'), 15);
  assert.equal(m.parseAmount(45), 45);
  assert.equal(m.parseAmount('0'), null);
  assert.equal(m.parseAmount('-3'), null);
  assert.equal(m.parseAmount('1,234'), null);
  assert.equal(m.parseAmount(''), null);
});

test('2.1 · dates are day first, accept ISO, and reject impossible days', () => {
  assert.equal(m.parseDate('02/09/2026'), '2026-09-02');
  assert.equal(m.parseDate('7/9/26'), '2026-09-07');
  assert.equal(m.parseDate('2026-10-01'), '2026-10-01');
  assert.equal(m.parseDate('29/02/2028'), '2028-02-29');
  assert.equal(m.parseDate('29/02/2026'), null);
  assert.equal(m.parseDate('13/13/2026'), null);
  assert.equal(m.parseDate('hoy'), null);
});

test('2.1 · a wrong or empty header throws before anything is read', () => {
  assert.throws(() => m.cleanApartados([{ fecha: '1/1/26', cliente: 'A' }]), /faltan las columnas: telefono, modelo/);
  assert.throws(() => m.cleanVentas([]), /vacía/);
});

test('2.1 · a BOM on the first header column does not hide the column', () => {
  const rows = [{ '﻿fecha': '01/10/2026', concepto: 'Plantillas gel', importe: '12', forma_pago: 'tarjeta' }];
  assert.equal(m.cleanVentas(rows).rows[0].importe, 12);
});

test('2.1 · sales: an unknown payment method is held; the typed total line is dropped and counted', () => {
  const { rows, held, totalLines } = m.cleanVentas([ventaRow({ forma_pago: 'cheque' }), ventaRow(), { fecha: 'TOTAL SEPTIEMBRE (a mano)', concepto: '', importe: '1.842,30', forma_pago: '' }]);
  assert.equal(rows.length, 1);
  assert.equal(held.length, 1);
  assert.equal(totalLines, 1);
});

// ---- 2.2 group and classify ----

test('2.2 · the real sample files give the expected counts', () => {
  const result = m.prepareMigration(apartadosCsv(), ventasCsv());
  assert.equal(result.reservations.length, 7);
  assert.equal(result.reservations.flatMap((r) => r.items.slice(1)).length, 3);
  assert.equal(result.sales.length, 6);
  assert.equal(result.repeatedSales, 3);
  assert.equal(result.totalLines, 1);
  assert.equal(result.held.length, 2);
  assert.deepEqual(result.held.map((entry) => [entry.hoja, entry.linea]), [['apartados', 4], ['apartados', 10]]);
});

test('2.2 · first row of a customer and product is the apartado; carmen ruiz in lower case joins Carmen Ruiz', () => {
  const { reservations } = m.prepareMigration(apartadosCsv(), ventasCsv());
  const carmen = reservations.find((r) => r.cliente === 'Carmen Ruiz');
  assert.deepEqual(carmen.items.map((i) => [i.kind, i.fecha, i.importe]), [['inicial', '2026-09-02', 10], ['abono', '2026-09-05', 20]]);
  assert.equal(carmen.fecha, '2026-09-02');
  assert.equal(carmen.precio, 89.9);
});

test('2.2 · payment method comes from the matching sales line, else efectivo and flagged as default', () => {
  const { reservations } = m.prepareMigration(apartadosCsv(), ventasCsv());
  const method = (name, index) => reservations.find((r) => r.cliente === name).items[index];
  assert.equal(method('Sofía Navarro', 0).forma_pago, 'bizum');
  assert.equal(method('Sofía Navarro', 0).defaulted, false);
  assert.equal(method('Miguel Ángel López', 0).forma_pago, 'efectivo');
  assert.equal(method('Miguel Ángel López', 0).defaulted, false);
  assert.equal(method('Ana Torres', 1).defaulted, false);
  assert.equal(method('Pedro Sanz', 0).forma_pago, 'efectivo');
  assert.equal(method('Pedro Sanz', 0).defaulted, true);
});

test('2.2 · an ordinary sale with the amount and date of a deposit is still a sale', () => {
  const apartados = m.cleanApartados([apartadoRow({ fecha: '01/10/2026', abono: '6.50' })]).rows;
  const sales = m.cleanVentas([ventaRow()]).rows;
  const result = m.classifyVentas(sales, apartados);
  assert.equal(result.sales.length, 1);
  assert.equal(result.repeated.length, 0);
});

test('2.2 · a deposit-looking sales line with no matching deposit is held for Marisa, not loaded', () => {
  const apartados = m.cleanApartados([apartadoRow()]).rows;
  const sales = m.cleanVentas([ventaRow({ concepto: 'Abono Rosa mocasin', importe: '20' })]).rows;
  const result = m.classifyVentas(sales, apartados);
  assert.equal(result.sales.length, 0);
  assert.equal(result.held.length, 1);
  assert.match(result.held[0].motivo, /ningún abono/);
});

test('2.2 · one deposit is repeated by one sales line only; the second identical line is held', () => {
  const apartados = m.cleanApartados([apartadoRow({ fecha: '01/10/2026', abono: '5' })]).rows;
  const sales = m.cleanVentas([ventaRow({ concepto: 'Abono inicial A', importe: '5' }), ventaRow({ concepto: 'Abono inicial A', importe: '5' })]).rows;
  const result = m.classifyVentas(sales, apartados);
  assert.equal(result.repeated.length, 1);
  assert.equal(result.held.length, 1);
});

test('2.2 · a later row with another price is held', () => {
  const rows = m.cleanApartados([apartadoRow(), apartadoRow({ fecha: '05/09/2026', precio: '99', abono: '10' })]).rows;
  const { reservations, held } = m.groupReservations(rows, new Map());
  assert.equal(reservations[0].items.length, 1);
  assert.equal(held.length, 1);
  assert.match(held[0].motivo, /precio/);
});

test('2.2 · the same customer with two different products makes two reservations', () => {
  const rows = m.cleanApartados([apartadoRow(), apartadoRow({ modelo: 'Sandalia', talla: '37' })]).rows;
  assert.equal(m.groupReservations(rows, new Map()).reservations.length, 2);
});

test('2.2 · rows out of file order are still opened by the earliest date', () => {
  const rows = m.cleanApartados([apartadoRow({ fecha: '05/09/2026', abono: '20' }), apartadoRow({ fecha: '02/09/2026', abono: '10' })]).rows;
  const [reservation] = m.groupReservations(rows, new Map()).reservations;
  assert.deepEqual(reservation.items.map((i) => i.kind), ['inicial', 'abono']);
  assert.equal(reservation.fecha, '2026-09-02');
});

// ---- 2.3 rules ----

const reservationOf = (initial, ...later) => {
  const rows = m.cleanApartados([apartadoRow({ abono: String(initial) }), ...later.map((amount, index) => apartadoRow({ fecha: `0${index + 3}/09/2026`, abono: String(amount) }))]).rows;
  return m.groupReservations(rows, new Map()).reservations;
};

test('2.3 · the minimum initial abono is the app\'s 5 € (pinned)', () => {
  assert.equal(m.MIN_ABONO_INICIAL, 5);
});

test('2.3 · 4 € is held, 5 € is accepted', () => {
  assert.equal(m.applyRules(reservationOf(4)).held.length, 1);
  const ok = m.applyRules(reservationOf(5));
  assert.equal(ok.held.length, 0);
  assert.equal(ok.reservations.length, 1);
});

test('2.3 · an abono equal to the balance is accepted; one cent more is held', () => {
  assert.equal(m.applyRules(reservationOf(10, 79.9)).held.length, 0);
  const over = m.applyRules(reservationOf(10, 79.91));
  assert.equal(over.held.length, 1);
  assert.equal(over.reservations[0].items.length, 1);
});

test('2.3 · a held apartado holds all its later abonos, each with the reason', () => {
  const { held, reservations } = m.applyRules(reservationOf(4, 20, 30));
  assert.equal(reservations.length, 0);
  assert.equal(held.length, 3);
  assert.match(held[0].motivo, /menor de 5,00 €/);
  assert.match(held[1].motivo, /Depende del apartado/);
  assert.match(held[2].motivo, /Depende del apartado/);
});

test('2.3 · an initial abono above the price is held', () => {
  assert.equal(m.applyRules(reservationOf(90)).held.length, 1);
});

test('2.3 · the rules never read pendiente or abonado from the app', () => {
  const source = fs.readFileSync(path.join(__dirname, '10-excel-migration.js'), 'utf8');
  assert.equal(/\.pendiente|\.abonado/.test(source), false);
});

// ---- 2.4 plan ----

const prepared = () => m.prepareMigration(apartadosCsv(), ventasCsv());
const noApp = () => ({ existing: new Map(), appSales: [] });

test('2.4 · on an empty app every accepted row is a create', () => {
  const { reservations, sales } = prepared();
  const plan = m.planCreates({ reservations, sales, ...noApp() });
  assert.equal(plan.creates.length, 7);
  assert.ok(plan.creates.every((c) => c.type === 'apartado'));
  assert.equal(plan.sales.length, 6);
  assert.deepEqual(plan.skipped, { apartados: 0, abonos: 0, ventas: 0 });
});

test('2.4 · a second run creates nothing', () => {
  const { reservations, sales } = prepared();
  const existing = new Map(reservations.map((r, i) => [r.key, { id: i + 1, abonos: r.items.map((item) => ({ fecha: item.fecha, importe: item.importe })) }]));
  const appSales = sales.map((s) => ({ fecha: s.fecha, concepto: s.concepto, importe: s.importe }));
  const plan = m.planCreates({ reservations, sales, existing, appSales });
  assert.equal(plan.creates.length, 0);
  assert.equal(plan.sales.length, 0);
  assert.deepEqual(plan.skipped, { apartados: 7, abonos: 10, ventas: 6 });
});

test('2.4 · an apartado already there with one abono missing creates only that abono', () => {
  const { reservations } = prepared();
  const carmen = reservations.find((r) => r.cliente === 'Carmen Ruiz');
  const existing = new Map([[carmen.key, { id: 9, abonos: [{ fecha: '2026-09-02', importe: 10 }] }]]);
  const plan = m.planCreates({ reservations: [carmen], sales: [], existing, appSales: [] });
  assert.equal(plan.creates.length, 1);
  assert.equal(plan.creates[0].type, 'abonos');
  assert.equal(plan.creates[0].apartadoId, 9);
  assert.deepEqual(plan.creates[0].items.map((i) => [i.fecha, i.importe]), [['2026-09-05', 20]]);
  assert.deepEqual(plan.skipped, { apartados: 1, abonos: 1, ventas: 0 });
});

test('2.4 · two identical abonos in the CSV and one in the app create exactly one more', () => {
  const rows = m.cleanApartados([apartadoRow(), apartadoRow({ fecha: '05/09/2026', abono: '5' }), apartadoRow({ fecha: '05/09/2026', abono: '5' })]).rows;
  const [reservation] = m.groupReservations(rows, new Map()).reservations;
  const existing = new Map([[reservation.key, { id: 4, abonos: [{ fecha: '2026-09-02', importe: 10 }, { fecha: '2026-09-05', importe: 5 }] }]]);
  const plan = m.planCreates({ reservations: [reservation], sales: [], existing, appSales: [] });
  assert.equal(plan.creates[0].items.length, 1);
  assert.equal(plan.skipped.abonos, 2);
});

test('2.4 · two identical sales in the CSV and one in the app create one more', () => {
  const sales = m.cleanVentas([ventaRow(), ventaRow()]).rows;
  const plan = m.planCreates({ reservations: [], sales, existing: new Map(), appSales: [{ fecha: '2026-10-01', concepto: 'calcetines PACK 3', importe: 6.5 }] });
  assert.equal(plan.sales.length, 1);
  assert.equal(plan.skipped.ventas, 1);
});

test('2.4 · findExisting matches by customer, product, date and price; another price is not the same apartado', () => {
  const { reservations } = prepared();
  const carmen = reservations.find((r) => r.cliente === 'Carmen Ruiz');
  const app = [
    { id: 3, cliente: 'CARMEN RUIZ', producto: 'botin piel marron', fecha: '2026-09-02', precio: 89.9 },
    { id: 4, cliente: 'Carmen Ruiz', producto: 'Botín piel marrón', fecha: '2026-09-02', precio: 99 },
  ];
  assert.equal(m.findExisting([carmen], app)[0].existingId, 3);
  assert.equal(m.findExisting([carmen], [app[1]])[0].existingId, null);
});

test('2.4 · two CSV reservations never claim the same app apartado', () => {
  const rows = m.cleanApartados([apartadoRow(), apartadoRow({ talla: '39' })]).rows;
  const { reservations } = m.groupReservations(rows, new Map());
  const app = [{ id: 3, cliente: 'Carmen Ruiz', producto: 'Botín piel marrón', fecha: '2026-09-02', precio: 89.9 }];
  const ids = m.findExisting(reservations, app).map((e) => e.existingId);
  assert.deepEqual(ids.filter((id) => id !== null), [3]);
});

test('2.4 · request bodies carry the original fecha and leave out empty phone and size', () => {
  const rows = m.cleanApartados([apartadoRow({ telefono: '', talla: '' })]).rows;
  const [reservation] = m.groupReservations(rows, new Map()).reservations;
  assert.deepEqual(m.apartadoBody(reservation), { cliente: 'Carmen Ruiz', producto: 'Botín piel marrón', precio: 89.9, abono_inicial: 10, forma_pago: 'efectivo', fecha: '2026-09-02' });
  assert.deepEqual(m.abonoBody({ importe: 20, forma_pago: 'bizum', fecha: '2026-09-05' }), { importe: 20, forma_pago: 'bizum', fecha: '2026-09-05' });
  assert.deepEqual(m.ventaBody({ concepto: 'Crema', importe: 4.5, forma_pago: 'efectivo', fecha: '2026-10-06', line: 9 }), { concepto: 'Crema', importe: 4.5, forma_pago: 'efectivo', fecha: '2026-10-06' });
});

test('2.4 · a 422 on the initial abono holds the rest of the reservation; on a later abono only that one', () => {
  const [reservation] = reservationOf(10, 20, 30);
  assert.equal(m.rejectionHolds(reservation, reservation.items[0], 'El abono inicial mínimo es de 5 €').length, 3);
  const later = m.rejectionHolds(reservation, reservation.items[1], 'El abono supera lo pendiente');
  assert.equal(later.length, 1);
  assert.match(later[0].motivo, /La app lo rechazó: El abono supera lo pendiente/);
});

// ---- 2.5 report ----

const emptyOutcome = { created: { apartados: 0, abonos: 0, ventas: 0 }, skipped: { apartados: 0, abonos: 0, ventas: 0 }, held: [], defaults: [], flagError: false };

test('2.5 · report: counts, held table with reasons and defaults, in Spanish', () => {
  const { subject, body } = m.buildReport({
    ...emptyOutcome,
    created: { apartados: 7, abonos: 3, ventas: 6 },
    held: [{ hoja: 'apartados', linea: 4, resumen: '03/09/2026 · Lucía Gómez · Sandalia tacón negra', motivo: 'El abono inicial (4,00 €) es menor de 5,00 €.' }],
    defaults: ['02/09/2026 · Carmen Ruiz · Botín piel marrón · 10,00 €'],
  });
  assert.equal(subject, 'Migración del Excel: 7 apartados, 3 abonos, 6 ventas · 1 para revisar');
  assert.match(body, /apartados: 7/);
  assert.match(body, /Hoja de apartados, línea 4 \(03\/09\/2026 · Lucía Gómez · Sandalia tacón negra\): El abono inicial \(4,00 €\) es menor de 5,00 €\./);
  assert.match(body, /por defecto|porque el Excel no la indicaba \(1\)/);
  assert.match(body, /Carmen Ruiz · Botín piel marrón · 10,00 €/);
});

test('2.5 · report: empty parts still appear, and a second run says everything was already there', () => {
  const { body } = m.buildReport({ ...emptyOutcome, skipped: { apartados: 7, abonos: 10, ventas: 6 } });
  assert.match(body, /Filas que necesitan tu decisión: ninguna\./);
  assert.match(body, /forma de pago «efectivo» por defecto: ninguno\./);
  assert.match(body, /Ya estaba cargado[\s\S]*apartados: 7[\s\S]*abonos: 10[\s\S]*ventas: 6/);
});

test('2.5 · report: warns when the migration flag could not be turned off', () => {
  assert.match(m.buildReport({ ...emptyOutcome, flagError: true }).body, /no se pudo desactivar el aviso de migración/);
  assert.doesNotMatch(m.buildReport(emptyOutcome).body, /ATENCIÓN/);
});

test('2.5 · report: amounts are formatted from the given numbers only', () => {
  const label = m.defaultedLabel({ cliente: 'Ana Torres', producto: 'Mocasín ante' }, { fecha: '2026-09-07', importe: 15 });
  assert.equal(label, '07/09/2026 · Ana Torres · Mocasín ante · 15,00 €');
});
