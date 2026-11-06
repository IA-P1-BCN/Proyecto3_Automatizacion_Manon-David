// Flow 11b · a bank payment may open a reservation from a pending home request: pure logic, shared by the generator and the tests.
// Called by flow 03 before it looks at existing reservations. It answers with the same context fields flow 03 already uses
// (`decision`, `reason`), so flow 03 can send its usual review email. The AI never takes part: the payment is already extracted.

// Name rules copied from 03-match-bank-payment.js on purpose: flow 03 is not edited here and does not export them.
function normalizedWords(value) {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}
function fullNameFits(payer, customer) {
  const tokens = normalizedWords(payer), stored = normalizedWords(customer);
  return stored.length >= 2 && stored.every((word) => tokens.includes(word));
}
function abbreviatedNameFits(payer, customer) {
  const tokens = normalizedWords(payer), stored = normalizedWords(customer);
  return tokens.length === 2 && tokens[0].length > 1 && tokens[1].length === 1
    && stored.length >= 2 && tokens[0] === stored[0] && stored[1].startsWith(tokens[1]);
}

const eur = (value) => `${Number(value).toFixed(2).replace('.', ',')} €`;
const isRow = (row) => Boolean(row) && typeof row.ref === 'string' && row.ref !== '';

// "SOL-7", "sol 0007" and "SOL-0007" are the same reference.
function extractRefs(concept) {
  const found = [...String(concept || '').matchAll(/\bSOL[-\s]?(\d{1,6})\b/gi)].map((match) => `SOL-${match[1].padStart(4, '0')}`);
  return [...new Set(found)];
}

const review = (reason) => ({ decision: 'review', reason, crear: false, request: null });
const notMine = { decision: 'not_mine', reason: '', crear: false, request: null };

// `requests` are the Data Table rows, `reservations` the active reservations from the app.
// With a reference only that request is considered, and the payer must fit its name.
// Without one, the payment is taken only when exactly one pending request fits the payer and no active reservation does.
function decideRequest({ payment, requests, reservations, allowRegistration }) {
  const rows = (requests || []).filter(isRow);
  if (!payment || !Number.isFinite(payment.importe) || payment.importe <= 0) return notMine;

  const refs = extractRefs(payment.concepto);
  let request;
  if (refs.length > 1) return review('El concepto contiene varias referencias de solicitud (SOL-…). No se ha registrado nada.');
  if (refs.length === 1) {
    request = rows.find((row) => row.ref === refs[0]);
    if (!request) return review(`La referencia ${refs[0]} no existe en las solicitudes de apartado.`);
    if (request.estado !== 'pendiente') {
      return review(`La solicitud ${request.ref} está en estado «${request.estado}» y no admite este pago.`);
    }
    if (!fullNameFits(payment.ordenante, request.nombre) && !abbreviatedNameFits(payment.ordenante, request.nombre)) {
      return review(`El ordenante no coincide con la solicitud ${request.ref}. No se reasigna el pago.`);
    }
  } else {
    const requestMatches = rows.filter((row) => row.estado === 'pendiente' && fullNameFits(payment.ordenante, row.nombre));
    if (!requestMatches.length) return notMine;
    const reservationMatches = (reservations || []).filter((item) => fullNameFits(payment.ordenante, item.cliente));
    if (requestMatches.length > 1 || reservationMatches.length) {
      return review('El pago podría ser de una solicitud pendiente o de un apartado existente. Decide Marisa.');
    }
    request = requestMatches[0];
  }

  if (allowRegistration !== true) {
    return review(`Vista previa: se habría creado el apartado de la solicitud ${request.ref} con un abono inicial de ${eur(payment.importe)}.`);
  }
  return { decision: 'candidate', reason: '', crear: true, request };
}

// The request's own data plus the paid amount as the initial deposit; the app decides whether the amount is acceptable.
function buildApartadoBody(request, payment) {
  const body = {
    cliente: request.nombre, producto: request.producto, talla: String(request.talla),
    precio: Number(request.precio), abono_inicial: payment.importe, forma_pago: 'bizum',
  };
  if (String(request.telefono || '').trim()) body.telefono = String(request.telefono).trim();
  if (String(request.email || '').trim()) body.email = String(request.email).trim();
  return body;
}

// After the claim update, the table is read again: only the payment whose key is stored may go on.
function claimHolds(rows, request, paymentKey) {
  const row = (rows || []).filter(isRow).find((item) => item.ref === request.ref);
  return Boolean(row) && row.estado === 'procesando' && row.payment_key === paymentKey;
}

// `accion` tells the flow what to do with the row: confirm it, release it, or leave it alone.
function interpretCreation(response, request) {
  if (response && response.statusCode === 201 && Number.isSafeInteger(response.body && response.body.id)) {
    return { decision: 'created', reason: '', accion: 'confirmar', apartado_id: response.body.id };
  }
  if (response && [404, 409, 422].includes(response.statusCode)) {
    const detail = typeof (response.body && response.body.detail) === 'string' ? response.body.detail.slice(0, 500) : 'La aplicación ha rechazado el apartado.';
    return { decision: 'review', reason: `La aplicación no ha creado el apartado de la solicitud ${request.ref}: ${detail}`, accion: 'liberar' };
  }
  // The outcome is unknown, so the row stays «procesando» and nobody should register it by hand before checking the app.
  return {
    decision: 'uncertain', accion: 'dejar',
    reason: `No se pudo confirmar si se creó el apartado de la solicitud ${request.ref}. Revisar la aplicación antes de apuntar nada manualmente.`,
  };
}

// If the row cannot be updated after the app answered, the table is out of step with the app: say so, never hide it.
function afterRowUpdate(context, updateItem) {
  if (!updateItem || !updateItem.error) return context;
  return {
    ...context, decision: 'uncertain',
    reason: `${context.reason ? `${context.reason} ` : ''}No se pudo actualizar la solicitud ${context.request.ref} en la tabla solicitudes_apartado: revisarla a mano. Comprobar la aplicación antes de apuntar nada.`,
  };
}

// What flow 03 receives: its own context fields, without this flow's working fields.
// A payment that is not about a request goes back as it came in plus `decision: 'not_mine'`, which is what flow 03's Switch routes on.
// Nothing else is touched: flow 03 still reads fields such as `reason` and `result` on its own item, and it overwrites
// `decision` itself when it matches reservations.
function toResult(context, original) {
  if (context.decision === 'not_mine') return { ...original, decision: 'not_mine' };
  const { crear, claimed, body, accion, request, ...rest } = context;
  return { ...rest, request_ref: request ? request.ref : null, candidates: [], registration_allowed: false };
}

if (typeof module !== 'undefined') {
  module.exports = {
    extractRefs, decideRequest, buildApartadoBody, claimHolds, interpretCreation, afterRowUpdate, toResult, fullNameFits, abbreviatedNameFits,
  };
}
