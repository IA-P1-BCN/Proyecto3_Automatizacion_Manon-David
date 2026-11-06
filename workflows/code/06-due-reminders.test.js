const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addDays, runInput, parseRecords, planReminders, collectResults, appendRecords, findRecordsFile,
} = require('./06-due-reminders.js');

const TODAY = '2026-10-20';
const SHOP = 'tienda@example.com';
const reservation = (overrides = {}) => ({
  id: 25, fecha: '2026-07-22', cliente: 'Carmen Ruiz', telefono: '612 345 001', email: 'carmen@example.com',
  producto: 'Botín piel marrón', talla: '38', precio: 89.9, abonado: 30.0, pendiente: 59.9,
  fecha_limite: '2026-10-27', estado: 'activo', ...overrides,
});
const plan = (reservations, records = new Map()) => planReminders({ reservations, today: TODAY, records, shopAddress: SHOP });

test('1 · deadline in 7 days gets the 7-day reminder with the app figures in Spanish format', () => {
  const [item, ...rest] = plan([reservation()]);
  assert.equal(rest.length, 0);
  assert.equal(item.umbral, 7);
  assert.equal(item.to, 'carmen@example.com');
  assert.equal(item.resultado, 'enviado');
  assert.equal(item.subject, 'Tu apartado vence en 7 días · Botín piel marrón');
  assert.match(item.body, /Hola Carmen Ruiz,/);
  assert.match(item.body, /«Botín piel marrón» \(talla 38\)/);
  assert.match(item.body, /Pendiente por pagar: 59,90 €/);
  assert.match(item.body, /Ya abonado: 30,00 €/);
  assert.match(item.body, /Fecha límite: 27\/10\/2026/);
});

test('2 · deadline tomorrow gets the 1-day reminder worded as "mañana"', () => {
  const [item] = plan([reservation({ fecha_limite: '2026-10-21' })]);
  assert.equal(item.umbral, 1);
  assert.equal(item.subject, 'Tu apartado vence mañana · Botín piel marrón');
  assert.match(item.body, /termina mañana, el 21\/10\/2026/);
});

test('3 · any other distance gets nothing', () => {
  for (const fecha_limite of ['2026-10-26', '2026-10-28', '2026-10-20', '2026-10-19', '2026-10-22']) {
    assert.deepEqual(plan([reservation({ fecha_limite })]), [], fecha_limite);
  }
});

test('4 · liquidado and vencido reservations get nothing', () => {
  for (const estado of ['liquidado', 'vencido']) {
    assert.deepEqual(plan([reservation({ estado })]), [], estado);
  }
});

test('5 · nothing due returns an empty plan', () => {
  assert.deepEqual(plan([]), []);
});

test('6 · pending is shown as the app sent it, never recomputed', () => {
  const [item] = plan([reservation({ precio: 100, abonado: 5, pendiente: 59.9 })]);
  assert.match(item.body, /Pendiente por pagar: 59,90 €/);
});

test('7 · missing size leaves no size line or label', () => {
  for (const talla of [null, '', '  ', undefined]) {
    const [item] = plan([reservation({ talla })]);
    assert.match(item.body, /«Botín piel marrón»,|«Botín piel marrón» termina|«Botín piel marrón» /);
    assert.doesNotMatch(item.body, /talla/);
  }
});

test('8 · empty, blank or @-less email goes to the shop and is recorded as sin_email', () => {
  for (const email of ['', '   ', null, undefined, 'carmen.example.com']) {
    const [item] = plan([reservation({ email })]);
    assert.equal(item.to, SHOP);
    assert.equal(item.resultado, 'sin_email');
    assert.equal(item.apartado_id, 25);
    assert.match(item.subject, /apartado nº 25 no tiene email válido/);
    assert.match(item.body, /Cliente:\s+Carmen Ruiz/);
    assert.match(item.body, /Teléfono:\s+612 345 001/);
    assert.match(item.body, /Producto:\s+Botín piel marrón/);
    assert.match(item.body, /de 7 días/);
  }
});

test('9 · shop alert leaves out the phone line when there is no phone', () => {
  const [item] = plan([reservation({ email: '', telefono: null })]);
  assert.doesNotMatch(item.body, /Teléfono/);
});

test('10 · a reminder already recorded is not planned again, but the other threshold still is', () => {
  const records = parseRecords('﻿apartado_id;umbral;resultado;fecha_envio\r\n25;7;enviado;2026-10-13\r\n');
  assert.deepEqual(plan([reservation({ fecha_limite: '2026-10-27' })], records), []);
  const [item] = planReminders({ reservations: [reservation({ fecha_limite: '2026-10-21' })], today: TODAY, records, shopAddress: SHOP });
  assert.equal(item.umbral, 1);
});

test('11 · a sin_email record also stops the shop being alerted again', () => {
  const records = parseRecords('apartado_id;umbral;resultado;fecha_envio\n25;7;sin_email;2026-10-20\n');
  assert.deepEqual(plan([reservation({ email: '' })], records), []);
});

test('12 · several due reservations keep their own data', () => {
  const items = plan([
    reservation({ id: 1, fecha_limite: '2026-10-27' }),
    reservation({ id: 2, fecha_limite: '2026-10-21', email: 'b@example.com' }),
    reservation({ id: 3, fecha_limite: '2026-11-30' }),
  ]);
  assert.deepEqual(items.map((i) => [i.apartado_id, i.umbral]), [[1, 7], [2, 1]]);
});

test('13 · month, year and leap-day changes are plain calendar days', () => {
  assert.equal(addDays('2026-12-28', 7), '2027-01-04');
  assert.equal(addDays('2028-02-22', 7), '2028-02-29');
  assert.equal(addDays('2027-02-22', 7), '2027-03-01');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-25', 7), '2026-04-01');
  const items = planReminders({
    reservations: [reservation({ fecha_limite: '2027-01-04' })], today: '2026-12-28', records: new Map(), shopAddress: SHOP,
  });
  assert.equal(items[0].umbral, 7);
});

test('14 · invalid input fails loudly instead of skipping silently', () => {
  assert.throws(() => plan({}), /lista de apartados/);
  assert.throws(() => plan([reservation({ fecha_limite: '2026-13-01' })]), /fecha válida/);
  assert.throws(() => plan([reservation({ pendiente: '59,90' })]), /«pendiente»/);
  assert.throws(() => plan([reservation({ id: null })]), /número válido/);
  assert.throws(() => planReminders({ reservations: [], today: 'hoy', records: new Map(), shopAddress: SHOP }), /fecha válida/);
});

test('15 · reservations that are not active are not validated (old data cannot break the run)', () => {
  assert.deepEqual(plan([reservation({ estado: 'vencido', fecha_limite: null, pendiente: null })]), []);
});

test('16 · run input: scheduled uses today, manual uses its date, bad values fail', () => {
  assert.deepEqual(runInput({ mode: 'scheduled' }, TODAY), { fecha: TODAY, mode: 'scheduled' });
  assert.deepEqual(runInput({ mode: 'manual', fecha: '2026-10-13' }, TODAY), { fecha: '2026-10-13', mode: 'manual' });
  assert.throws(() => runInput({ mode: 'manual', fecha: '13/10/2026' }, TODAY), /fecha válida/);
  assert.throws(() => runInput({ mode: 'manual' }, TODAY), /fecha válida/);
  assert.throws(() => runInput({ mode: 'other' }, TODAY), /Modo/);
});

const planned = [
  { apartado_id: 1, umbral: 7, resultado: 'enviado' },
  { apartado_id: 2, umbral: 1, resultado: 'sin_email' },
  { apartado_id: 3, umbral: 7, resultado: 'enviado' },
];

test('17 · only accepted emails become rows; a rejected one is counted as failed', () => {
  const { rows, failed } = collectResults(planned, [{}, { error: 'rejected' }, {}], TODAY);
  assert.equal(failed, 1);
  assert.deepEqual(rows, [
    { apartado_id: 1, umbral: 7, resultado: 'enviado', fecha_envio: TODAY },
    { apartado_id: 3, umbral: 7, resultado: 'enviado', fecha_envio: TODAY },
  ]);
});

test('18 · results that do not line up with the plan fail loudly', () => {
  assert.throws(() => collectResults(planned, [{}], TODAY), /no coincide/);
  assert.throws(() => collectResults(planned, null, TODAY), /no coincide/);
});

test('19 · append creates the file with BOM, header and CRLF when none exists', () => {
  const csv = appendRecords(null, [{ apartado_id: 25, umbral: 7, resultado: 'enviado', fecha_envio: TODAY }]);
  assert.equal(csv, '﻿apartado_id;umbral;resultado;fecha_envio\r\n25;7;enviado;2026-10-20\r\n');
});

test('20 · append keeps existing rows in order and round-trips', () => {
  const first = appendRecords(null, [{ apartado_id: 25, umbral: 7, resultado: 'enviado', fecha_envio: '2026-10-13' }]);
  const second = appendRecords(first, [{ apartado_id: 25, umbral: 1, resultado: 'enviado', fecha_envio: '2026-10-19' }]);
  assert.deepEqual([...parseRecords(second).keys()], ['25:7', '25:1']);
  assert.equal(second.split('\r\n').length, 4);
});

test('21 · append refuses to duplicate a key', () => {
  const csv = appendRecords(null, [{ apartado_id: 25, umbral: 7, resultado: 'enviado', fecha_envio: TODAY }]);
  assert.throws(
    () => appendRecords(csv, [{ apartado_id: 25, umbral: 7, resultado: 'enviado', fecha_envio: TODAY }]),
    /no se duplicará/,
  );
});

test('22 · a wrong header, damaged row, bad value, duplicate or empty file is refused', () => {
  assert.throws(() => parseRecords('id;umbral\n1;7\n'), /Cabecera/);
  assert.throws(() => parseRecords('apartado_id;umbral;resultado;fecha_envio\n1;7;enviado\n'), /dañada/);
  assert.throws(() => parseRecords('apartado_id;umbral;resultado;fecha_envio\n1;3;enviado;2026-10-20\n'), /no válida/);
  assert.throws(() => parseRecords('apartado_id;umbral;resultado;fecha_envio\n1;7;quizas;2026-10-20\n'), /no válida/);
  assert.throws(() => parseRecords('apartado_id;umbral;resultado;fecha_envio\n1;7;enviado;20/10/2026\n'), /fecha válida/);
  assert.throws(() => parseRecords('apartado_id;umbral;resultado;fecha_envio\n1;7;enviado;2026-10-20\n1;7;enviado;2026-10-20\n'), /duplicado/);
  assert.throws(() => parseRecords('  '), /vacío/);
  assert.equal(parseRecords(null).size, 0);
});

const page = (data, has_more = false) => ({ statusCode: 200, body: { result: 'success', data, has_more } });
const file = { id: 9, type: 'file', name: 'avisos.csv', status: 'ok', etag: 'abcdef0123456789' };

test('23 · listing: finds the file, proves absence only from a complete listing', () => {
  assert.equal(findRecordsFile([page([file, { ...file, id: 10, name: 'basedatos.csv' }])]).id, 9);
  assert.equal(findRecordsFile([page([{ ...file, name: 'basedatos.csv' }])]), null);
  assert.equal(findRecordsFile([page([], true), page([file])]).id, 9);
});

test('24 · listing: incomplete, failed, duplicate or locked results fail loudly', () => {
  assert.throws(() => findRecordsFile([page([], true)]), /incompleto/);
  assert.throws(() => findRecordsFile([{ statusCode: 500, body: {} }]), /No se pudo listar/);
  assert.throws(() => findRecordsFile([]), /No hay respuesta/);
  assert.throws(() => findRecordsFile([page([file, { ...file, id: 11 }])]), /varios/);
  assert.throws(() => findRecordsFile([page([{ ...file, etag: undefined }])]), /ETag/);
  assert.throws(() => findRecordsFile([page([{ ...file, status: 'locked' }])]), /bloqueado/);
});
