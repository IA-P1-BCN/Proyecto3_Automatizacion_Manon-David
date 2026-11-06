// Flow 11 · home reservation requests: pure logic, shared by the generator and the tests.
// The customer only picks a model; the price always comes from this list, never from the form.

// Mock price list. The form dropdown is built from it (optionLabel), so the two cannot drift.
const PRODUCTS = [
  { producto: 'Botín piel marrón', precio: 89.9 },
  { producto: 'Zueco cuero negro', precio: 64.5 },
  { producto: 'Mocasín piel azul', precio: 84.5 },
  { producto: 'Deportiva blanca', precio: 74.0 },
  { producto: 'Sandalia plana beige', precio: 39.9 },
  { producto: 'Bota alta negra', precio: 109.0 },
];
const SIZES = [36, 37, 38, 39, 40, 41, 42, 43, 44];
const MIN_DEPOSIT = 5; // the app's own rule, only quoted in the customer email; the app is the one that enforces it
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const eur = (value) => `${value.toFixed(2).replace('.', ',')} €`;
const optionLabel = ({ producto, precio }) => `${producto} - ${eur(precio)}`;

// `form` carries the form fields by key; `consentimiento` is the list of ticked options (empty or missing when unticked).
function validateRequest(form) {
  const errors = [];
  const nombre = String(form.nombre || '').trim().replace(/\s+/g, ' ');
  const telefono = String(form.telefono || '').trim();
  const email = String(form.email || '').trim().toLowerCase();
  const talla = Number(form.talla);
  const chosen = PRODUCTS.find((item) => optionLabel(item) === String(form.producto || '').trim());
  const consent = Array.isArray(form.consentimiento) ? form.consentimiento.length > 0 : Boolean(form.consentimiento);

  if (!nombre) errors.push('Escribe tu nombre.');
  if (!EMAIL_FORMAT.test(email)) errors.push('Escribe un correo electrónico válido.');
  if (!chosen) errors.push('Elige un modelo de la lista.');
  if (!SIZES.includes(talla)) errors.push(`La talla debe estar entre ${SIZES[0]} y ${SIZES[SIZES.length - 1]}.`);
  if (!consent) errors.push('Necesitamos tu permiso para escribirte sobre tu apartado.');
  if (errors.length) return { valido: false, errores: errors };

  return { valido: true, errores: [], solicitud: { nombre, telefono, email, producto: chosen.producto, talla, precio: chosen.precio } };
}

// `rows` are the Data Table rows; an empty table shows up as one empty item, so only rows with a ref count.
const refNumber = (ref) => Number(String(ref).replace(/^SOL-/, ''));
function nextRef(rows) {
  const numbers = rows.filter((row) => /^SOL-\d+$/.test(row && row.ref)).map((row) => refNumber(row.ref));
  return `SOL-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`;
}

// The same customer, model and size still waiting for the deposit is one request, not two.
// A confirmed or cancelled row never blocks a new request.
function checkDuplicate(solicitud, rows, today) {
  const same = rows.find((row) => row && row.estado === 'pendiente' && row.email === solicitud.email
    && row.producto === solicitud.producto && Number(row.talla) === solicitud.talla);
  if (same) return { duplicado: true, ref: same.ref };
  const ref = nextRef(rows);
  return { duplicado: false, ref, row: { ref, ...solicitud, estado: 'pendiente', fecha: today } };
}

// Emails. Mock wording, to review with Marisa. Amounts come only from the price list.
function shopEmail(row, customerContacted) {
  return {
    subject: `Nueva solicitud de apartado ${row.ref}`,
    body: [
      'Marisa, hay una nueva solicitud de apartado desde casa.',
      '',
      `Referencia: ${row.ref}`,
      `Cliente: ${row.nombre}`,
      `Teléfono: ${row.telefono || 'no indicado'}`,
      `Correo: ${row.email}`,
      `Modelo: ${row.producto}, talla ${row.talla}`,
      `Precio: ${eur(row.precio)}`,
      '',
      customerContacted
        ? 'La clienta o el cliente ya sabe cómo pagar el abono inicial. Cuando llegue su Bizum o transferencia, el apartado se creará solo.'
        : 'No hemos podido escribir a esta persona (no consta su permiso). Contáctala por otro medio.',
    ].join('\n'),
  };
}

function customerEmail(row, paymentInstructions) {
  const how = String(paymentInstructions || '').trim() || 'Pregunta en la tienda cómo hacer el pago.';
  return {
    subject: 'Hemos recibido tu solicitud de apartado',
    body: [
      `Hola ${row.nombre},`,
      '',
      `Hemos recibido tu solicitud: ${row.producto}, talla ${row.talla}, ${eur(row.precio)}.`,
      '',
      `Para confirmarla, haz un Bizum o una transferencia de al menos ${eur(MIN_DEPOSIT)} e indica ${row.ref} como concepto.`,
      'Tu apartado no será válido hasta que recibamos ese abono.',
      '',
      how,
      '',
      'Zapatería Paso Firme',
    ].join('\n'),
  };
}

// Items for the single Send Email node: always the shop, the customer only when flow 09 allowed it.
function planEmails({ row, permitido, shopAddress, paymentInstructions }) {
  const emails = [{ to: shopAddress, ...shopEmail(row, permitido === true) }];
  if (permitido === true) emails.push({ to: row.email, ...customerEmail(row, paymentInstructions) });
  return emails;
}

// A failed Send Email item carries `error`; fail loudly so flow 08 alerts and the request stays visible in the table.
function verifyEmails(items) {
  const failed = items.filter((item) => item && item.error).length;
  if (failed) throw new Error(`No se pudo enviar ${failed} correo(s) de la solicitud. La solicitud sigue guardada como pendiente.`);
}

if (typeof module !== 'undefined') {
  module.exports = { PRODUCTS, SIZES, optionLabel, validateRequest, nextRef, checkDuplicate, shopEmail, customerEmail, planEmails, verifyEmails };
}
