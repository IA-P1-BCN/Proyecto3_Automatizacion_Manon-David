// Flow 01 · Reservation Confirmation — "Format Confirmation" Code node.
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
    throw new Error(`El aviso apartado.creado llegó sin «${field}» válido`);
  }
}

function buildConfirmation(datos) {
  if (!datos || typeof datos !== 'object') throw new Error('El aviso apartado.creado llegó sin datos');
  ['precio', 'abonado', 'pendiente'].forEach((field) => requireNumber(datos, field));
  if (!datos.id) throw new Error('El aviso apartado.creado llegó sin número de apartado');

  // The app sends `talla: null` when the reservation has no size.
  const size = String(datos.talla ?? '').trim();
  const closing = 'Gracias por confiar en Zapatería Paso Firme.';
  const summary = [
    `Modelo:      ${datos.producto}`,
    ...(size ? [`Talla:       ${size}`] : []),
    `Precio:      ${formatEuros(datos.precio)}`,
    `Abonado:     ${formatEuros(datos.abonado)}`,
  ];

  return {
    emailValido: hasUsableEmail(datos.email),
    to: hasUsableEmail(datos.email) ? datos.email.trim() : '',
    confirmacion: {
      subject: `Tu apartado en Paso Firme: ${datos.producto}`,
      body: [
        `Hola ${datos.cliente},`,
        '',
        `Hemos registrado tu apartado nº ${datos.id}.`,
        '',
        ...summary,
        ...(datos.estado === 'liquidado'
          ? ['', 'Tu apartado está totalmente pagado: ya puedes pasar por la tienda a recoger tus zapatos.']
          : [`Pendiente:   ${formatEuros(datos.pendiente)}`, `Fecha límite: ${formatDate(datos.fecha_limite)}`]),
        '',
        closing,
      ].join('\n'),
    },
    aviso: {
      subject: `Apartado sin confirmación: el apartado nº ${datos.id} no tiene email válido`,
      body: [
        'Se creó un apartado pero no se pudo enviar la confirmación a la clienta.',
        '',
        `Apartado nº: ${datos.id}`,
        `Cliente:     ${datos.cliente}`,
        ...(datos.telefono ? [`Teléfono:    ${datos.telefono}`] : []),
        `Modelo:      ${datos.producto}`,
        'Motivo:      el apartado no tiene email o el email no es válido.',
      ].join('\n'),
    },
  };
}

if (typeof module !== 'undefined') module.exports = { buildConfirmation };
// Inside n8n there is no `module`; `$input` exists only there.
if (typeof $input !== 'undefined') return [{ json: buildConfirmation($input.first().json.datos) }];
