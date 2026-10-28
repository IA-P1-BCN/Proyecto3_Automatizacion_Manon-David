// Flow 00 · event body validation: pure, shared by the router generator and the tests.
// A reason names the field and the problem only; it never repeats a value from the payload (names and emails are personal data).

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

// An empty email is allowed (flows 01 and 02 warn the shop); a present one must look like an address.
function emailProblem(datos) {
  const email = datos.email;
  if (email === undefined || email === null || email === '') return null;
  if (typeof email !== 'string' || !EMAIL_FORMAT.test(email.trim())) return 'datos.email no es un email válido';
  return null;
}

const idProblem = (d) => (isNumber(d.id) ? null : 'datos.id debe ser un número');
const amountProblem = (d, field) => (isNumber(d[field]) ? null : `datos.${field} debe ser un número`);

// What each routed event must carry, from docs/guia-de-la-app.md. Events the router does not know pass through.
const RULES = {
  'apartado.creado': (d) => idProblem(d) || amountProblem(d, 'precio') || emailProblem(d),
  'abono.registrado': (d) => idProblem(d) || amountProblem(d, 'importe') || emailProblem(d),
  'venta.registrada': (d) => amountProblem(d, 'importe'),
};

function validateEvent(body) {
  if (!isObject(body)) return { ok: false, reason: 'el cuerpo no es un objeto JSON' };
  if (typeof body.evento !== 'string' || body.evento.trim() === '') return { ok: false, reason: 'falta evento o no es texto' };
  if (!isObject(body.datos)) return { ok: false, reason: 'datos no es un objeto' };
  const rule = RULES[body.evento];
  const problem = rule ? rule(body.datos) : null;
  if (problem) return { ok: false, reason: problem };
  return { ok: true, evento: body.evento, datos: body.datos };
}

if (typeof module !== 'undefined') {
  module.exports = { EMAIL_FORMAT, validateEvent };
}
