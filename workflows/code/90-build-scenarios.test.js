const test = require('node:test');
const assert = require('node:assert/strict');
const { subtractDays, buildScenarios, dropExisting, planDeposits, summarize } = require('./90-build-scenarios.js');

const EMAIL = 'avisos@example.test';
const TODAY = '2026-10-25';

test('1 · five scenarios, all with the (demo) suffix and unique names', () => {
  const scenarios = buildScenarios(EMAIL, TODAY);
  assert.equal(scenarios.length, 5);
  const names = scenarios.map(({ reserva }) => reserva.cliente);
  assert.ok(names.every((name) => name.endsWith(' (demo)')));
  assert.equal(new Set(names).size, 5);
});

test('2 · customers with email use the alert address; Pablo Ríos has none', () => {
  const scenarios = buildScenarios(EMAIL, TODAY);
  const withoutEmail = scenarios.filter(({ reserva }) => !reserva.email);
  assert.deepEqual(withoutEmail.map(({ reserva }) => reserva.cliente), ['Pablo Ríos (demo)']);
  scenarios.filter(({ reserva }) => reserva.email).forEach(({ reserva }) => assert.equal(reserva.email, EMAIL));
});

test('3 · only the overdue case sends `fecha`, 100 days before today', () => {
  const scenarios = buildScenarios(EMAIL, TODAY);
  const withDate = scenarios.filter(({ reserva }) => reserva.fecha);
  assert.equal(withDate.length, 1);
  assert.equal(withDate[0].reserva.cliente, 'Irene Mora (demo)');
  assert.equal(withDate[0].reserva.fecha, '2026-07-17');
});

test('4 · amounts follow the design table and nothing derived is sent', () => {
  const [lucia, marcos, elena, pablo, irene] = buildScenarios(EMAIL, TODAY);
  assert.deepEqual([lucia.reserva.precio, lucia.reserva.abono_inicial, lucia.abonos.map((a) => a.importe)], [89.9, 10, [20]]);
  assert.deepEqual([marcos.reserva.precio, marcos.reserva.abono_inicial, marcos.abonos.map((a) => a.importe)], [45, 10, [35]]);
  assert.equal(marcos.reserva.talla, undefined);
  assert.equal(elena.reserva.precio, elena.reserva.abono_inicial);
  assert.deepEqual([pablo.abonos, elena.abonos, irene.abonos], [[], [], []]);
  buildScenarios(EMAIL, TODAY).forEach(({ reserva }) => {
    ['abonado', 'pendiente', 'fecha_limite', 'estado'].forEach((field) => assert.equal(reserva[field], undefined));
  });
});

test('5 · a missing or invalid alert address stops the flow', () => {
  assert.throws(() => buildScenarios('', TODAY), /TIENDA_EMAIL_AVISOS/);
  assert.throws(() => buildScenarios(undefined, TODAY), /TIENDA_EMAIL_AVISOS/);
});

test('6 · subtractDays crosses month and year ends', () => {
  assert.equal(subtractDays('2026-03-01', 1), '2026-02-28');
  assert.equal(subtractDays('2027-01-10', 100), '2026-10-02');
  assert.throws(() => subtractDays('hoy', 1), /no válida/);
});

test('7 · dropExisting: clean app keeps five, two existing names keep three', () => {
  const scenarios = buildScenarios(EMAIL, TODAY);
  assert.equal(dropExisting(scenarios, []).length, 5);
  const existing = [{ cliente: 'Lucía Prado (demo)' }, { cliente: 'Irene Mora (demo)' }, { cliente: 'Carmen Ruiz' }];
  assert.deepEqual(
    dropExisting(scenarios, existing).map(({ reserva }) => reserva.cliente),
    ['Marcos Vidal (demo)', 'Elena Soto (demo)', 'Pablo Ríos (demo)'],
  );
});

test('8 · dropExisting ignores the empty placeholder item of an empty list', () => {
  assert.equal(dropExisting(buildScenarios(EMAIL, TODAY), [{}]).length, 5);
});

test('9 · planDeposits only emits deposits for scenarios 1 and 2, with the id the app returned', () => {
  const scenarios = buildScenarios(EMAIL, TODAY);
  const created = scenarios.map(({ reserva }, index) => ({ id: 100 + index, cliente: reserva.cliente }));
  assert.deepEqual(planDeposits(scenarios, created), [
    { apartado_id: 100, cliente: 'Lucía Prado (demo)', importe: 20, forma_pago: 'efectivo' },
    { apartado_id: 101, cliente: 'Marcos Vidal (demo)', importe: 35, forma_pago: 'tarjeta' },
  ]);
});

test('10 · planDeposits fails if the app answers do not match what was sent', () => {
  const scenarios = buildScenarios(EMAIL, TODAY).slice(0, 2);
  assert.throws(() => planDeposits(scenarios, [{ id: 1, cliente: 'Lucía Prado (demo)' }]), /se esperaban 2/);
  assert.throws(
    () => planDeposits(scenarios, [{ id: 1, cliente: 'Otra' }, { id: 2, cliente: 'Marcos Vidal (demo)' }]),
    /inesperado/,
  );
});

test('11 · summarize: first run and second run', () => {
  const first = summarize(5, [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }], [{}, {}]);
  assert.deepEqual([first.creados, first.omitidos, first.abonos_registrados, first.ids], [5, 0, 2, [1, 2, 3, 4, 5]]);
  const second = summarize(5, [], []);
  assert.deepEqual([second.creados, second.omitidos], [0, 5]);
  assert.match(second.resultado, /ya existen/);
});
