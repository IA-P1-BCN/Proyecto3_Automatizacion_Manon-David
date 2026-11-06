const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('./07-monthly-report');
const { reportPeriod, madridDate, reportDate, reportCalculate, reportResponse, reportCents, reportRender, reportShouldSend, reportRemember } = core;
const now = '2026-11-01T08:00:00Z';
const period = reportPeriod({ mode: 'scheduled' }, '2026-11-01');
function fixture() {
  const history = [
    { id: 1, apartado_id: 1, fecha: '2026-10-01', importe: 10, forma_pago: 'efectivo' },
    { id: 2, apartado_id: 2, fecha: '2026-09-05', importe: 10, forma_pago: 'tarjeta' },
    { id: 3, apartado_id: 2, fecha: '2026-10-31', importe: 5, forma_pago: 'bizum' },
    { id: 4, apartado_id: 3, fecha: '2026-06-01', importe: 20, forma_pago: 'efectivo' },
  ];
  return {
    sales: [{ id: 1, fecha: '2026-10-01', importe: 6.5, forma_pago: 'efectivo' }, { id: 2, fecha: '2026-10-31', importe: 20, forma_pago: 'tarjeta' }],
    deposits: history.filter(row => row.fecha.startsWith('2026-10')),
    reservations: [
      { id: 1, fecha: '2026-10-01', estado: 'activo', pendiente: 14 },
      { id: 2, fecha: '2026-09-05', estado: 'liquidado', pendiente: 0 },
      { id: 3, fecha: '2026-06-01', fecha_limite: '2026-08-30', estado: 'vencido', pendiente: 30 },
      { id: 4, fecha: '2026-09-01', estado: 'activo', pendiente: 40 },
    ],
    history,
    vouchers: [{ id: 1, apartado_id: 3, fecha: '2026-10-01', importe: 20 }],
  };
}

test('closed calendar months handle January rollover and leap/nonleap February', () => {
  assert.equal(reportPeriod({ mode: 'scheduled' }, '2027-01-01').month, '2026-12');
  assert.equal(reportPeriod({ mode: 'manual', month: '2028-02' }, '2028-03-01').hasta, '2028-02-29');
  assert.equal(reportPeriod({ mode: 'manual', month: '2027-02' }, '2027-03-01').hasta, '2027-02-28');
  assert.deepEqual([period.desde, period.hasta], ['2026-10-01', '2026-10-31']);
});
test('Madrid dates handle midnight and both DST transitions without changing API dates', () => {
  assert.equal(madridDate('2026-10-31T23:30:00Z'), '2026-11-01');
  assert.equal(madridDate('2026-03-29T00:59:00Z'), '2026-03-29');
  assert.equal(madridDate('2026-03-29T01:01:00Z'), '2026-03-29');
  assert.equal(madridDate('2026-10-25T00:59:00Z'), '2026-10-25');
  assert.equal(madridDate('2026-10-25T01:01:00Z'), '2026-10-25');
  assert.equal(reportPeriod({ mode: 'scheduled' }, madridDate('2026-03-31T22:30:00Z')).month, '2026-03');
});
test('invalid, current and future month/date values and wrong flag types fail', () => {
  for (const month of ['2026-11', '2027-01', '2026-13', '2026-2', '', null, '0000-01']) assert.throws(() => reportPeriod({ mode: 'manual', month }, '2026-11-01'));
  for (const date of ['2026-02-30', '2026-13-01', null, '2026-1-01']) assert.throws(() => reportDate(date));
  assert.throws(() => reportPeriod({ mode: 'wrong' }, '2026-11-01'));
  assert.throws(() => reportPeriod({ mode: 'manual', month: '2026-10', send_email: 'false' }, '2026-11-01'));
});
test('manual previews are safe by default and schedule selects previous month', () => {
  assert.equal(reportPeriod({ mode: 'manual', month: '2026-10' }, '2026-11-01').send_email, false);
  assert.equal(period.send_email, true);
  assert.equal(period.include_pdf, false);
});
test('starting the scheduled path from editor or CLI is blocked before reads or mail', () => {
  for (const input of [{ mode: 'scheduled' }, { mode: 'scheduled', scheduled_execution: false }, { mode: 'scheduled', scheduled_execution: 'true' }]) {
    assert.throws(() => core.reportGuardInput(input), /Inicio programado bloqueado/);
  }
  const automatic = { mode: 'scheduled', scheduled_execution: true };
  assert.equal(core.reportGuardInput(automatic), automatic);
  const manual = { mode: 'manual', send_email: false };
  assert.equal(core.reportGuardInput(manual), manual);
});
test('mixed report uses exact API figures, includes initial deposits once and excludes terminal debt', () => {
  const report = reportCalculate(period, fixture(), now);
  assert.deepEqual(report.totals, { ventas: 2650, abonos: 1500, total: 4150 });
  assert.deepEqual(report.counts, { nuevos: 1, liquidados: 1, vencidos: 1, activos_actuales: 2 });
  assert.equal(report.pending_cents, 5400);
  assert.equal(report.methods.efectivo.total, 1650);
  assert.equal(report.methods.tarjeta.total, 2000);
  assert.equal(report.methods.bizum.total, 500);
});
test('fully paid at creation counts as new and settled, one initial payment', () => {
  const source = fixture();
  source.reservations[0].estado = 'liquidado';
  source.reservations[0].pendiente = 0;
  const report = reportCalculate(period, source, now);
  assert.equal(report.counts.nuevos, 1);
  assert.equal(report.counts.liquidados, 2);
  assert.equal(report.totals.abonos, 1500);
});
test('imported September payment is not October settlement; latest date is independent of item order', () => {
  const source = fixture();
  source.history[2].fecha = '2026-09-25';
  source.deposits = source.history.filter(row => row.fecha.startsWith('2026-10'));
  source.history.reverse();
  assert.equal(reportCalculate(period, source, now).counts.liquidados, 0);
});
test('expiry uses voucher date, not deadline, including month boundary', () => {
  const source = fixture();
  source.reservations[2].fecha_limite = '2026-09-30';
  assert.equal(reportCalculate(period, source, now).counts.vencidos, 1);
  source.vouchers[0].fecha = '2026-09-30';
  assert.equal(reportCalculate(period, source, now).counts.vencidos, 0);
});
test('empty month and all-empty app produce zero collections without dropping current active debt', () => {
  const source = fixture();
  source.sales = [];
  source.deposits = [];
  source.history.forEach(row => { if (row.fecha.startsWith('2026-10')) row.fecha = '2026-09-30'; });
  source.reservations[0].fecha = '2026-09-01';
  const report = reportCalculate(period, source, now);
  assert.equal(report.totals.total, 0);
  assert.equal(report.pending_cents, 5400);
  assert.match(reportRender(report).html, /No hubo movimientos/);
  assert.equal(reportCalculate(period, { sales: [], deposits: [], reservations: [], history: [], vouchers: [] }, now).totals.total, 0);
});
test('cent arithmetic, unknown methods and safe amount ranges', () => {
  const source = fixture();
  source.sales = [{ id: 1, fecha: '2026-10-01', importe: 0.1, forma_pago: 'nuevo' }, { id: 2, fecha: '2026-10-31', importe: 0.2, forma_pago: 'nuevo' }];
  assert.equal(reportCalculate(period, source, now).methods.otros.ventas, 30);
  for (const value of [NaN, Infinity, -1, '0.001', '', null, true, Number.MAX_SAFE_INTEGER]) assert.throws(() => reportCents(value));
  assert.throws(() => core.reportAdd(Number.MAX_SAFE_INTEGER, 1));
});
test('duplicates, malformed data, absent relationships and incomplete monthly history fail', () => {
  const changes = [
    s => s.sales.push({ ...s.sales[0] }), s => { s.sales[0].fecha = '2026-11-01'; },
    s => { s.sales = null; }, s => { s.sales[0].forma_pago = ''; },
    s => { s.sales[0].importe = -1; }, s => s.reservations.push({ ...s.reservations[0] }),
    s => { s.reservations[0].estado = 'unknown'; }, s => { s.reservations[0].pendiente = null; },
    s => { s.vouchers = []; }, s => s.vouchers.push({ ...s.vouchers[0], id: 2 }),
    s => { s.history = s.history.filter(row => row.apartado_id !== 2); },
    s => { s.history[0].apartado_id = 999; }, s => { s.deposits = []; },
    s => { s.deposits = s.deposits.map(row => ({ ...row, importe: row.importe + 1 })); },
  ];
  for (const change of changes) { const source = fixture(); change(source); assert.throws(() => reportCalculate(period, source, now)); }
});
test('complete API envelopes retain empty arrays and reject HTTP failures/truncation', () => {
  assert.deepEqual(reportResponse({ statusCode: 200, body: [], headers: { 'x-total-count': '0' } }, 'ventas', true), []);
  for (const response of [{ statusCode: 401, body: [] }, { statusCode: 200, body: {} }, { statusCode: 200, body: [], headers: { 'X-Total-Count': '1' } }, { statusCode: 200, body: [] }]) assert.throws(() => reportResponse(response, 'ventas', true));
  const rows = Array.from({ length: 70 }, (_, i) => ({ id: i + 1, fecha: '2026-10-01' }));
  assert.equal(reportResponse({ statusCode: 200, body: rows, headers: { 'x-total-count': '70' } }, 'ventas', true).length, 70);
});
test('Spanish HTML states accounting/current debt limits, escapes text and supports PDF warning', () => {
  const report = reportCalculate(period, fixture(), now);
  const rendered = reportRender(report);
  for (const text of ['41,50', '54,00', 'octubre de 2026', 'no beneficios', 'no el saldo histórico', 'no guarda una fecha específica', 'Bizum incluye transferencias']) assert.ok(rendered.html.includes(text), text);
  assert.equal(core.reportEscape('<script>"&'), '&lt;script&gt;&quot;&amp;');
  assert.ok(!rendered.html.includes('undefined'));
  assert.match(reportRender(report, true).html, /no se ha podido generar el PDF/);
});
test('normal scheduled success suppresses duplicates, explicit manual resend remains possible', () => {
  const state = {};
  assert.equal(reportShouldSend(period, state), true);
  reportRemember(state, period, 'synthetic-confirmed-message-id');
  assert.equal(reportShouldSend(period, state), false);
  assert.equal(reportShouldSend({ ...period, mode: 'manual' }, state), true);
  assert.equal(reportShouldSend({ ...period, mode: 'manual', send_email: false }, state), false);
  assert.throws(() => reportRemember({}, period, ''));
  const manualState = {};
  reportRemember(manualState, { ...period, mode: 'manual' }, 'manual-message');
  assert.deepEqual(manualState, {});
});

module.exports = { fixture, period, now };
