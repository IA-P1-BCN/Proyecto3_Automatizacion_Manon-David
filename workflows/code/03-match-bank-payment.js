'use strict';

function normalizedWords(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
}

function fullNameFits(payer, customer) {
  const tokens = normalizedWords(payer), stored = normalizedWords(customer);
  return stored.length >= 2 && stored.every(word => tokens.includes(word));
}

function abbreviatedNameFits(payer, customer) {
  const tokens = normalizedWords(payer), stored = normalizedWords(customer);
  return tokens.length === 2 && tokens[0].length > 1 && tokens[1].length === 1
    && stored.length >= 2 && tokens[0] === stored[0] && stored[1].startsWith(tokens[1]);
}

function productFits(concept, product) {
  // Deliberately restricted morphology, not fuzzy matching or arbitrary stemming.
  const singular = word => ({ deportivas:'deportiva', botas:'bota', zuecos:'zueco',
    mocasines:'mocasin', sandalias:'sandalia', zapatillas:'zapatilla', zapatos:'zapato' }[word] || word);
  const words = normalizedWords(concept).map(singular);
  return normalizedWords(product).map(singular).some(word => word.length >= 4 && words.includes(word));
}

function checkEligibility(reservation, payment, today) {
  if (!reservation || !Number.isSafeInteger(reservation.id)) throw new Error('Respuesta de apartado no válida.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reservation.fecha_limite || '')
      || typeof reservation.pendiente !== 'number' || !Number.isFinite(reservation.pendiente)) {
    throw new Error('Faltan el saldo o el plazo de la aplicación.');
  }
  if (reservation.estado !== 'activo') return 'El apartado no está activo y no admite abonos.';
  if (reservation.fecha_limite < today) return 'El plazo del apartado ha vencido.';
  if (Math.round(payment.importe * 100) > Math.round(reservation.pendiente * 100)) {
    return 'El importe supera el pendiente indicado por la aplicación.';
  }
  return null;
}

function matchReservation(payment, reservations, today) {
  if (!Array.isArray(reservations) || reservations.some(r => !Number.isSafeInteger(r.id))) {
    throw new Error('La aplicación no devolvió una lista válida de apartados.');
  }
  const review = (reason, candidates = []) => ({decision:'review', reason, candidates, registration_allowed:false});
  if (!payment || !Number.isFinite(payment.importe) || payment.importe <= 0) return review('Datos del pago incompletos.');
  if (!payment.concepto?.trim()) return review('Falta el concepto: Marisa debe identificar el pago.',
    reservations.filter(r => normalizedWords(payment.ordenante).some(w => w.length>2 && normalizedWords(r.cliente).includes(w))));
  const references = [...payment.concepto.matchAll(/\bapartado\s*(?:n[º°o.]?\s*)?[#:]?\s*(\d+)\b/gi)]
    .map(match => Number(match[1]));
  const unique = [...new Set(references)];
  let candidates;
  if (unique.length > 1) return review('El concepto contiene varios números de apartado.');
  if (unique.length === 1) {
    candidates = reservations.filter(r => r.id === unique[0]);
    if (!candidates.length) return review('El número de apartado indicado no existe.');
    const r = candidates[0];
    if (!fullNameFits(payment.ordenante,r.cliente) && !abbreviatedNameFits(payment.ordenante,r.cliente)) {
      return review('El ordenante no coincide con el apartado indicado. No se reasigna el pago.', candidates);
    }
  } else {
    // Do not discard overpaid/overdue candidates to manufacture a unique identity.
    candidates = reservations.filter(r => fullNameFits(payment.ordenante,r.cliente));
    if (!candidates.length) candidates = reservations.filter(r => abbreviatedNameFits(payment.ordenante,r.cliente)
      && productFits(payment.concepto,r.producto));
  }
  if (!candidates.length) return review('No se ha encontrado un apartado claramente identificado.');
  if (candidates.length !== 1) return review('Hay varios apartados posibles. No se ha registrado nada.', candidates);
  const reservation = candidates[0];
  const reason = checkEligibility(reservation,payment,today);
  if (reason) return review(reason,candidates);
  return {decision:'register', reason:'Apartado identificado y elegible según la API.',
    reservation, candidates, registration_allowed:true};
}

function assertPaymentSafetyCapability(response) {
  const operation = response?.body?.paths?.['/api/apartados/{apartado_id}/abonos']?.post;
  const headers = operation?.parameters?.filter(p => p.in === 'header').map(p => p.name.toLowerCase()) || [];
  if (response?.statusCode !== 200 || !headers.includes('idempotency-key')
      || !headers.includes('payment-notice-fingerprint')) {
    throw new Error('La tienda aún no tiene instalada la protección de HU-03. No se permite registrar pagos.');
  }
}

function interpretRegistration(response, context) {
  if (response.statusCode === 201 && response.body?.id === context.reservation.id) {
    return {...context, decision:'registered', registration_allowed:false, registered:response.body};
  }
  if ([404,409,422].includes(response.statusCode)) return {...context, decision:'review',
    registration_allowed:false, reason: typeof response.body?.detail === 'string'
      ? response.body.detail.slice(0,500) : 'La aplicación ha rechazado el pago. Revisar los datos.'};
  // Network failures can have an uncertain commit; never blindly retry or register manually.
  return {...context, decision:'uncertain', registration_allowed:false,
    reason:'No se pudo confirmar el registro. Revisar el apartado antes de apuntar nada manualmente. Reintentar solo con la misma clave y datos.'};
}

function reviewEmail(context) {
  const payment = context.payment || {};
  const eur = value => typeof value === 'number' ? value.toLocaleString('es-ES',{style:'currency',currency:'EUR'}) : 'no disponible';
  return {
    subject: context.decision === 'uncertain' ? 'Paso Firme: pago pendiente de comprobación' : 'Paso Firme: revisar un aviso de pago',
    body: [
      'Marisa, este aviso necesita revisión.',
      `Motivo: ${context.reason || 'No se ha podido validar la extracción.'}`,
      `Ordenante: ${payment.ordenante || 'no disponible'}`,
      `Importe: ${eur(payment.importe)}`,
      `Concepto: ${payment.concepto || 'no disponible'}`,
      `Tipo real: ${payment.tipo || 'no disponible'} (las transferencias se registran como bizum).`,
      'Candidatos:',
      ...(context.candidates || []).slice(0,20).map(r => `Apartado ${r.id}: ${r.cliente}; ${r.producto}; talla ${r.talla || '-'}; pendiente ${eur(r.pendiente)}; plazo ${r.fecha_limite}; teléfono ${r.telefono || 'no disponible'}; correo ${r.email || 'no disponible'}`),
      context.decision === 'uncertain' ? 'No registrar manualmente hasta comprobar si el abono ya existe.'
        : 'Comprueba el caso y, si corresponde, registra el abono manualmente en la aplicación. No respondas al correo para autorizar un registro automático.',
      'No vuelvas a procesar automáticamente un aviso que hayas resuelto manualmente.',
    ].join('\n'),
  };
}

if (typeof module !== 'undefined') module.exports = {matchReservation,checkEligibility,assertPaymentSafetyCapability,interpretRegistration,reviewEmail};
