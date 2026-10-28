// Regenerates workflows/06b-expired-reservations.json (inactive, no credentials) from the tested logic.
// Run from the repo root: node workflows/code/build-06b-expired-reservations.js
// Credentials (shop Header Auth, SMTP) and the Error Workflow (flow 08) are chosen by hand after import:
// credential and workflow IDs differ on every n8n instance.
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/06b-expired-reservations.js', 'utf8').replaceAll('\r\n', '\n');

const nodes = [];
const connections = {};

function node(name, type, typeVersion, parameters, x, y = 0, extra = {}) {
  nodes.push({ id: `expired-reservations-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
}
function code(name, text, x, y = 0, mode = 'runOnceForAllItems') {
  node(name, 'code', 2, { mode, jsCode: `${core}\n${text}` }, x, y);
}
function link(from, to, output = 0, input = 0) {
  connections[from] ||= { main: [] };
  connections[from].main[output] ||= [];
  connections[from].main[output].push({ node: to, type: 'main', index: input });
}
function isTrue(id, expression) {
  return {
    conditions: {
      options: { caseSensitive: true, typeValidation: 'strict', version: 2 },
      conditions: [{ id, leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  };
}
const options = (format = 'json') => ({ timeout: 30000, response: { response: { fullResponse: true, responseFormat: format } } });
const run = "$('Prepare Run').first().json";
const email = (name, x, y = 0) => node(name, 'emailSend', 2.1, {
  fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}', toEmail: '={{ $json.to }}',
  subject: '={{ $json.subject }}', emailFormat: 'text', text: '={{ $json.body }}', options: {},
}, x, y, { onError: 'continueRegularOutput' });

// 1 · Triggers and run date
node('Every Morning 09:05', 'scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: '5 9 * * *' }] } }, 0);
code('Scheduled Input', "return [{json: {mode: 'scheduled'}}];", 220);
node('Manual Run', 'manualTrigger', 1, {}, 0, 220);
node('Choose Date', 'set', 3.4, { mode: 'manual', assignments: { assignments: [
  { id: 'mode', name: 'mode', value: 'manual', type: 'string' },
  { id: 'date', name: 'fecha', value: '={{ $now.setZone("Europe/Madrid").toFormat("yyyy-MM-dd") }}', type: 'string' },
] }, options: {} }, 220, 220);
code('Prepare Run', "return [{json: runInput($input.first().json, $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd'))}];", 460);

// 2 · Read the app and expire what is past its deadline
node('Fetch Reservations', 'httpRequest', 4.2, {
  method: 'GET', url: '=http://tienda:8000/api/apartados', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
  sendQuery: true, queryParameters: { parameters: [{ name: 'estado', value: 'activo' }] }, options: options(),
}, 700, 0, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
code('Select Expired', `const response = $('Fetch Reservations').first().json;
if (response.statusCode !== 200) throw new Error('No se pudo consultar la API de la tienda.');
return selectExpired({reservations: response.body, today: ${run}.fecha}).map((json) => ({json}));`, 940);
// No retry: a repeated POST after a refusal would only be refused again. A failure on one reservation does not stop the others.
node('Expire Reservation', 'httpRequest', 4.2, {
  method: 'POST', url: '=http://tienda:8000/api/apartados/{{ $json.id }}/vencer', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
  options: { timeout: 30000 },
}, 1180, 0, { onError: 'continueRegularOutput' });

// 3 · Notify: customer emails, then one summary for the shop
code('Plan Notifications', `const selected = $('Select Expired').all().map((item) => item.json);
const results = $input.all().map((item) => item.json);
const {expired, failures} = collectExpiries(selected, results);
const {planned} = planNotifications({expired, failures});
if (!planned.length) verifyResult({failures, bounced: [], summaryFailed: false}); // nothing expired at all: fail now
return planned.map((json) => ({json: {...json, failures}}));`, 1420);
// HU-14: flow 09 says who may be written to; a customer without consent is treated like one without email.
code('Prepare Consent Check', "return withConsentEmail($input.all().map((item) => item.json)).map((json) => ({json}));", 1660);
node('Check Consent (flow 09)', 'executeWorkflow', 1.2, {
  source: 'database', workflowId: { __rl: true, value: '', mode: 'id' }, mode: 'once', options: { waitForSubWorkflow: true },
}, 1880);
code('Apply Consent', "return applyConsent($input.all().map((item) => item.json)).map((json) => ({json}));", 2100);
node('Has Email?', 'if', 2.2, isTrue('send', '={{ $json.send }}'), 2320);
email('Send Customer Email', 1900);
node('Join', 'merge', 3, {}, 2140, 120);
code('Build Summary', `const planned = $('Apply Consent').all().map((item) => item.json);
const failures = planned[0].failures;
const sendResults = $('Send Customer Email').isExecuted ? $('Send Customer Email').all().map((item) => item.json) : [];
const shopAddress = String($env.TIENDA_EMAIL_AVISOS || '').trim();
if (!shopAddress.includes('@')) throw new Error('Configure TIENDA_EMAIL_AVISOS.');
const items = planned.map(({failures: ignored, ...item}) => item);
const summary = buildSummary({planned: items, sendResults, today: ${run}.fecha, shopAddress});
return [{json: {...summary, failures}}];`, 2380, 120);
email('Send Shop Summary', 2620, 120);

// 4 · Fail loudly, after everything else was processed
code('Verify Result', `const state = $('Build Summary').first().json;
verifyResult({failures: state.failures, bounced: state.bounced, summaryFailed: Boolean($input.first().json.error)});
return [{json: {fecha: ${run}.fecha, vencidos: $('Plan Notifications').all().length, fallidos: 0}}];`, 2860, 120);

for (const [from, to] of [
  ['Every Morning 09:05', 'Scheduled Input'], ['Scheduled Input', 'Prepare Run'], ['Manual Run', 'Choose Date'], ['Choose Date', 'Prepare Run'],
  ['Prepare Run', 'Fetch Reservations'], ['Fetch Reservations', 'Select Expired'], ['Select Expired', 'Expire Reservation'],
  ['Expire Reservation', 'Plan Notifications'], ['Plan Notifications', 'Prepare Consent Check'], ['Prepare Consent Check', 'Check Consent (flow 09)'], ['Check Consent (flow 09)', 'Apply Consent'], ['Apply Consent', 'Has Email?'], ['Join', 'Build Summary'],
  ['Build Summary', 'Send Shop Summary'], ['Send Shop Summary', 'Verify Result'],
]) link(from, to);
link('Has Email?', 'Send Customer Email', 0);
link('Has Email?', 'Join', 1, 1);
link('Send Customer Email', 'Join', 0, 0);

// Make room for the three consent nodes: everything from Send Customer Email on moves right.
const consentNodes = new Set(['Prepare Consent Check', 'Check Consent (flow 09)', 'Apply Consent', 'Has Email?']);
for (const item of nodes) if (item.position[0] >= 1900 && !consentNodes.has(item.name)) item.position[0] += 660;

const workflow = { id: 'pasoFirmeExpiredReservations06b', name: '06b Expired Reservations', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
fs.writeFileSync('workflows/06b-expired-reservations.json', `${JSON.stringify(workflow, null, 2)}\n`);
