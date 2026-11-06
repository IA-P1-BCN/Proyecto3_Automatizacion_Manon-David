const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildMonthlyReport } = require('./build-07-monthly-report');
const core = require('./07-monthly-report');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const workflow = buildMonthlyReport();
const node = name => workflow.nodes.find(item => item.name === name);

test('monthly graph is inactive, sanitized and contains one gated email, GET-only shop calls and correct schedule', () => {
  assert.equal(workflow.active, false);
  assert.equal(workflow.settings.timezone, 'Europe/Madrid');
  assert.equal(workflow.nodes[0].name, 'Manual Report Preview');
  assert.equal(node('Monthly Day 1 at 09:00').parameters.rule.interval[0].expression, '0 9 1 * *');
  assert.equal(workflow.nodes.filter(n => n.type.endsWith('.emailSend')).length, 1);
  for (const n of workflow.nodes) {
    assert.ok(!n.credentials);
    if (n.type.endsWith('.httpRequest') && n.name !== 'Convert Report to PDF') {
      assert.equal(n.parameters.method, 'GET');
      assert.equal(n.parameters.options.response.response.fullResponse, true);
      assert.equal(n.parameters.authentication, 'genericCredentialType');
      assert.ok(!JSON.stringify(n.parameters).includes('por_pagina'));
    }
  }
  assert.ok(!node('Send Monthly Report').retryOnFail);
  assert.equal(node('Convert Report to PDF').parameters.url, 'http://monthly-pdf:3000/forms/chromium/convert/html');
  assert.equal(node('Convert Report to PDF').parameters.method, 'POST');
  assert.equal(node('Convert Report to PDF').onError, 'continueRegularOutput');
  assert.ok(!node('Convert Report to PDF').retryOnFail);
  const fields = node('Choose Month and Delivery').parameters.assignments.assignments;
  assert.equal(fields.find(f => f.name === 'send_email').value, false);
  assert.equal(fields.find(f => f.name === 'include_pdf').value, false);
  assert.ok(!workflow.settings.errorWorkflow);
  assert.ok(!workflow.pinData);
});
test('scheduled entry requires the real trigger execution mode; manual schedule click cannot send', async () => {
  const flag = node('Scheduled Report Input').parameters.assignments.assignments.find(field => field.name === 'scheduled_execution');
  assert.equal(flag.value, "={{ $mode === 'trigger' }}");
  assert.equal(flag.type, 'boolean');
  const prepare = new AsyncFunction('$input', '$now', '$env', node('Prepare Monthly Period').parameters.jsCode);
  await assert.rejects(prepare({ first: () => ({ json: { mode: 'scheduled', scheduled_execution: false } }) }, { setZone: () => ({ toFormat: () => '2026-10-27' }) }, {}), /Inicio programado bloqueado/);
});
test('all Code nodes compile and every connection references a real node', () => {
  const names = new Set(workflow.nodes.map(n => n.name));
  assert.equal(names.size, workflow.nodes.length);
  assert.equal(new Set(workflow.nodes.map(n => n.id)).size, workflow.nodes.length);
  for (const n of workflow.nodes.filter(n => n.type.endsWith('.code'))) new AsyncFunction('$input', '$', '$now', '$env', '$getWorkflowStaticData', n.parameters.jsCode);
  for (const [from, outputs] of Object.entries(workflow.connections)) {
    assert.ok(names.has(from));
    for (const output of outputs.main) for (const target of output || []) assert.ok(names.has(target.node));
  }
});
test('embedded graph calculations keep empty responses alive and preview sends nothing', async () => {
  const period = { ...core.reportPeriod({ mode: 'manual', month: '2026-10' }, '2026-11-01'), consulted_at: '2026-11-01T08:00:00Z' };
  const map = { 'Prepare Monthly Period': period };
  for (const name of ['Fetch Monthly Sales', 'Fetch Monthly Deposits', 'Fetch Current Reservations', 'Fetch Payment History', 'Fetch Vouchers']) map[name] = { statusCode: 200, body: [], headers: { 'x-total-count': '0' } };
  const lookup = name => ({ first: () => ({ json: map[name] }) });
  const calculate = new AsyncFunction('$', node('Calculate Monthly Report').parameters.jsCode);
  const [result] = await calculate(lookup);
  assert.equal(result.json.report.totals.total, 0);
  const render = new AsyncFunction('$input', '$getWorkflowStaticData', node('Format Monthly Report').parameters.jsCode);
  const [formatted] = await render({ first: () => result }, () => ({}));
  assert.equal(formatted.json.delivery_requested, false);
  assert.match(formatted.json.html, /No hubo movimientos/);
  map['Fetch Monthly Sales'].statusCode = 503;
  await assert.rejects(calculate(lookup), /consultar la API/);
});
test('embedded delivery marker requires SMTP confirmation and preserves manual resend semantics', async () => {
  const state = {};
  const period = { ...core.reportPeriod({ mode: 'scheduled' }, '2026-11-01'), report: { totals: { total: 0 } } };
  const lookup = () => ({ first: () => ({ json: { ...period, pdf_attached: false } }) });
  const run = new AsyncFunction('$input', '$', '$getWorkflowStaticData', node('Record Monthly Delivery').parameters.jsCode);
  await assert.rejects(run({ first: () => ({ json: {} }) }, lookup, () => state), /SMTP no confirmó/);
  await run({ first: () => ({ json: { messageId: 'synthetic-id' } }) }, lookup, () => state);
  assert.equal(state.sent_months['2026-10'], true);
});
test('canonical JSON matches the generated baseline without writing during tests', () => {
  const canonical = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '07-monthly-report.json'), 'utf8'));
  assert.deepEqual(canonical, workflow);
});

test('PDF validation attaches only valid PDF bytes and fallback keeps the one report email path', async () => {
  const state = {
    report: { month: '2026-10', desde: '2026-10-01', hasta: '2026-10-31', consulted_at: '2026-11-01T08:00:00Z', movement_count: 0,
      counts: { activos_actuales: 0, nuevos: 0, liquidados: 0, vencidos: 0 }, pending_cents: 0,
      totals: { ventas: 0, abonos: 0, total: 0 }, methods: Object.fromEntries(core.REPORT_METHODS.map(key => [key, { ventas: 0, abonos: 0, total: 0 }])) },
    pdf_filename: 'paso-firme-monthly-report-2026-10.pdf', delivery_requested: true,
  };
  const lookup = () => ({ first: () => ({ json: state }) });
  const bytes = Buffer.from('%PDF-1.7\nsynthetic-guard-test-only\n%%EOF\n');
  const helpers = {
    getBinaryDataBuffer: async () => bytes,
    prepareBinaryData: async (data, fileName, mimeType) => ({ data: data.toString('base64'), fileName, mimeType }),
  };
  const run = new AsyncFunction('$input', '$', node('Validate PDF Result').parameters.jsCode);
  const valid = { json: { statusCode: 200 }, binary: { pdf: { mimeType: 'application/pdf' }, data: { mimeType: 'text/html' } } };
  const [success] = await run.call({ helpers }, { first: () => valid }, lookup);
  assert.equal(success.json.pdf_attached, true);
  assert.deepEqual(Object.keys(success.binary), ['pdf']);
  assert.equal(success.binary.pdf.fileName, state.pdf_filename);
  for (const failed of [{ json: { error: 'refused' } }, { json: { statusCode: 200 }, binary: { pdf: { mimeType: 'text/html' } } }]) {
    const [fallback] = await run.call({ helpers }, { first: () => failed }, lookup);
    assert.equal(fallback.json.pdf_attached, false);
    assert.equal(fallback.json.pdf_warning, true);
    assert.equal(fallback.json.delivery_requested, true);
    assert.ok(!fallback.binary);
    assert.match(fallback.json.html, /no se ha podido generar el PDF/);
  }
});
