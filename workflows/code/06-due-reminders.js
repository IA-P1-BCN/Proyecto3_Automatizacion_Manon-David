// Flow 06 · Due Date Reminders: pure logic shared by the generator and the tests.
// Pasted ahead of each Code node's own lines. No credentials, no network, no time zones: Madrid's "today" is passed in.
// The app is the source of truth: `pendiente`, `abonado` and `fecha_limite` are shown as sent, never recalculated.

const THRESHOLDS = [7, 1];
const COLUMNS = ['apartado_id', 'umbral', 'resultado', 'fecha_envio'];
const HISTORY_NAME = 'avisos.csv';

function validDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  // An impossible date such as 2026-13-01 gives an Invalid Date, which must not escape as a RangeError.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('La fecha debe ser una fecha válida YYYY-MM-DD.');
  }
  return value;
}

// Calendar arithmetic in UTC, so no time zone or daylight-saving change can shift the day.
function addDays(isoDate, days) {
  const date = new Date(`${validDate(isoDate)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function runInput(input, today) {
  validDate(today);
  const scheduled = input.mode === 'scheduled';
  if (!scheduled && input.mode !== 'manual') throw new Error('Modo de ejecución no válido.');
  const fecha = validDate(scheduled ? today : String(input.fecha || ''));
  return { fecha, mode: input.mode };
}

function formatEuros(amount) {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// "2027-01-18" -> "18/01/2027", without going through Date.
function formatDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  return `${day}/${month}/${year}`;
}

function hasUsableEmail(email) {
  return typeof email === 'string' && email.trim().includes('@');
}

function requireReservation(reservation) {
  if (!reservation || !Number.isSafeInteger(reservation.id)) throw new Error('La API devolvió un apartado sin número válido.');
  validDate(String(reservation.fecha_limite));
  for (const field of ['abonado', 'pendiente']) {
    if (typeof reservation[field] !== 'number' || !Number.isFinite(reservation[field])) {
      throw new Error(`El apartado ${reservation.id} llegó sin «${field}» válido.`);
    }
  }
}

function shoesOf(reservation) {
  const size = String(reservation.talla ?? '').trim();
  return size ? `«${reservation.producto}» (talla ${size})` : `«${reservation.producto}»`;
}

function customerEmail(reservation, umbral) {
  const when = umbral === 1 ? 'mañana' : 'en 7 días';
  return {
    subject: umbral === 1 ? `Tu apartado vence mañana · ${reservation.producto}` : `Tu apartado vence en 7 días · ${reservation.producto}`,
    body: [
      `Hola ${reservation.cliente},`,
      '',
      `Te recordamos que el plazo de tu apartado de ${shoesOf(reservation)} termina ${when}, el ${formatDate(reservation.fecha_limite)}.`,
      '',
      `Pendiente por pagar: ${formatEuros(reservation.pendiente)}`,
      `Ya abonado: ${formatEuros(reservation.abonado)}`,
      `Fecha límite: ${formatDate(reservation.fecha_limite)}`,
      '',
      'Si no se completa el pago a tiempo, el apartado vence y lo que has abonado se convierte en un vale de compra (nunca en dinero).',
      '',
      'Gracias por confiar en Zapatería Paso Firme.',
    ].join('\n'),
  };
}

function shopEmail(reservation, umbral) {
  const which = umbral === 1 ? 'de 1 día' : 'de 7 días';
  return {
    subject: `Recordatorio sin enviar: el apartado nº ${reservation.id} no tiene email válido`,
    body: [
      `No se pudo enviar el recordatorio ${which} a la clienta.`,
      '',
      `Apartado nº:  ${reservation.id}`,
      `Cliente:      ${reservation.cliente}`,
      ...(reservation.telefono ? [`Teléfono:     ${reservation.telefono}`] : []),
      `Producto:     ${reservation.producto}`,
      `Fecha límite: ${formatDate(reservation.fecha_limite)}`,
      `Pendiente:    ${formatEuros(reservation.pendiente)}`,
      'Motivo:       el apartado no tiene email o el email no es válido.',
    ].join('\n'),
  };
}

function parseRecords(text) {
  const records = new Map();
  if (text === null) return records;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Registro de avisos vacío o inválido; no se sobrescribirá.');
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  if (lines.shift() !== COLUMNS.join(';')) throw new Error('Cabecera del registro de avisos no reconocida; no se sobrescribirá.');
  for (const line of lines) {
    const values = line.split(';');
    if (values.length !== COLUMNS.length) throw new Error('Fila dañada en el registro de avisos.');
    const [id, umbral, resultado, fecha] = values;
    if (!/^[1-9]\d*$/.test(id) || !THRESHOLDS.includes(Number(umbral)) || !['enviado', 'sin_email'].includes(resultado)) {
      throw new Error('Fila no válida en el registro de avisos.');
    }
    validDate(fecha);
    const key = `${id}:${umbral}`;
    if (records.has(key)) throw new Error('Aviso duplicado en el registro de avisos.');
    records.set(key, { apartado_id: Number(id), umbral: Number(umbral), resultado, fecha_envio: fecha });
  }
  return records;
}

// Which emails are due today. `records` is the Map from parseRecords.
function planReminders({ reservations, today, records, shopAddress }) {
  validDate(today);
  if (!Array.isArray(reservations)) throw new Error('La API no devolvió una lista de apartados.');
  const dueDates = new Map(THRESHOLDS.map((umbral) => [addDays(today, umbral), umbral]));
  const planned = [];
  for (const reservation of reservations) {
    if (reservation?.estado !== 'activo') continue;
    requireReservation(reservation);
    const umbral = dueDates.get(reservation.fecha_limite);
    if (!umbral || records.has(`${reservation.id}:${umbral}`)) continue;
    const usable = hasUsableEmail(reservation.email);
    const mail = usable ? customerEmail(reservation, umbral) : shopEmail(reservation, umbral);
    planned.push({
      to: usable ? reservation.email.trim() : shopAddress,
      subject: mail.subject,
      body: mail.body,
      apartado_id: reservation.id,
      umbral,
      resultado: usable ? 'enviado' : 'sin_email',
    });
  }
  return planned;
}

// `results[i]` is the Send Email output for `planned[i]`; an `error` field means the SMTP server rejected it.
function collectResults(planned, results, today) {
  validDate(today);
  if (!Array.isArray(planned) || !Array.isArray(results) || planned.length !== results.length) {
    throw new Error('El número de resultados de envío no coincide con los avisos previstos.');
  }
  const rows = [];
  let failed = 0;
  planned.forEach((item, i) => {
    if (results[i]?.error) {
      failed++;
    } else {
      rows.push({ apartado_id: item.apartado_id, umbral: item.umbral, resultado: item.resultado, fecha_envio: today });
    }
  });
  return { rows, failed };
}

function appendRecords(existingText, rows) {
  const records = parseRecords(existingText);
  for (const row of rows) {
    const key = `${row.apartado_id}:${row.umbral}`;
    if (records.has(key)) throw new Error('El aviso ya figuraba en el registro; no se duplicará.');
    records.set(key, row);
  }
  const lines = [COLUMNS.join(';')];
  for (const record of records.values()) lines.push(COLUMNS.map((column) => record[column]).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

// Same listing rules as flow 05: only a complete, successful listing proves the file is absent.
function findRecordsFile(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('No hay respuesta del listado kDrive.');
  const matches = [];
  for (let i = 0; i < pages.length; i++) {
    const response = pages[i];
    if (response.statusCode !== 200 || response.body?.result !== 'success' || !Array.isArray(response.body.data)) {
      throw new Error('No se pudo listar kDrive; no se creará ningún fichero.');
    }
    if (typeof response.body.has_more !== 'boolean' || (i === pages.length - 1 && response.body.has_more)) {
      throw new Error('Listado kDrive incompleto; no se creará ningún fichero.');
    }
    matches.push(...response.body.data.filter((file) => file.name === HISTORY_NAME));
  }
  if (matches.length > 1) throw new Error('Hay varios registros de avisos con el mismo nombre.');
  const file = matches[0];
  if (file && (file.type !== 'file' || !['ok', null].includes(file.status) || !Number.isSafeInteger(file.id) || !/^[a-fA-F0-9]{16,32}$/.test(file.etag || ''))) {
    throw new Error('El registro de avisos está bloqueado o no tiene ETag válido; no se sobrescribirá.');
  }
  return file || null;
}

if (typeof module !== 'undefined') {
  module.exports = { COLUMNS, THRESHOLDS, HISTORY_NAME, addDays, runInput, parseRecords, planReminders, collectResults, appendRecords, findRecordsFile };
}
