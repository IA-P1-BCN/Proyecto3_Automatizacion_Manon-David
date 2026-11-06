// HU-14 in the scheduled flows: flows 06 and 06b write to customers only after flow 09 allowed it.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const due = require('./06-due-reminders.js');
const expired = require('./06b-expired-reservations.js');

const load = (file) => JSON.parse(fs.readFileSync(`workflows/${file}`, 'utf8'));
const reminders = load('06-due-reminders.json');
const expiries = load('06b-expired-reservations.json');

// Every path from a node to `target` must pass through `gate`.
function onlyThrough(workflow, target, gate, start) {
  const seen = new Set();
  const reaches = (name) => {
    if (name === gate || seen.has(name)) return false;
    if (name === target) return true;
    seen.add(name);
    return (workflow.connections[name]?.main || []).some((targets) => targets.some((next) => reaches(next.node)));
  };
  return !reaches(start);
}

test('06: customers carry their email to flow 09, the shop notices carry none', () => {
  const planned = [
    { to: 'ana@example.com', resultado: 'enviado', apartado_id: 1 },
    { to: 'tienda@example.com', resultado: 'sin_email', apartado_id: 2 },
  ];
  assert.deepEqual(due.withConsentEmail(planned).map((item) => item.email), ['ana@example.com', '']);
});

test('06: only allowed customers and shop notices are kept; the rest is neither sent nor recorded', () => {
  const checked = [
    { apartado_id: 1, to: 'ok@example.com', resultado: 'enviado', email: 'ok@example.com', permitido: true, razon: 'activo' },
    { apartado_id: 2, to: 'out@example.com', resultado: 'enviado', email: 'out@example.com', permitido: false, razon: 'consentimiento_retirado' },
    { apartado_id: 3, to: 'unknown@example.com', resultado: 'enviado', email: 'unknown@example.com', permitido: false, razon: 'sin_consentimiento' },
    { apartado_id: 4, to: 'tienda@example.com', resultado: 'sin_email', email: '', permitido: false, razon: 'sin_email' },
  ];
  const kept = due.keepConsented(checked);
  assert.deepEqual(kept.map((item) => item.apartado_id), [1, 4]);
  assert.deepEqual(Object.keys(kept[0]).sort(), ['apartado_id', 'resultado', 'to']);
});

test('06: the results are matched to the items that were really sent (after the consent filter)', () => {
  const kept = [{ apartado_id: 1, umbral: 7, resultado: 'enviado' }];
  const outcome = due.collectResults(kept, [{}], '2026-10-28');
  assert.deepEqual(outcome.rows, [{ apartado_id: 1, umbral: 7, resultado: 'enviado', fecha_envio: '2026-10-28' }]);
  const code = reminders.nodes.find((item) => item.name === 'Collect Results').parameters.jsCode;
  assert.ok(code.includes("$('Keep Consented')") && !code.includes("$('Plan Reminders')"));
});

test('06: the reminder email can only be reached through the consent check', () => {
  assert.ok(onlyThrough(reminders, 'Send Reminder', 'Check Consent (flow 09)', 'Plan Reminders'));
  assert.equal(reminders.nodes.find((item) => item.name === 'Check Consent (flow 09)').parameters.options.waitForSubWorkflow, true);
});

test('06b: a customer without consent is treated like one without email and the summary says why', () => {
  const apartado = { id: 16, cliente: 'Paula Ramos', producto: 'Zapatilla running azul', telefono: '612 345 016', email: 'paula@example.com' };
  const vale = { codigo: 'VALE-00016', importe: 5 };
  const planned = expired.planNotifications({ expired: [{ apartado, vale }], failures: [] }).planned;
  const withEmail = expired.withConsentEmail(planned);
  assert.equal(withEmail[0].email, 'paula@example.com');

  const refused = expired.applyConsent(withEmail.map((item) => ({ ...item, permitido: false, razon: 'consentimiento_retirado' })));
  assert.deepEqual([refused[0].send, refused[0].to, refused[0].motivo], [false, '', 'sin_consentimiento']);
  assert.equal('email' in refused[0] || 'permitido' in refused[0], false);
  const summary = expired.buildSummary({ planned: refused, sendResults: [], today: '2026-10-28', shopAddress: 'tienda@example.com' });
  assert.match(summary.body, /VALE-00016/);
  assert.match(summary.body, /motivo: sin consentimiento para recibir mensajes automáticos/);

  const allowed = expired.applyConsent(withEmail.map((item) => ({ ...item, permitido: true, razon: 'activo' })));
  assert.deepEqual([allowed[0].send, allowed[0].to], [true, 'paula@example.com']);
});

test('06b: a customer without email keeps the old reason and is not asked to flow 09', () => {
  const apartado = { id: 17, cliente: 'Luis', producto: 'Bota', email: '' };
  const planned = expired.planNotifications({ expired: [{ apartado, vale: { codigo: 'VALE-00017', importe: 4 } }], failures: [] }).planned;
  assert.equal(expired.withConsentEmail(planned)[0].email, '');
  const summary = expired.buildSummary({ planned: expired.applyConsent([{ ...planned[0], permitido: false, razon: 'sin_email' }]), sendResults: [], today: '2026-10-28', shopAddress: 'tienda@example.com' });
  assert.match(summary.body, /motivo: sin email válido/);
});

test('06b: the customer email can only be reached through the consent check, and the summary reads the filtered items', () => {
  assert.ok(onlyThrough(expiries, 'Send Customer Email', 'Check Consent (flow 09)', 'Plan Notifications'));
  const code = expiries.nodes.find((item) => item.name === 'Build Summary').parameters.jsCode;
  assert.ok(code.includes("$('Apply Consent')") && !code.includes("$('Plan Notifications').all()"));
});

test('both exported flows stay free of credentials and localhost', () => {
  for (const workflow of [reminders, expiries]) {
    assert.ok(!workflow.nodes.some((item) => item.credentials));
    assert.equal(JSON.stringify(workflow).includes('localhost'), false);
  }
});
