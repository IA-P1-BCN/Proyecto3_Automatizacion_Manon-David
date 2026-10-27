// Flow 10 · Excel Migration: pure logic shared by the generator and the tests.
// Pasted ahead of each Code node's own lines. No credentials, no network: what the app already holds is passed in.
// The app is the source of truth: the flow never computes `pendiente`; it only predicts a rejection (decision "doubtful rows")
// so it does not create something half valid, and the app's own 422 stays the safety net.

// Copy of `backend/config.py` (minimum initial abono). A test pins it; the app's 422 catches any drift.
const MIN_ABONO_INICIAL = 5;
const PAYMENT_METHODS = ['efectivo', 'tarjeta', 'bizum'];
const DEFAULT_PAYMENT = 'efectivo';
const APARTADOS_COLUMNS = ['fecha', 'cliente', 'telefono', 'modelo', 'talla', 'precio', 'abono', 'resta', 'notas'];
const VENTAS_COLUMNS = ['fecha', 'concepto', 'importe', 'forma_pago'];

function plain(value) {
  return String(value ?? '').replace(/^﻿/, '').trim();
}

// Lower case, no accents, single spaces: the comparison form of names, products and concepts.
function normalise(value) {
  return plain(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ');
}

const toCents = (euros) => Math.round(euros * 100);

function formatEuros(amount) {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// "2026-09-02" -> "02/09/2026", without going through Date.
function formatDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  return `${day}/${month}/${year}`;
}

// Day first. Two-digit years are 20xx. Impossible dates (31/02) are unreadable, never guessed.
function parseDate(value) {
  const text = plain(value);
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text) || /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const iso = text.includes('-')
    ? text
    : `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

// "15€", "89.90", "1.842,30", "64,5". More than two decimals or a value that is not above zero is unreadable.
function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
  let text = plain(value).replace(/€/g, '').replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(text)) return null;
  const lastComma = text.lastIndexOf(',');
  const lastPoint = text.lastIndexOf('.');
  const decimalAt = Math.max(lastComma, lastPoint);
  if (decimalAt >= 0) {
    const decimals = text.slice(decimalAt + 1);
    const integer = text.slice(0, decimalAt).replace(/[.,]/g, '');
    if (decimals.length > 2 || decimals.length === 0) return null;
    text = `${integer}.${decimals}`;
  }
  const amount = Number(text);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null;
}

function cleanName(value) {
  return plain(value).replace(/\s+/g, ' ').toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

// Nine digits are shown as the app's sample data does ("612 345 001"); anything else is kept as typed.
function cleanPhone(value) {
  const text = plain(value);
  const digits = text.replace(/\D/g, '');
  return digits.length === 9 ? `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}` : text;
}

function checkHeader(rows, expected, sheetName) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`La hoja de ${sheetName} está vacía o no se pudo leer.`);
  const found = Object.keys(rows[0]).map((key) => plain(key).toLowerCase());
  const missing = expected.filter((column) => !found.includes(column));
  if (missing.length > 0) throw new Error(`A la hoja de ${sheetName} le faltan las columnas: ${missing.join(', ')}.`);
}

// Same keys with the BOM and spacing removed, so rows read the same however the CSV was saved.
function tidyRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [plain(key).toLowerCase(), value]));
}

function isBlank(row) {
  return Object.values(row).every((value) => plain(value) === '');
}

const held = (sheet, line, summary, reason) => ({ hoja: sheet, linea: line, resumen: summary, motivo: reason });

// Apartados sheet -> typed rows. A row that cannot be read goes to `held`; a format difference never does.
function cleanApartados(rawRows) {
  checkHeader(rawRows, APARTADOS_COLUMNS, 'apartados');
  const rows = [];
  const heldRows = [];
  rawRows.forEach((raw, index) => {
    const line = index + 2;
    const row = tidyRow(raw);
    if (isBlank(row)) return;
    const summary = `${plain(row.fecha)} · ${plain(row.cliente)} · ${plain(row.modelo)}`;
    const fecha = parseDate(row.fecha);
    const cliente = cleanName(row.cliente);
    const producto = plain(row.modelo);
    const precio = parseAmount(row.precio);
    const abono = parseAmount(row.abono);
    const problem = (!fecha && 'La fecha falta o no se entiende.')
      || (!cliente && 'Falta el nombre del cliente.')
      || (!producto && 'Falta el modelo.')
      || (!precio && 'El precio falta o no se entiende.')
      || (!abono && 'El abono falta o no se entiende.');
    if (problem) {
      heldRows.push(held('apartados', line, summary, problem));
      return;
    }
    rows.push({ line, fecha, cliente, telefono: cleanPhone(row.telefono), producto, talla: plain(row.talla), precio, importe: abono });
  });
  return { rows, held: heldRows };
}

// Sales sheet -> typed rows. The hand-typed "TOTAL …" line is not data and is dropped before anything else.
function cleanVentas(rawRows) {
  checkHeader(rawRows, VENTAS_COLUMNS, 'ventas');
  const rows = [];
  const heldRows = [];
  let totalLines = 0;
  rawRows.forEach((raw, index) => {
    const line = index + 2;
    const row = tidyRow(raw);
    if (isBlank(row)) return;
    if (normalise(row.fecha).startsWith('total') || normalise(row.concepto).startsWith('total')) {
      totalLines += 1;
      return;
    }
    const summary = `${plain(row.fecha)} · ${plain(row.concepto)}`;
    const fecha = parseDate(row.fecha);
    const concepto = plain(row.concepto);
    const importe = parseAmount(row.importe);
    const method = normalise(row.forma_pago);
    const problem = (!fecha && 'La fecha falta o no se entiende.')
      || (!concepto && 'Falta el concepto.')
      || (!importe && 'El importe falta o no se entiende.')
      || (!PAYMENT_METHODS.includes(method) && 'La forma de pago no es efectivo, tarjeta ni bizum.');
    if (problem) {
      heldRows.push(held('ventas', line, summary, problem));
      return;
    }
    rows.push({ line, fecha, concepto, importe, forma_pago: method });
  });
  return { rows, held: heldRows, totalLines };
}

const reservationKey = (row) => `${normalise(row.cliente)}|${normalise(row.producto)}|${normalise(row.talla)}`;
const depositKey = (fecha, euros) => `${fecha}|${toCents(euros)}`;
const looksLikeDeposit = (concept) => /abono|apartado/.test(normalise(concept));

// A sales line that only repeats an apartado deposit is not a sale: it is dropped and lends its payment method.
// A line that mentions abono/apartado but matches no deposit is left for Marisa instead of becoming a sale.
function classifyVentas(sales, apartadoRows) {
  const unusedDeposits = new Map();
  for (const row of apartadoRows) {
    const key = depositKey(row.fecha, row.importe);
    unusedDeposits.set(key, (unusedDeposits.get(key) || 0) + 1);
  }
  const lendedMethod = new Map();
  const plainSales = [];
  const repeated = [];
  const heldRows = [];
  const pending = [];
  for (const sale of sales) {
    if (!looksLikeDeposit(sale.concepto)) {
      plainSales.push(sale);
      continue;
    }
    const key = depositKey(sale.fecha, sale.importe);
    if ((unusedDeposits.get(key) || 0) > 0) {
      unusedDeposits.set(key, unusedDeposits.get(key) - 1);
      if (!lendedMethod.has(key)) lendedMethod.set(key, []);
      lendedMethod.get(key).push(sale.forma_pago);
      repeated.push(sale);
    } else {
      pending.push(sale);
    }
  }
  for (const sale of pending) {
    heldRows.push(held('ventas', sale.line, `${formatDate(sale.fecha)} · ${sale.concepto}`,
      'Parece un abono de apartado, pero ningún abono de la hoja de apartados tiene esa fecha e importe.'));
  }
  return { sales: plainSales, repeated, held: heldRows, lendedMethod };
}

// Apartados rows -> reservations. First row of a customer and product is the apartado with its initial abono, the rest are abonos.
// A later row with another price is held. Rows are ordered by date (stable), so the first dated row opens the reservation.
function groupReservations(rows, lendedMethod) {
  const methodFor = new Map([...lendedMethod].map(([key, methods]) => [key, [...methods]]));
  const ordered = rows.map((row, index) => ({ row, index })).sort((a, b) => a.row.fecha.localeCompare(b.row.fecha) || a.index - b.index).map((entry) => entry.row);
  const reservations = new Map();
  const heldRows = [];
  for (const row of ordered) {
    const key = reservationKey(row);
    const lended = methodFor.get(depositKey(row.fecha, row.importe));
    const method = lended && lended.length > 0 ? lended.shift() : null;
    const item = { line: row.line, fecha: row.fecha, importe: row.importe, forma_pago: method || DEFAULT_PAYMENT, defaulted: !method };
    const summary = `${formatDate(row.fecha)} · ${row.cliente} · ${row.producto}`;
    if (!reservations.has(key)) {
      reservations.set(key, { key, fecha: row.fecha, cliente: row.cliente, telefono: row.telefono, producto: row.producto, talla: row.talla, precio: row.precio, items: [{ ...item, kind: 'inicial', summary }] });
    } else if (reservations.get(key).precio !== row.precio) {
      heldRows.push(held('apartados', row.line, summary, `El precio (${formatEuros(row.precio)}) no coincide con el del apartado (${formatEuros(reservations.get(key).precio)}).`));
    } else {
      reservations.get(key).items.push({ ...item, kind: 'abono', summary });
    }
  }
  return { reservations: [...reservations.values()], held: heldRows };
}

// The business rules the app would reject. Everything of a held apartado is held with it.
function applyRules(reservations) {
  const accepted = [];
  const heldRows = [];
  for (const reservation of reservations) {
    const [initial, ...later] = reservation.items;
    const price = toCents(reservation.precio);
    const label = `${reservation.cliente} · ${reservation.producto}`;
    if (toCents(initial.importe) < toCents(MIN_ABONO_INICIAL)) {
      heldRows.push(held('apartados', initial.line, initial.summary, `El abono inicial (${formatEuros(initial.importe)}) es menor de ${formatEuros(MIN_ABONO_INICIAL)}.`));
    } else if (toCents(initial.importe) > price) {
      heldRows.push(held('apartados', initial.line, initial.summary, `El abono inicial (${formatEuros(initial.importe)}) supera el precio (${formatEuros(reservation.precio)}).`));
    } else {
      let paid = toCents(initial.importe);
      const kept = [initial];
      for (const item of later) {
        if (toCents(item.importe) > price - paid) {
          heldRows.push(held('apartados', item.line, item.summary, `El abono (${formatEuros(item.importe)}) supera lo que faltaba por pagar (${formatEuros((price - paid) / 100)}).`));
        } else {
          paid += toCents(item.importe);
          kept.push(item);
        }
      }
      accepted.push({ ...reservation, items: kept });
      continue;
    }
    for (const item of later) {
      heldRows.push(held('apartados', item.line, item.summary, `Depende del apartado de ${label}, que no se carga.`));
    }
  }
  return { reservations: accepted, held: heldRows };
}

// Everything the first Code node needs from the two sheets, in one pass. Returns plain data for the next nodes.
function prepareMigration(apartadosRaw, ventasRaw) {
  const apartados = cleanApartados(apartadosRaw);
  const ventas = cleanVentas(ventasRaw);
  const classified = classifyVentas(ventas.rows, apartados.rows);
  const grouped = groupReservations(apartados.rows, classified.lendedMethod);
  const ruled = applyRules(grouped.reservations);
  return {
    reservations: ruled.reservations,
    sales: classified.sales,
    repeatedSales: classified.repeated.length,
    totalLines: ventas.totalLines,
    held: sortHeld([...apartados.held, ...ventas.held, ...grouped.held, ...ruled.held, ...classified.held]),
  };
}

function sortHeld(list) {
  return [...list].sort((a, b) => a.hoja.localeCompare(b.hoja) || a.linea - b.linea);
}

// App state -> which reservations of the CSV may already be there. Returns the ids whose abonos must be fetched.
// Same key for the app's apartado and the CSV's reservation: customer, product, date and price (decision "idempotency").
const existingKey = (reservation) => `${normalise(reservation.cliente)}|${normalise(reservation.producto)}|${reservation.fecha}|${toCents(reservation.precio)}`;

function findExisting(reservations, appApartados) {
  const byKey = new Map();
  for (const apartado of appApartados) {
    const key = existingKey(apartado);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(apartado.id);
  }
  const used = new Set();
  return reservations.map((reservation) => {
    const candidates = (byKey.get(existingKey(reservation)) || []).filter((id) => !used.has(id));
    const id = candidates.length > 0 ? candidates[0] : null;
    if (id !== null) used.add(id);
    return { key: reservation.key, existingId: id };
  });
}

function consume(counts, key) {
  if ((counts.get(key) || 0) > 0) {
    counts.set(key, counts.get(key) - 1);
    return true;
  }
  return false;
}

function countBy(list, keyOf) {
  const counts = new Map();
  for (const entry of list) counts.set(keyOf(entry), (counts.get(keyOf(entry)) || 0) + 1);
  return counts;
}

// What is left to create. `existing` maps reservation key -> { id, abonos: [{ fecha, importe }] } for apartados already in the app;
// `appSales` are the sales the app already holds in the CSV's date range. Identical rows are compared by count.
function planCreates({ reservations, sales, existing, appSales }) {
  const creates = [];
  const skipped = { apartados: 0, abonos: 0, ventas: 0 };
  for (const reservation of reservations) {
    const found = existing.get(reservation.key);
    if (!found) {
      creates.push({ type: 'apartado', reservation, items: reservation.items });
      continue;
    }
    skipped.apartados += 1;
    const left = countBy(found.abonos, (abono) => depositKey(abono.fecha, abono.importe));
    const missing = [];
    for (const item of reservation.items) {
      if (consume(left, depositKey(item.fecha, item.importe))) skipped.abonos += 1;
      else missing.push({ ...item, kind: 'abono' });
    }
    if (missing.length > 0) creates.push({ type: 'abonos', reservation, apartadoId: found.id, items: missing });
  }
  const appCounts = countBy(appSales, (sale) => `${sale.fecha}|${normalise(sale.concepto)}|${toCents(sale.importe)}`);
  const newSales = [];
  for (const sale of sales) {
    if (consume(appCounts, `${sale.fecha}|${normalise(sale.concepto)}|${toCents(sale.importe)}`)) skipped.ventas += 1;
    else newSales.push(sale);
  }
  return { creates, skipped, sales: newSales };
}

const apartadoBody = (reservation) => {
  const [initial] = reservation.items;
  const body = { cliente: reservation.cliente, producto: reservation.producto, precio: reservation.precio, abono_inicial: initial.importe, forma_pago: initial.forma_pago, fecha: reservation.fecha };
  if (reservation.telefono) body.telefono = reservation.telefono;
  if (reservation.talla) body.talla = reservation.talla;
  return body;
};
const abonoBody = (item) => ({ importe: item.importe, forma_pago: item.forma_pago, fecha: item.fecha });
const ventaBody = (sale) => ({ concepto: sale.concepto, importe: sale.importe, forma_pago: sale.forma_pago, fecha: sale.fecha });

// The app answered 422 to a create the checks let through: the item and, for an initial abono, the whole reservation are left for Marisa.
function rejectionHolds(reservation, item, detail) {
  const heldRows = [held('apartados', item.line, item.summary, `La app lo rechazó: ${detail}`)];
  if (item.kind === 'inicial') {
    for (const other of reservation.items.filter((candidate) => candidate !== item)) {
      heldRows.push(held('apartados', other.line, other.summary, `Depende del apartado de ${reservation.cliente} · ${reservation.producto}, que no se carga.`));
    }
  }
  return heldRows;
}

function rejectedSale(sale, detail) {
  return held('ventas', sale.line, `${formatDate(sale.fecha)} · ${sale.concepto}`, `La app lo rechazó: ${detail}`);
}

// One Spanish email for Marisa. `created` and `skipped` are counts; `defaults` are the deposits created with the fallback payment method.
function buildReport({ created, skipped, held: heldRows, defaults, flagError }) {
  const line = (label, count) => `  · ${label}: ${count}`;
  const parts = [
    'Hola Marisa,',
    '',
    'Esto es el resultado de la migración de tu Excel a la app.',
    '',
    'Cargado ahora:',
    line('apartados', created.apartados),
    line('abonos', created.abonos),
    line('ventas', created.ventas),
    '',
    'Ya estaba cargado (no se ha vuelto a crear):',
    line('apartados', skipped.apartados),
    line('abonos', skipped.abonos),
    line('ventas', skipped.ventas),
    '',
  ];
  if (heldRows.length === 0) {
    parts.push('Filas que necesitan tu decisión: ninguna.');
  } else {
    parts.push(`Filas que NO se han cargado y necesitan tu decisión (${heldRows.length}):`);
    for (const entry of heldRows) parts.push(`  · Hoja de ${entry.hoja}, línea ${entry.linea} (${entry.resumen}): ${entry.motivo}`);
  }
  parts.push('');
  if (defaults.length === 0) {
    parts.push('Abonos cargados con la forma de pago «efectivo» por defecto: ninguno.');
  } else {
    parts.push(`Abonos cargados con la forma de pago «efectivo» porque el Excel no la indicaba (${defaults.length}):`);
    for (const entry of defaults) parts.push(`  · ${entry}`);
  }
  if (flagError) {
    parts.push('', 'ATENCIÓN: no se pudo desactivar el aviso de migración; los avisos a clientes pueden estar pausados. Avisa al equipo.');
  }
  parts.push('', 'Si lo ejecutas otra vez no se duplica nada: solo se cargará lo que falte.');
  return { subject: `Migración del Excel: ${created.apartados} apartados, ${created.abonos} abonos, ${created.ventas} ventas · ${heldRows.length} para revisar`, body: parts.join('\n') };
}

const defaultedLabel = (reservation, item) => `${formatDate(item.fecha)} · ${reservation.cliente} · ${reservation.producto} · ${formatEuros(item.importe)}`;

// ---- Running the plan against the app, one stage per HTTP node ----
// Each stage builds its requests, the HTTP node sends them one by one, and the next stage reads the responses in the same order.
// A 2xx is created, a 422 is a held row, anything else stops the run. n8n does not run a node that receives no items, so a stage
// with nothing to send passes a single `{ empty: true }` marker around the HTTP node (see `withMarker` and `real`).
const SENTINEL = { path: '/api/apartados/resumen' }; // harmless read used only to keep the detail lookup from running empty

const withMarker = (items) => (items.length > 0 ? items : [{ empty: true }]);
const real = (items) => items.filter((item) => !item.empty);

function detailOf(response) {
  const detail = response.body?.detail;
  if (Array.isArray(detail)) return detail.map((entry) => entry.msg || JSON.stringify(entry)).join('; ');
  return String(detail ?? 'sin detalle');
}

// 'created' for 2xx, 'rejected' for the app's 422, an Error for everything else (unreachable app, 401, 5xx).
function judge(response) {
  if (response?.error) throw new Error(`No se pudo hablar con la app: ${response.error.message || response.error}`);
  const status = response?.statusCode;
  if (status >= 200 && status < 300) return 'created';
  if (status === 422) return 'rejected';
  throw new Error(`La app respondió ${status} (${detailOf(response)}).`);
}

function paired(requests, responses) {
  if (requests.length !== responses.length) throw new Error('La app no devolvió una respuesta por cada petición; se detiene la migración.');
  return requests.map((request, index) => ({ request, response: responses[index] }));
}

function apartadoRequests(creates) {
  const requests = creates.filter((create) => create.type === 'apartado')
    .map((create) => ({ kind: 'apartado', method: 'POST', path: '/api/apartados', body: apartadoBody(create.reservation), reservation: create.reservation }));
  return requests;
}

// Abono requests for new apartados (their id comes from the response) and for apartados that already existed.
function abonoRequests(creates, apartadoCalls) {
  const requests = [];
  const heldRows = [];
  const defaults = [];
  let createdApartados = 0;
  const calls = paired(apartadoCalls.requests, apartadoCalls.responses).filter((call) => call.request.kind === 'apartado');
  for (const { request, response } of calls) {
    const reservation = request.reservation;
    if (judge(response) === 'rejected') {
      heldRows.push(...rejectionHolds(reservation, reservation.items[0], detailOf(response)));
      continue;
    }
    createdApartados += 1;
    if (reservation.items[0].defaulted) defaults.push(defaultedLabel(reservation, reservation.items[0]));
    for (const item of reservation.items.slice(1)) {
      requests.push({ kind: 'abono', method: 'POST', path: `/api/apartados/${response.body.id}/abonos`, body: abonoBody(item), reservation, item });
    }
  }
  for (const create of creates.filter((candidate) => candidate.type === 'abonos')) {
    for (const item of create.items) {
      requests.push({ kind: 'abono', method: 'POST', path: `/api/apartados/${create.apartadoId}/abonos`, body: abonoBody(item), reservation: create.reservation, item });
    }
  }
  return { requests, held: heldRows, defaults, createdApartados };
}

function resolveAbonos(abonoCalls) {
  const heldRows = [];
  const defaults = [];
  let created = 0;
  for (const { request, response } of paired(abonoCalls.requests, abonoCalls.responses).filter((call) => call.request.kind === 'abono')) {
    if (judge(response) === 'rejected') {
      heldRows.push(...rejectionHolds(request.reservation, request.item, detailOf(response)));
    } else {
      created += 1;
      if (request.item.defaulted) defaults.push(defaultedLabel(request.reservation, request.item));
    }
  }
  return { created, held: heldRows, defaults };
}

function saleRequests(sales) {
  return sales.map((sale) => ({ kind: 'venta', method: 'POST', path: '/api/ventas', body: ventaBody(sale), sale }));
}

function resolveSales(saleCalls) {
  const heldRows = [];
  let created = 0;
  for (const { request, response } of paired(saleCalls.requests, saleCalls.responses).filter((call) => call.request.kind === 'venta')) {
    if (judge(response) === 'rejected') heldRows.push(rejectedSale(request.sale, detailOf(response)));
    else created += 1;
  }
  return { created, held: heldRows };
}

// Minimal CSV reader: quoted fields ("1.842,30"), doubled quotes, CRLF or LF, BOM. Returns one object per data row.
function parseCsv(text) {
  const source = String(text).replace(/^﻿/, '');
  const records = [];
  let field = '';
  let record = [];
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i += 1; } else if (ch === '"') quoted = false; else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { record.push(field); field = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      record.push(field); field = '';
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
    } else field += ch;
  }
  if (field !== '' || record.length > 0) { record.push(field); if (record.some((value) => value !== '')) records.push(record); }
  const [header, ...rows] = records;
  if (!header) return [];
  return rows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
}

// Sales date range for the app lookup; null when there are no sales to compare.
function salesRange(sales) {
  if (sales.length === 0) return null;
  const dates = sales.map((sale) => sale.fecha).sort();
  return { desde: dates[0], hasta: dates[dates.length - 1] };
}

if (typeof module !== 'undefined') {
  module.exports = {
    MIN_ABONO_INICIAL, PAYMENT_METHODS, DEFAULT_PAYMENT, APARTADOS_COLUMNS, VENTAS_COLUMNS,
    parseDate, parseAmount, cleanName, cleanPhone, normalise, checkHeader, cleanApartados, cleanVentas, classifyVentas,
    groupReservations, applyRules, prepareMigration, findExisting, planCreates, apartadoBody, abonoBody, ventaBody,
    rejectionHolds, rejectedSale, buildReport, defaultedLabel, sortHeld,
    SENTINEL, withMarker, real, detailOf, judge, apartadoRequests, abonoRequests, resolveAbonos, saleRequests, resolveSales, parseCsv, salesRange,
  };
}
