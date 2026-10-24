// Pure logic shared by the generator and tests. No credentials or network access.
const METHODS = ['efectivo', 'tarjeta', 'bizum', 'otros'];
const MONEY_COLUMNS = ['ventas_efectivo', 'ventas_tarjeta', 'ventas_bizum', 'ventas_otros',
  'abonos_efectivo', 'abonos_tarjeta', 'abonos_bizum', 'abonos_otros', 'total_ventas', 'total_abonos', 'total'];
const COLUMNS = ['fecha', ...MONEY_COLUMNS];

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('La fecha debe ser una fecha válida YYYY-MM-DD.');
  }
  return value;
}

function inputDate(input, today) {
  validDate(today);
  const scheduled = input.mode === 'scheduled';
  const fecha = validDate(scheduled ? today : String(input.fecha || ''));
  if (fecha > today) throw new Error('No se puede cerrar una fecha futura.');
  if (!scheduled && input.mode !== 'manual') throw new Error('Modo de cierre no válido.');
  if (input.send_email !== undefined && typeof input.send_email !== 'boolean') throw new Error('send_email debe ser booleano.');
  return { fecha, send_email: scheduled || input.send_email === true, mode: input.mode };
}

function cents(value) {
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Importe inválido o precisión superior a céntimos.');
  const [whole, decimals = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new Error('Importe fuera del rango seguro.');
  return result;
}

function sumSafe(a, b) {
  const result = a + b;
  if (!Number.isSafeInteger(result)) throw new Error('Total fuera del rango seguro.');
  return result;
}

function decimal(value) { return `${Math.floor(value / 100)},${String(value % 100).padStart(2, '0')}`; }

function calculate(fecha, sales, deposits) {
  validDate(fecha);
  const row = { fecha, ...Object.fromEntries(MONEY_COLUMNS.map((key) => [key, 0])) };
  let count = 0;
  for (const [source, records] of [['ventas', sales], ['abonos', deposits]]) {
    if (!Array.isArray(records)) throw new Error('La API no devolvió una lista de movimientos.');
    const seen = new Set();
    for (const record of records) {
      if (record.fecha !== fecha || !Number.isSafeInteger(record.id) || seen.has(record.id)) {
        throw new Error('Movimiento con fecha/id incorrectos o duplicado en la API.');
      }
      seen.add(record.id);
      const method = METHODS.includes(record.forma_pago) ? record.forma_pago : 'otros';
      const amount = cents(record.importe);
      row[`${source}_${method}`] = sumSafe(row[`${source}_${method}`], amount);
      row[`total_${source}`] = sumSafe(row[`total_${source}`], amount);
      count++;
    }
  }
  row.total = sumSafe(row.total_ventas, row.total_abonos);
  const displayDate = fecha.split('-').reverse().join('/');
  const lines = [`Cierre de caja del ${displayDate}`, '',
    ...(count ? [] : ['No hubo movimientos.', '']),
    'Forma de pago | Ventas | Abonos | Total'];
  for (const method of METHODS) {
    lines.push(`${method}: ${decimal(row[`ventas_${method}`])} € | ${decimal(row[`abonos_${method}`])} € | ${decimal(row[`ventas_${method}`] + row[`abonos_${method}`])} €`);
  }
  lines.push('', `Ventas directas: ${decimal(row.total_ventas)} €`, `Abonos: ${decimal(row.total_abonos)} €`,
    `Total cobrado: ${decimal(row.total)} €`, '', 'Bizum incluye transferencias bancarias.',
    'Importes consultados a la API en este cierre. Los movimientos posteriores a las 23:55 requieren recalcular esa fecha.',
    'El correo no confirma por sí solo que el histórico se haya guardado; un fallo de guardado genera una alerta independiente.');
  return { row, count, subject: `Cierre de caja — ${displayDate}`, body: lines.join('\n') };
}

function parseHistory(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Histórico vacío o inválido; no se sobrescribirá.');
  const lines = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  if (lines.shift() !== COLUMNS.join(';')) throw new Error('Cabecera CSV no reconocida; no se sobrescribirá.');
  const result = new Map();
  for (const line of lines) {
    const values = line.split(';');
    if (values.length !== COLUMNS.length) throw new Error('Fila CSV dañada.');
    const fecha = validDate(values[0]);
    if (result.has(fecha)) throw new Error('Fechas duplicadas en el histórico.');
    const row = { fecha };
    MONEY_COLUMNS.forEach((key, i) => {
      if (!/^\d+,\d{2}$/.test(values[i + 1])) throw new Error('Importe CSV no válido.');
      row[key] = cents(values[i + 1].replace(',', '.'));
    });
    for (const source of ['ventas', 'abonos']) {
      if (METHODS.reduce((sum, method) => sumSafe(sum, row[`${source}_${method}`]), 0) !== row[`total_${source}`]) throw new Error('Totales históricos inconsistentes.');
    }
    if (sumSafe(row.total_ventas, row.total_abonos) !== row.total) throw new Error('Total histórico inconsistente.');
    result.set(fecha, row);
  }
  return result;
}

function upsertHistory(existing, row) {
  const rows = existing === null ? new Map() : parseHistory(existing);
  rows.set(row.fecha, row);
  const lines = [COLUMNS.join(';')];
  for (const [, record] of [...rows].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push([record.fecha, ...MONEY_COLUMNS.map((key) => decimal(record[key]))].join(';'));
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

function findHistory(pages) {
  if (!Array.isArray(pages) || !pages.length) throw new Error('No hay respuesta del listado kDrive.');
  const matches = [];
  for (let i = 0; i < pages.length; i++) {
    const response = pages[i];
    if (response.statusCode !== 200 || response.body?.result !== 'success' || !Array.isArray(response.body.data)) throw new Error('No se pudo listar kDrive; no se creará ningún fichero.');
    if (typeof response.body.has_more !== 'boolean' || (i === pages.length - 1 && response.body.has_more)) throw new Error('Listado kDrive incompleto; no se creará ningún fichero.');
    matches.push(...response.body.data.filter((file) => file.name === 'basedatos.csv'));
  }
  if (matches.length > 1) throw new Error('Hay varios históricos con el mismo nombre.');
  const file = matches[0];
  if (file && (file.type !== 'file' || !['ok', null].includes(file.status) || !Number.isSafeInteger(file.id) || !/^[a-fA-F0-9]{16,32}$/.test(file.etag || ''))) throw new Error('El histórico está bloqueado o no tiene ETag válido; no se sobrescribirá.');
  return file || null;
}

if (typeof module !== 'undefined') module.exports = { COLUMNS, cents, inputDate, calculate, parseHistory, upsertHistory, findHistory };
