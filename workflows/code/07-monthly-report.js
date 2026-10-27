// Pure monthly report logic. No network, credentials or business writes.
const REPORT_METHODS = ['efectivo', 'tarjeta', 'bizum', 'otros'];

function reportDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha inválida: se requiere YYYY-MM-DD.');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < '1900-01-01') throw new Error('Fecha de calendario inválida.');
  return value;
}

function madridDate(instant) {
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new Error('Instante de consulta inválido.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(p => [p.type, p.value]));
  return reportDate(`${parts.year}-${parts.month}-${parts.day}`);
}

function previousMonth(today) {
  reportDate(today);
  const [year, month] = today.split('-').map(Number);
  return `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`;
}

function reportGuardInput(input) {
  if (input?.mode === 'scheduled' && input.scheduled_execution !== true) {
    throw new Error('Inicio programado bloqueado en una prueba manual. Selecciona Manual Report Preview; no se ha enviado ningún correo.');
  }
  return input;
}

function reportPeriod(input, today) {
  reportDate(today);
  if (!input || !['manual', 'scheduled'].includes(input.mode)) throw new Error('Modo de informe inválido.');
  for (const key of ['send_email', 'include_pdf']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`${key} debe ser booleano.`);
  }
  const month = input.mode === 'scheduled' ? previousMonth(today) : input.month;
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('El mes debe tener formato YYYY-MM.');
  const from = reportDate(`${month}-01`);
  if (month >= today.slice(0, 7)) throw new Error('Seleccione un mes ya terminado.');
  const [year, number] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { mode: input.mode, month, desde: from, hasta: `${month}-${lastDay}`, send_email: input.mode === 'scheduled' || input.send_email === true, include_pdf: input.include_pdf === true };
}

function reportCents(value, positive = false) {
  if (!['number', 'string'].includes(typeof value) || !/^\d+(?:\.\d{1,2})?$/.test(String(value))) throw new Error('Importe inválido o con más de dos decimales.');
  const [whole, fraction = ''] = String(value).split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 0 || (positive && amount === 0)) throw new Error('Importe fuera de rango.');
  return amount;
}

function reportAdd(a, b) {
  const value = a + b;
  if (!Number.isSafeInteger(value)) throw new Error('Total fuera de rango seguro.');
  return value;
}

function reportList(records, label) {
  if (!Array.isArray(records)) throw new Error(`La API no devolvió una lista completa: ${label}.`);
  const seen = new Set();
  for (const row of records) {
    if (!row || !Number.isSafeInteger(row.id) || row.id <= 0 || seen.has(row.id)) throw new Error(`ID inválido o duplicado: ${label}.`);
    seen.add(row.id);
    reportDate(row.fecha);
  }
  return records;
}

function reportResponse(response, label, requireTotal = false) {
  if (response?.statusCode !== 200) throw new Error(`No se pudo consultar la API: ${label}.`);
  const rows = reportList(response.body, label);
  const total = Object.entries(response.headers || {}).find(([key]) => key.toLowerCase() === 'x-total-count')?.[1];
  if ((requireTotal && total === undefined) || (total !== undefined && (!/^\d+$/.test(String(total)) || Number(total) !== rows.length))) throw new Error(`Respuesta incompleta de la API: ${label}.`);
  return rows;
}

function reportCalculate(period, sources, consultedAt) {
  // Validate independently even when called without the n8n HTTP wrapper.
  const today = madridDate(consultedAt);
  const expected = reportPeriod({ mode: 'manual', month: period.month }, today);
  if (period.desde !== expected.desde || period.hasta !== expected.hasta) throw new Error('Límites del periodo inconsistentes.');
  const inside = value => value >= period.desde && value <= period.hasta;
  const reservations = reportList(sources.reservations, 'apartados');
  const history = reportList(sources.history, 'histórico de abonos');
  const vouchers = reportList(sources.vouchers, 'vales');
  const byId = new Map(reservations.map(row => [row.id, row]));
  const latest = new Map();
  const historicalById = new Map();
  for (const row of history) {
    const reservation = byId.get(row.apartado_id);
    if (!reservation || row.fecha < reservation.fecha || row.fecha > today) throw new Error('Abono histórico sin apartado o con fecha inconsistente.');
    reportCents(row.importe, true);
    if (typeof row.forma_pago !== 'string' || !row.forma_pago.trim()) throw new Error('Forma de pago ausente en abono histórico.');
    if (!latest.has(row.apartado_id) || row.fecha > latest.get(row.apartado_id)) latest.set(row.apartado_id, row.fecha);
    historicalById.set(row.id, row);
  }
  const voucherByReservation = new Map();
  for (const row of vouchers) {
    const reservation = byId.get(row.apartado_id);
    if (!reservation || reservation.estado !== 'vencido' || voucherByReservation.has(row.apartado_id) || row.fecha > today || row.fecha < reservation.fecha) throw new Error('Vale sin apartado vencido, duplicado o con fecha inconsistente.');
    reportCents(row.importe, true);
    voucherByReservation.set(row.apartado_id, row);
  }
  const counts = { nuevos: 0, liquidados: 0, vencidos: 0, activos_actuales: 0 };
  let pending = 0;
  for (const row of reservations) {
    if (!['activo', 'liquidado', 'vencido'].includes(row.estado) || row.fecha > today) throw new Error('Estado o fecha de apartado inválidos.');
    if (inside(row.fecha)) counts.nuevos++;
    if (row.estado === 'activo') {
      pending = reportAdd(pending, reportCents(row.pendiente));
      counts.activos_actuales++;
    } else if (row.estado === 'liquidado') {
      if (!latest.has(row.id)) throw new Error('Apartado liquidado sin fecha de abono verificable.');
      if (inside(latest.get(row.id))) counts.liquidados++;
    } else {
      const voucher = voucherByReservation.get(row.id);
      if (!voucher) throw new Error('Apartado vencido sin fecha de vale verificable.');
      if (inside(voucher.fecha)) counts.vencidos++;
    }
  }
  const methods = Object.fromEntries(REPORT_METHODS.map(key => [key, { ventas: 0, abonos: 0, total: 0 }]));
  const totals = { ventas: 0, abonos: 0, total: 0 };
  let movementCount = 0;
  for (const [source, list] of [['ventas', sources.sales], ['abonos', sources.deposits]]) {
    for (const row of reportList(list, source)) {
      if (!inside(row.fecha)) throw new Error('Movimiento fuera del mes solicitado.');
      if (typeof row.forma_pago !== 'string' || !row.forma_pago.trim()) throw new Error('Movimiento sin forma de pago.');
      if (source === 'abonos') {
        const original = historicalById.get(row.id);
        if (!original || ['apartado_id', 'fecha', 'forma_pago'].some(key => row[key] !== original[key]) || reportCents(row.importe, true) !== reportCents(original.importe, true)) throw new Error('Abonos del mes e histórico inconsistentes; repetir la consulta.');
      }
      const amount = reportCents(row.importe, true);
      const method = REPORT_METHODS.includes(row.forma_pago) ? row.forma_pago : 'otros';
      methods[method][source] = reportAdd(methods[method][source], amount);
      methods[method].total = reportAdd(methods[method].total, amount);
      totals[source] = reportAdd(totals[source], amount);
      movementCount++;
    }
  }
  const monthlyIds = new Set(sources.deposits.map(row => row.id));
  if (history.some(row => inside(row.fecha) && !monthlyIds.has(row.id))) throw new Error('Listado mensual de abonos incompleto o modificado durante la consulta.');
  totals.total = reportAdd(totals.ventas, totals.abonos);
  return { month: period.month, desde: period.desde, hasta: period.hasta, consulted_at: new Date(consultedAt).toISOString(), methods, totals, pending_cents: pending, counts, movement_count: movementCount };
}

function reportEscape(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function reportMoney(cents) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error('Importe de presentación inválido.');
  return `${Math.floor(cents / 100).toLocaleString('es-ES')},${String(cents % 100).padStart(2, '0')} €`;
}

function reportRender(report, pdfWarning = false) {
  const date = new Date(`${report.month}-01T12:00:00Z`);
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(date);
  const consulted = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' }).format(new Date(report.consulted_at));
  const e = reportEscape;
  const money = value => e(reportMoney(value));
  const label = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', bizum: 'Bizum (incluye transferencias)', otros: 'Otros métodos' };
  const rows = REPORT_METHODS.map(key => `<tr><th scope="row">${label[key]}</th><td>${money(report.methods[key].ventas)}</td><td>${money(report.methods[key].abonos)}</td><td>${money(report.methods[key].total)}</td></tr>`).join('');
  const body = `<h1>Paso Firme · Informe mensual</h1><h2>${e(monthLabel)}</h2>
<p>Periodo: ${e(report.desde.split('-').reverse().join('/'))} – ${e(report.hasta.split('-').reverse().join('/'))} (Europe/Madrid).</p>
${report.movement_count ? '' : '<p><strong>No hubo movimientos en este mes.</strong></p>'}
<h2>Dinero cobrado durante el mes</h2><table><thead><tr><th>Forma de pago</th><th>Ventas directas</th><th>Abonos</th><th>Total cobrado</th></tr></thead><tbody>${rows}<tr><th>Total</th><td>${money(report.totals.ventas)}</td><td>${money(report.totals.abonos)}</td><td><strong>${money(report.totals.total)}</strong></td></tr></tbody></table>
<p>Los abonos incluyen los iniciales una sola vez. Bizum incluye transferencias. Estos importes son cobros, no beneficios.</p>
<h2>Pendiente de cobro actual: ${money(report.pending_cents)}</h2><p>${report.counts.activos_actuales} apartados activos. Consultado el ${e(consulted)} (Europe/Madrid). Es el saldo actual de la consulta, no el saldo histórico al cierre del mes.</p>
<h2>Apartados del mes</h2><table><thead><tr><th>Nuevos</th><th>Liquidados</th><th>Vencidos</th></tr></thead><tbody><tr><td>${report.counts.nuevos}</td><td>${report.counts.liquidados}</td><td>${report.counts.vencidos}</td></tr></tbody></table>
<p><strong>Cómo se cuentan:</strong> nuevos por fecha de creación; liquidados (totalmente pagados) por la fecha del último abono de los que ahora constan como liquidados; vencidos por la fecha del vale emitido al cerrarlos, no por su fecha límite.</p>
<p>La app no guarda una fecha específica de liquidación. Los pagos antiguos importados se atribuyen a su fecha contable y pueden modificar informes anteriores. Liquidado no significa que los zapatos se hayan recogido. Las consultas no son una fotografía simultánea de toda la app.</p>
${pdfWarning ? '<p><strong>Aviso: no se ha podido generar el PDF. La tabla de este correo contiene el informe completo.</strong></p>' : ''}`;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe mensual ${e(report.month)}</title><style>body{font:14px Arial,sans-serif;color:#203040;line-height:1.5;max-width:850px;margin:24px auto;padding:12px}h1{color:#195b58}h2{font-size:18px;margin-top:24px}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{padding:9px;border:1px solid #ccd8da;text-align:right}th{background:#edf5f4}th:first-child{text-align:left}tr{break-inside:avoid}@page{size:A4;margin:15mm}h2{break-after:avoid}</style></head><body>${body}</body></html>`;
  return { subject: `Paso Firme · Informe mensual — ${monthLabel}`, html, pdf_filename: `paso-firme-monthly-report-${report.month}.pdf` };
}

function reportShouldSend(period, state) {
  return period.send_email === true && !(period.mode === 'scheduled' && state?.sent_months?.[period.month]);
}

function reportRemember(state, period, messageId) {
  if (typeof messageId !== 'string' || !messageId.trim()) throw new Error('SMTP no confirmó el envío; revisar antes de repetir.');
  if (period.mode === 'scheduled') {
    state.sent_months ||= {};
    state.sent_months[period.month] = true;
  }
}

if (typeof module !== 'undefined') module.exports = { REPORT_METHODS, reportDate, madridDate, previousMonth, reportGuardInput, reportPeriod, reportCents, reportAdd, reportResponse, reportCalculate, reportEscape, reportMoney, reportRender, reportShouldSend, reportRemember };
