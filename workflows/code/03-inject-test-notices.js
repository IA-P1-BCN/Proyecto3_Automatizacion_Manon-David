// Paste into "Inject the Selected Example as a Resolved Bank Notice".
// Mode: Run Once for All Items. No email is sent by this node.

function bizum(amount, payer, concept) {
  return `Hola, ZAPATERIA PASO FIRME:

Has recibido un Bizum.

Importe: ${amount} EUR
Ordenante: ${payer}
Concepto:${concept ? ' ' + concept : ''}

El importe ya está disponible en tu cuenta terminada en 4821.

Banco Ejemplo`;
}

function transfer(amount, payer, concept) {
  return `Le informamos de que se ha abonado una transferencia en su cuenta ES** **** **** **** **** 4821.

Ordenante ........ ${payer}
Importe .......... ${amount} EUR
Concepto ......... ${concept}
Fecha valor ...... la de este aviso

Este mensaje se ha generado automáticamente. Por favor, no responda.`;
}

const cases = {
  '01': {
    subject: 'Has recibido un Bizum de 10,00 €',
    body: bizum('10,00', 'CARMEN RUIZ GARCIA', 'zuecos'),
  },
  '02': {
    subject: 'Has recibido un Bizum de 20,00 €',
    body: bizum('20,00', 'JORGE M.', 'apartado 2 bota'),
  },
  '03': {
    subject: 'Aviso de transferencia recibida',
    body: transfer('12,00', 'LUCIA GOMEZ PEREZ', 'Liquidar mocasines'),
  },
  '04': {
    subject: 'Has recibido un Bizum de 15,00 €',
    body: bizum('15,00', 'LAURA O.', 'deportivas'),
  },
  '05': {
    subject: 'Has recibido un Bizum de 10,00 €',
    body: bizum('10,00', 'ROMERO D', ''),
  },
  '06': {
    subject: 'Has recibido un Bizum de 20,00 €',
    body: bizum('20,00', 'PAULA RAMOS LEON', 'zapatillas running perdón por el retraso'),
  },
  '07': {
    subject: 'Aviso de transferencia recibida',
    body: transfer('25,00', 'ANTONIO FERNANDEZ SOTO', 'botas'),
  },
  '08': {
    subject: 'Hasta 150 € por domiciliar tus cobros con tarjeta',
    body: `Hola, ZAPATERIA PASO FIRME:

Este mes, si domicilias los cobros de tu datáfono con nosotros, te devolvemos hasta 150 €.
Consulta las condiciones en tu oficina.

Banco Ejemplo`,
  },
  '09': {
    subject: 'Has recibido un Bizum de 5,00 €',
    body: bizum('5,00', 'SILVIA CORTES', 'abono sandalias'),
  },
  '10': {
    subject: 'Has recibido un Bizum de 1,00 €',
    body: bizum('1,00', 'HU03 Test Customer', 'apartado 25'),
  },
};

return $input.all().map((item, index) => {
  const selected = String(item.json.test_case ?? '').trim().padStart(2, '0');
  if (!/^(?:0[1-9]|10)$/.test(selected)) {
    throw new Error('En el nodo selector, pon test_case entre 01 y 10.');
  }
  const fixture = cases[selected];
  return {
    json: {
      manual_fixture: true,
      messageId: `<hu03-manual-fixture-v1-${selected}@pasofirme.example>`,
      subject: `TEST HU03 — ${fixture.subject}`,
      text: fixture.body.trim() + '\n\nAVISO SIMULADO PARA PRUEBAS. No corresponde a un ingreso real.',
      from: { value: [{ address: 'manual-fixture@example.invalid' }] },
    },
    pairedItem: { item: index },
  };
});
