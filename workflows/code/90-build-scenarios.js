// Flow 90 · Demo Data — logic of the Code nodes.
// Pasted ahead of each Code node's own lines by build-90-demo-data.js; also loaded by the tests.
// Only prices, deposits and the original date are sent: the app calculates abonado, pendiente, fecha_limite and estado.

const OVERDUE_DAYS = 100;

// "2026-10-25" minus 100 days, computed in UTC so no timezone can shift the day.
function subtractDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha de hoy no válida: «${isoDate}»`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function buildScenarios(email, today) {
  if (typeof email !== 'string' || !email.includes('@')) {
    throw new Error('Configura TIENDA_EMAIL_AVISOS: los clientes de demostración usan esa dirección.');
  }
  return [
    {
      reserva: {
        cliente: 'Lucía Prado (demo)', telefono: '612 000 101', email, producto: 'Bota de piel negra', talla: '38',
        precio: 89.9, abono_inicial: 10, forma_pago: 'bizum',
      },
      abonos: [{ importe: 20, forma_pago: 'efectivo' }],
    },
    {
      reserva: {
        cliente: 'Marcos Vidal (demo)', telefono: '612 000 102', email, producto: 'Zapatilla blanca urbana',
        precio: 45, abono_inicial: 10, forma_pago: 'efectivo',
      },
      abonos: [{ importe: 35, forma_pago: 'tarjeta' }],
    },
    {
      reserva: {
        cliente: 'Elena Soto (demo)', telefono: '612 000 103', email, producto: 'Sandalia de cuña', talla: '37',
        precio: 59.9, abono_inicial: 59.9, forma_pago: 'tarjeta',
      },
      abonos: [],
    },
    {
      reserva: {
        cliente: 'Pablo Ríos (demo)', telefono: '612 000 104', producto: 'Mocasín marrón', talla: '43',
        precio: 74.5, abono_inicial: 15, forma_pago: 'efectivo',
      },
      abonos: [],
    },
    {
      reserva: {
        cliente: 'Irene Mora (demo)', telefono: '612 000 105', email, producto: 'Zapato de tacón', talla: '39',
        precio: 64.5, abono_inicial: 10, forma_pago: 'efectivo', fecha: subtractDays(today, OVERDUE_DAYS),
      },
      abonos: [],
    },
  ];
}

// Keeps the scenarios whose customer is not in the app yet. `existing` is the app's reservation list.
function dropExisting(scenarios, existing) {
  const taken = new Set(existing.filter((apartado) => apartado && apartado.cliente).map((apartado) => apartado.cliente));
  return scenarios.filter((scenario) => !taken.has(scenario.reserva.cliente));
}

// `created` are the app's answers, in the order the reservations were sent.
function planDeposits(scenarios, created) {
  if (created.length !== scenarios.length) {
    throw new Error(`Se crearon ${created.length} apartados y se esperaban ${scenarios.length}.`);
  }
  return created.flatMap((apartado, index) => {
    const { reserva, abonos } = scenarios[index];
    if (apartado.cliente !== reserva.cliente || !apartado.id) {
      throw new Error(`La app devolvió un apartado inesperado para «${reserva.cliente}».`);
    }
    return abonos.map((abono) => ({ apartado_id: apartado.id, cliente: reserva.cliente, ...abono }));
  });
}

function summarize(total, created, deposits) {
  const ids = created.map((apartado) => apartado.id);
  const skipped = total - created.length;
  return {
    creados: created.length,
    omitidos: skipped,
    abonos_registrados: deposits.length,
    ids,
    resultado: created.length === 0
      ? 'Los datos de demostración ya existen: no se ha creado nada.'
      : `Datos de demostración cargados: ${created.length} apartados nuevos, ${skipped} ya existían.`,
  };
}

if (typeof module !== 'undefined') module.exports = { subtractDays, buildScenarios, dropExisting, planDeposits, summarize };
