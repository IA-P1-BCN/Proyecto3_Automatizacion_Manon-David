// Flow 09 · consent decision: pure, shared by the generators and the tests.
// The register (Data Table `consentimientos`) holds only email, estado, fecha and origen; no name, phone or balance.

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Key of the register: trimmed and lowercase. Anything that is not an address gives null.
function normaliseEmail(email) {
  if (typeof email !== 'string') return null;
  const clean = email.trim().toLowerCase();
  return EMAIL_FORMAT.test(clean) ? clean : null;
}

// `rows` are the register's rows; an item with `error` stands for an unreadable table and blocks the send.
// With `registrar` (a new reservation with an email) a missing row is created: giving an email in the shop is the consent.
// A withdrawn row is never overwritten.
function decideConsent(email, rows, { registrar = false, origen = 'tienda', hoy = '' } = {}) {
  const key = normaliseEmail(email);
  if (!key) {
    const empty = typeof email !== 'string' || email.trim() === '';
    return { permitido: false, razon: empty ? 'sin_email' : 'email_invalido', insertar: null };
  }
  if (!Array.isArray(rows) || rows.some((row) => row && row.error)) {
    return { permitido: false, razon: 'registro_ilegible', insertar: null };
  }
  const row = rows.find((candidate) => normaliseEmail(candidate && candidate.email) === key);
  if (row) {
    return row.estado === 'activo'
      ? { permitido: true, razon: 'activo', insertar: null }
      : { permitido: false, razon: 'consentimiento_retirado', insertar: null };
  }
  if (registrar) {
    return { permitido: true, razon: 'registrado', insertar: { email: key, estado: 'activo', fecha: hoy, origen } };
  }
  return { permitido: false, razon: 'sin_consentimiento', insertar: null };
}

// Backfill: the distinct valid emails of the app's reservations that the register does not hold yet.
function missingConsents(reservations, rows, { hoy = '', origen = 'tienda (migración)' } = {}) {
  const known = new Set((rows || []).map((row) => normaliseEmail(row && row.email)).filter(Boolean));
  const result = [];
  for (const reservation of reservations || []) {
    const key = normaliseEmail(reservation && reservation.email);
    if (!key || known.has(key)) continue;
    known.add(key);
    result.push({ email: key, estado: 'activo', fecha: hoy, origen });
  }
  return result;
}

if (typeof module !== 'undefined') {
  module.exports = { normaliseEmail, decideConsent, missingConsents };
}
