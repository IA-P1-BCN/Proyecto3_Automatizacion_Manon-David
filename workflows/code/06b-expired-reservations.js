// Flow 06b · Expired Reservations: pure logic shared by the generator and the tests.
// Pasted ahead of each Code node's own lines. No credentials, no network, no time zones: Madrid's "today" is passed in.
// The app is the source of truth: the voucher code and amount are shown as the app returned them, never calculated.

function validDate(value) {
  const parsed = new Date(`${value}T00:00:00Z`);
  // An impossible date such as 2026-13-01 gives an Invalid Date, which must not escape as a RangeError.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('La fecha debe ser una fecha válida YYYY-MM-DD.');
  }
  return value;
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

function shoesOf(reservation) {
  const size = String(reservation.talla ?? '').trim();
  return size ? `«${reservation.producto}» (talla ${size})` : `«${reservation.producto}»`;
}

// Reservations to expire: still `activo` and with the deadline strictly before the run date (the deadline day itself is valid).
function selectExpired({ reservations, today }) {
  validDate(today);
  if (!Array.isArray(reservations)) throw new Error('La API no devolvió una lista de apartados.');
  const selected = [];
  for (const reservation of reservations) {
    if (reservation?.estado !== 'activo') continue;
    if (!Number.isSafeInteger(reservation.id)) throw new Error('La API devolvió un apartado sin número válido.');
    if (validDate(String(reservation.fecha_limite)) < today) selected.push({ id: reservation.id });
  }
  return selected;
}

function isVoucher(vale) {
  return Boolean(vale) && typeof vale.codigo === 'string' && vale.codigo !== '' && typeof vale.importe === 'number' && Number.isFinite(vale.importe);
}

// `results[i]` is the Expire output for `selected[i]`; anything that is not a `vencido` reservation with its voucher is a failure.
function collectExpiries(selected, results) {
  if (!Array.isArray(selected) || !Array.isArray(results) || selected.length !== results.length) {
    throw new Error('El número de respuestas de la API no coincide con los apartados a vencer.');
  }
  const expired = [];
  const failures = [];
  selected.forEach((item, i) => {
    const { apartado, vale } = results[i] ?? {};
    if (apartado?.id === item.id && apartado.estado === 'vencido' && isVoucher(vale)) {
      expired.push({ apartado, vale });
    } else {
      failures.push({ id: item.id });
    }
  });
  return { expired, failures };
}

function customerEmail({ apartado, vale }) {
  return {
    subject: `Tu apartado ha vencido: aquí tienes tu vale · ${apartado.producto}`,
    body: [
      `Hola ${apartado.cliente},`,
      '',
      `El plazo de tu apartado de ${shoesOf(apartado)} terminó el ${formatDate(apartado.fecha_limite)} y ha vencido.`,
      '',
      'Lo que habías abonado se ha convertido en un vale de compra:',
      `Código del vale: ${vale.codigo}`,
      `Importe del vale: ${formatEuros(vale.importe)}`,
      '',
      'El vale es crédito para comprar en la tienda; no se devuelve en dinero.',
      '',
      'Gracias por confiar en Zapatería Paso Firme.',
    ].join('\n'),
  };
}

// One item per expired reservation. `send` is false when the customer has no usable email (the shop summary tells Marisa).
function planNotifications({ expired, failures }) {
  const planned = expired.map(({ apartado, vale }) => {
    const send = hasUsableEmail(apartado.email);
    return {
      send,
      to: send ? apartado.email.trim() : '',
      ...(send ? customerEmail({ apartado, vale }) : { subject: '', body: '' }),
      apartado,
      vale,
    };
  });
  return { planned, failures };
}

// Flow 09 (consent) reads `email`: only the customers about to be emailed carry one.
function withConsentEmail(planned) {
  return planned.map((item) => ({ ...item, email: item.send ? item.to : '' }));
}

// A customer without consent is handled like one without email: nothing is sent and Marisa gets the voucher in the summary.
function applyConsent(checked) {
  return checked.map(({ permitido, razon, email, ...item }) => (
    item.send && permitido !== true ? { ...item, send: false, to: '', motivo: 'sin_consentimiento' } : item
  ));
}

function summaryLine({ apartado, vale }) {
  return `- ${shoesOf(apartado)} · apartado nº ${apartado.id} · ${apartado.cliente} · vale ${vale.codigo} (${formatEuros(vale.importe)})`;
}

// `sendResults[i]` is the Send Email output for the i-th planned item with `send: true`; an `error` field means it was rejected.
function buildSummary({ planned, sendResults, today, shopAddress }) {
  validDate(today);
  const toSend = planned.filter((item) => item.send);
  if (!Array.isArray(sendResults) || sendResults.length !== toSend.length) {
    throw new Error('El número de resultados de envío no coincide con los emails previstos.');
  }
  const bounced = new Set(toSend.filter((_, i) => sendResults[i]?.error).map((item) => item.apartado.id));
  const byHand = planned.filter((item) => !item.send || bounced.has(item.apartado.id));
  const lines = [
    'Estos apartados han vencido y sus zapatos vuelven a la venta:',
    '',
    ...planned.map(summaryLine),
  ];
  if (byHand.length) {
    lines.push('', 'Clientes a avisar a mano (no se les pudo enviar el email):');
    for (const item of byHand) {
      const phone = item.apartado.telefono ? ` · teléfono ${item.apartado.telefono}` : '';
      const reason = item.send ? 'el envío falló' : item.motivo === 'sin_consentimiento' ? 'sin consentimiento para recibir mensajes automáticos' : 'sin email válido';
      lines.push(`- ${item.apartado.cliente} (apartado nº ${item.apartado.id})${phone} · vale ${item.vale.codigo} · motivo: ${reason}`);
    }
  }
  return {
    to: shopAddress,
    subject: `Apartados vencidos el ${formatDate(today)}: ${planned.length} vuelven a la venta`,
    body: lines.join('\n'),
    bounced: [...bounced],
  };
}

// Fails loudly (after everything else was processed) so the Error Workflow alerts. Only ids and counts, no personal data.
function verifyResult({ failures, bounced, summaryFailed }) {
  const problems = [];
  if (failures.length) problems.push(`no se pudieron vencer los apartados nº ${failures.map((f) => f.id).join(', ')}`);
  if (bounced.length) problems.push(`falló el email al cliente de los apartados nº ${bounced.join(', ')} (su vale va en el resumen a la tienda)`);
  if (summaryFailed) problems.push('no se pudo enviar el resumen a la tienda');
  if (problems.length) throw new Error(`Vencimientos incompletos: ${problems.join('; ')}.`);
}

if (typeof module !== 'undefined') {
  module.exports = { withConsentEmail, applyConsent, runInput, selectExpired, collectExpiries, planNotifications, buildSummary, verifyResult };
}
