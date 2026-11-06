// Flow 02 · Deposit Receipt — "Format Receipt" Code node.
// Pasted as-is into the Code node (mode: Run Once for All Items); also loaded by the tests.
// Shows the app's figures exactly as the event carries them: nothing is recalculated (spec: figures come from the app).

function formatEuros(amount) {
  return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// "2027-01-18" -> "18/01/2027", without going through Date so no timezone can shift the day.
function formatDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-');
  return `${day}/${month}/${year}`;
}

function hasUsableEmail(email) {
  return typeof email === 'string' && email.trim().includes('@');
}

function requireNumber(datos, field) {
  if (typeof datos[field] !== 'number' || !Number.isFinite(datos[field])) {
    throw new Error(`El aviso abono.registrado llegó sin «${field}» válido`);
  }
}

function buildReceipt(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('El aviso abono.registrado llegó sin datos');
  requireNumber(datos, 'importe');
  requireNumber(datos, 'pendiente');
  if (!datos.id) throw new Error('El aviso abono.registrado llegó sin número de apartado');

  const paid = formatEuros(datos.importe);
  // The app sends `talla: null` when the reservation has no size.
  const size = String(datos.talla ?? '').trim();
  const shoes = size ? `«${datos.producto}» (talla ${size})` : `«${datos.producto}»`;
  const closing = 'Gracias por confiar en Zapatería Paso Firme.';

  return {
    emailValido: hasUsableEmail(datos.email),
    liquidado: datos.estado === 'liquidado',
    to: hasUsableEmail(datos.email) ? datos.email.trim() : '',
    recibo: {
      subject: `Recibo de tu abono · ${datos.producto}`,
      body: [
        `Hola ${datos.cliente},`,
        '',
        `Hemos registrado tu abono de ${paid} para tu apartado de ${shoes}.`,
        '',
        `Pendiente por pagar: ${formatEuros(datos.pendiente)}`,
        `Fecha límite: ${formatDate(datos.fecha_limite)}`,
        '',
        closing,
      ].join('\n'),
    },
    recogida: {
      subject: `Ya puedes recoger tus zapatos · ${datos.producto}`,
      body: [
        `Hola ${datos.cliente},`,
        '',
        `Hemos registrado tu último abono de ${paid}. Tu apartado de ${shoes} está totalmente pagado.`,
        '',
        'Ya puedes pasar por la tienda a recoger tus zapatos.',
        '',
        closing,
      ].join('\n'),
    },
    aviso: {
      subject: `Abono sin recibo: el apartado nº ${datos.id} no tiene email válido`,
      body: [
        'Se registró un abono pero no se pudo enviar el recibo a la clienta.',
        '',
        `Apartado nº: ${datos.id}`,
        `Cliente:     ${datos.cliente}`,
        ...(datos.telefono ? [`Teléfono:    ${datos.telefono}`] : []),
        `Abonado:     ${paid}`,
        'Motivo:      el apartado no tiene email o el email no es válido.',
      ].join('\n'),
    },
  };
}

if (typeof module !== 'undefined') module.exports = { buildReceipt };
// Inside n8n there is no `module`; `$input` exists only there.
if (typeof $input !== 'undefined') return [{ json: buildReceipt($input.first().json.datos) }];
