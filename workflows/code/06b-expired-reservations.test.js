const test = require('node:test');
const assert = require('node:assert/strict');
const {
  runInput, selectExpired, collectExpiries, planNotifications, buildSummary, verifyResult,
} = require('./06b-expired-reservations.js');

const TODAY = '2026-10-20';
const SHOP = 'tienda@example.com';
const reservation = (overrides = {}) => ({
  id: 16, fecha: '2026-07-22', cliente: 'Paula Ramos', telefono: '612 345 016', email: 'paula@example.com',
  producto: 'Zapatilla running azul', talla: '40', precio: 64.5, abonado: 5.0, pendiente: 59.5,
  fecha_limite: '2026-10-19', estado: 'activo', ...overrides,
});
const expiredOf = (overrides = {}, voucher = {}) => ({
  apartado: reservation({ estado: 'vencido', ...overrides }),
  vale: { id: 2, codigo: 'VALE-00016', apartado_id: 16, fecha: TODAY, importe: 5.0, usado: 0, ...voucher },
});
const select = (reservations) => selectExpired({ reservations, today: TODAY });

test('1 · deadline yesterday is selected, deadline today and tomorrow are not', () => {
  const list = [
    reservation({ id: 1, fecha_limite: '2026-10-19' }),
    reservation({ id: 2, fecha_limite: '2026-10-20' }),
    reservation({ id: 3, fecha_limite: '2026-10-21' }),
  ];
  assert.deepEqual(select(list), [{ id: 1 }]);
});

test('2 · only active reservations are selected', () => {
  const list = [
    reservation({ id: 1, estado: 'liquidado' }),
    reservation({ id: 2, estado: 'vencido' }),
    reservation({ id: 3 }),
  ];
  assert.deepEqual(select(list), [{ id: 3 }]);
});

test('3 · an empty list selects nothing and a non-list fails', () => {
  assert.deepEqual(select([]), []);
  assert.throws(() => select({ detail: 'x' }), /lista/);
});

test('4 · month, year and leap-day boundaries compare as dates', () => {
  const at = (today, limit) => selectExpired({ today, reservations: [reservation({ fecha_limite: limit })] }).length;
  assert.equal(at('2027-01-01', '2026-12-31'), 1);
  assert.equal(at('2026-12-31', '2027-01-01'), 0);
  assert.equal(at('2028-03-01', '2028-02-29'), 1);
  assert.equal(at('2028-02-29', '2028-02-29'), 0);
});

test('5 · invalid run date, invalid deadline and missing id fail', () => {
  assert.throws(() => selectExpired({ today: '2026-13-01', reservations: [] }), /fecha válida/);
  assert.throws(() => select([reservation({ fecha_limite: 'mañana' })]), /fecha válida/);
  assert.throws(() => select([reservation({ id: 'x' })]), /sin número/);
});

test('6 · selection never reads pendiente or abonado', () => {
  const list = [reservation({ pendiente: undefined, abonado: undefined })];
  assert.deepEqual(select(list), [{ id: 16 }]);
});

test('7 · run input: scheduled uses today, manual needs a valid date, other modes fail', () => {
  assert.deepEqual(runInput({ mode: 'scheduled' }, TODAY), { fecha: TODAY, mode: 'scheduled' });
  assert.deepEqual(runInput({ mode: 'manual', fecha: '2026-10-01' }, TODAY), { fecha: '2026-10-01', mode: 'manual' });
  assert.throws(() => runInput({ mode: 'manual', fecha: '' }, TODAY), /fecha válida/);
  assert.throws(() => runInput({ mode: 'other' }, TODAY), /Modo/);
});

test('8 · a vencido response with its voucher is an expiry, anything else a failure', () => {
  const selected = [{ id: 16 }, { id: 17 }, { id: 18 }, { id: 19 }];
  const results = [
    expiredOf(),
    { error: 'The service was not able to process your request' },
    { apartado: reservation({ id: 18, estado: 'activo' }), vale: null },
    { apartado: reservation({ id: 99, estado: 'vencido' }), vale: { codigo: 'VALE-00099', importe: 1 } },
  ];
  const { expired, failures } = collectExpiries(selected, results);
  assert.equal(expired.length, 1);
  assert.deepEqual(failures, [{ id: 17 }, { id: 18 }, { id: 19 }]);
});

test('9 · a different number of responses than reservations fails', () => {
  assert.throws(() => collectExpiries([{ id: 1 }], []), /no coincide/);
});

test('10 · the customer email shows the voucher code and amount as the app sent them', () => {
  const { planned } = planNotifications({ expired: [expiredOf()], failures: [] });
  const [item] = planned;
  assert.equal(item.send, true);
  assert.equal(item.to, 'paula@example.com');
  assert.equal(item.subject, 'Tu apartado ha vencido: aquí tienes tu vale · Zapatilla running azul');
  assert.match(item.body, /Hola Paula Ramos,/);
  assert.match(item.body, /«Zapatilla running azul» \(talla 40\)/);
  assert.match(item.body, /terminó el 19\/10\/2026/);
  assert.match(item.body, /Código del vale: VALE-00016/);
  assert.match(item.body, /Importe del vale: 5,00 €/);
  assert.match(item.body, /no se devuelve en dinero/);
});

test('11 · no size line when the reservation has no size', () => {
  const { planned } = planNotifications({ expired: [expiredOf({ talla: null })], failures: [] });
  assert.match(planned[0].body, /de «Zapatilla running azul» terminó/);
  assert.doesNotMatch(planned[0].body, /talla/);
});

test('12 · empty or malformed email means no customer email', () => {
  for (const email of ['', null, undefined, 'sin-arroba', '   ']) {
    const { planned } = planNotifications({ expired: [expiredOf({ email })], failures: [] });
    assert.equal(planned[0].send, false, `email ${JSON.stringify(email)}`);
    assert.equal(planned[0].to, '');
  }
});

const sentOk = { success: true };
const sentBounced = { error: 'Recipient rejected' };
const plan = (...expired) => planNotifications({ expired, failures: [] }).planned;

test('13 · the summary lists the shoes back on sale in one email, with comma decimals', () => {
  const planned = plan(expiredOf(), expiredOf({ id: 17, cliente: 'Luis Gil', producto: 'Mocasín negro', talla: '' }, { codigo: 'VALE-00017', importe: 12.5 }));
  const summary = buildSummary({ planned, sendResults: [sentOk, sentOk], today: TODAY, shopAddress: SHOP });
  assert.equal(summary.to, SHOP);
  assert.equal(summary.subject, 'Apartados vencidos el 20/10/2026: 2 vuelven a la venta');
  assert.match(summary.body, /zapatos vuelven a la venta/);
  assert.match(summary.body, /«Zapatilla running azul» \(talla 40\) · apartado nº 16 · Paula Ramos · vale VALE-00016 \(5,00 €\)/);
  assert.match(summary.body, /«Mocasín negro» · apartado nº 17 · Luis Gil · vale VALE-00017 \(12,50 €\)/);
  assert.doesNotMatch(summary.body, /avisar a mano/);
  assert.deepEqual(summary.bounced, []);
});

test('14 · a customer without email appears under "avisar a mano" with the voucher code and phone', () => {
  const planned = plan(expiredOf({ email: '' }));
  const summary = buildSummary({ planned, sendResults: [], today: TODAY, shopAddress: SHOP });
  assert.match(summary.body, /Clientes a avisar a mano/);
  assert.match(summary.body, /Paula Ramos \(apartado nº 16\) · teléfono 612 345 016 · vale VALE-00016 · motivo: sin email válido/);
  assert.deepEqual(summary.bounced, []);
});

test('15 · a bounced customer email moves that customer to "avisar a mano" and is reported', () => {
  const planned = plan(expiredOf(), expiredOf({ id: 17, cliente: 'Luis Gil', email: 'luis@example.com' }, { codigo: 'VALE-00017' }));
  const summary = buildSummary({ planned, sendResults: [sentOk, sentBounced], today: TODAY, shopAddress: SHOP });
  assert.match(summary.body, /Luis Gil \(apartado nº 17\).*vale VALE-00017 · motivo: el envío falló/);
  assert.doesNotMatch(summary.body, /Paula Ramos \(apartado nº 16\) ·.*motivo/);
  assert.deepEqual(summary.bounced, [17]);
});

test('16 · results must line up with the emails that were sent', () => {
  assert.throws(() => buildSummary({ planned: plan(expiredOf()), sendResults: [], today: TODAY, shopAddress: SHOP }), /no coincide/);
});

test('17 · verify passes when nothing went wrong', () => {
  assert.doesNotThrow(() => verifyResult({ failures: [], bounced: [], summaryFailed: false }));
});

test('18 · verify throws with ids and counts only when anything failed', () => {
  assert.throws(() => verifyResult({ failures: [{ id: 17 }], bounced: [], summaryFailed: false }), /nº 17/);
  assert.throws(() => verifyResult({ failures: [], bounced: [16], summaryFailed: false }), /nº 16/);
  assert.throws(() => verifyResult({ failures: [], bounced: [], summaryFailed: true }), /resumen/);
  try {
    verifyResult({ failures: [{ id: 17 }], bounced: [16], summaryFailed: true });
  } catch (error) {
    assert.doesNotMatch(error.message, /@|Paula|example/);
  }
});
