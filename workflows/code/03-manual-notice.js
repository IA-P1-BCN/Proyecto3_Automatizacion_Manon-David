'use strict';

function createManualNotice(testCase, fixtures) {
  const selected = String(testCase || '').trim();
  if (!/^0[1-9]$/.test(selected)) throw new Error('Selecciona un caso entre 01 y 09.');
  const fixture = fixtures.find(item => item.test_case === selected);
  if (!fixture) throw new Error('No se ha encontrado el correo de prueba seleccionado.');
  return {
    manual_fixture: true,
    messageId: `<hu03-manual-fixture-v1-${selected}@pasofirme.example>`,
    subject: `TEST HU03 — ${fixture.subject}`,
    text: `${fixture.body.trim()}\n\nAVISO SIMULADO PARA PRUEBAS. No corresponde a un ingreso real.`,
    from: { value: [{ address: 'manual-fixture@example.invalid' }] },
  };
}

function applyConfiguredManualSender(input) {
  if (input.manual_fixture !== true) return input;
  if (typeof input.authorized_test_sender !== 'string' || !input.authorized_test_sender.trim()) {
    throw new Error('Configura el remitente de pruebas antes de inyectar el aviso.');
  }
  return {...input, from: {value:[{address:input.authorized_test_sender.trim().toLowerCase()}]}};
}

if (typeof module !== 'undefined') module.exports = {createManualNotice,applyConfiguredManualSender};
