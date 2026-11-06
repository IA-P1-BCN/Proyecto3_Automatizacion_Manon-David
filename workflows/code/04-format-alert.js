// Flow 04 · Large Sale Alert — "Parse And Format" Code node.
// Pasted as-is into the Code node (mode: Run Once for All Items); also loaded by the tests.
// Validates the threshold and the sale, and formats the alert. The comparison itself is done by the IF node.

function formatEuros(amount) {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// "2026-10-20" -> "20/10/2026", without going through Date so no timezone can shift the day.
function formatDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  return `${day}/${month}/${year}`;
}

// Dot decimals only: "150" and "99.99" are valid; "", "abc", "99,99" and "-5" are not.
function parseThreshold(rawThreshold) {
  const text = String(rawThreshold ?? '').trim();
  if (!/^\d+(\.\d+)?$/.test(text)) {
    throw new Error('TIENDA_UMBRAL_VENTA_GRANDE no está definida o no es un número válido (usa punto decimal, p. ej. 150)');
  }
  return Number(text);
}

function buildAlert(datos, rawThreshold) {
  const umbral = parseThreshold(rawThreshold);
  if (!datos || typeof datos !== 'object') throw new Error('El aviso venta.registrada llegó sin datos');
  if (typeof datos.importe !== 'number' || !Number.isFinite(datos.importe)) {
    throw new Error('El aviso venta.registrada llegó sin «importe» válido');
  }

  return {
    importe: datos.importe,
    umbral,
    subject: `Venta grande: ${formatEuros(datos.importe)} · ${datos.concepto}`,
    body: [
      'Se ha registrado una venta por encima del umbral de aviso.',
      '',
      `Concepto:       ${datos.concepto}`,
      `Importe:        ${formatEuros(datos.importe)}`,
      `Forma de pago: ${datos.forma_pago}`,
      `Fecha:          ${formatDate(datos.fecha)}`,
    ].join('\n'),
  };
}

if (typeof module !== 'undefined') module.exports = { buildAlert };
// Inside n8n there is no `module`; `$input` exists only there.
if (typeof $input !== 'undefined') {
  return [{ json: buildAlert($input.first().json.datos, $env.TIENDA_UMBRAL_VENTA_GRANDE) }];
}
