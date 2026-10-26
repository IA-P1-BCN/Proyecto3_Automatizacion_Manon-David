// Regenerates workflows/90-demo-data.json from the tested Code node source.
// Run from the repo root: node workflows/code/build-90-demo-data.js
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/90-build-scenarios.js', 'utf8').replaceAll('\r\n', '\n');

const id = (n) => `d90a1c1d-0090-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const nodes = [];
const connections = {};

function node(name, type, typeVersion, parameters, position, extra = {}) {
  nodes.push({ id: id(nodes.length + 1), name, type: `n8n-nodes-base.${type}`, typeVersion, position, parameters, ...extra });
}

function code(name, lines, position, extra = {}) {
  node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: `${core}\n${lines}` }, position, extra);
}

// Default error behaviour on purpose: a 4xx from the app stops the flow and flow 08 sends the alert.
function http(name, url, parameters, position, extra = {}) {
  node(name, 'httpRequest', 4.2, {
    method: 'GET', url, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
    options: { timeout: 30000 }, ...parameters,
  }, position, extra);
}

function ifHasField(name, field, position) {
  node(name, 'if', 2.2, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 },
      conditions: [{
        id: id(40 + nodes.length),
        leftValue: `={{ $json.${field} !== undefined }}`,
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  }, position);
}

function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  connections[from].main[output] ||= [];
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}

node('Run Demo Data', 'manualTrigger', 1, {}, [0, 0]);
code('Build Demo Scenarios', `return buildScenarios($env.TIENDA_EMAIL_AVISOS, $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd')).map((scenario) => ({ json: scenario }));`, [220, 0]);
// An empty app returns an empty list: alwaysOutputData keeps the flow going with one empty item.
http('List Reservations', 'http://tienda:8000/api/apartados', {}, [440, 0], { alwaysOutputData: true });
// `{ nada: true }` is the placeholder when every scenario already exists, so the summary still runs.
code('Drop Existing', `const scenarios = $('Build Demo Scenarios').all().map((item) => item.json);
const pending = dropExisting(scenarios, $input.all().map((item) => item.json));
return pending.length ? pending.map((scenario) => ({ json: scenario })) : [{ json: { nada: true } }];`, [660, 0]);
ifHasField('Anything To Create?', 'reserva', [880, 0]);
http('Create Reservation', 'http://tienda:8000/api/apartados', {
  method: 'POST', sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.reserva) }}',
}, [1100, -100]);
// `{ sinAbonos: true }` is the placeholder when no created reservation has deposits.
code('Plan Deposits', `const scenarios = $('Drop Existing').all().map((item) => item.json);
const deposits = planDeposits(scenarios, $input.all().map((item) => item.json));
return deposits.length ? deposits.map((deposit) => ({ json: deposit })) : [{ json: { sinAbonos: true } }];`, [1320, -100]);
ifHasField('Any Deposits?', 'importe', [1540, -100]);
http('Register Deposit', '=http://tienda:8000/api/apartados/{{ $json.apartado_id }}/abonos', {
  method: 'POST', sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: '={{ JSON.stringify({ importe: $json.importe, forma_pago: $json.forma_pago }) }}',
}, [1760, -160]);
code('Summary', `const total = $('Build Demo Scenarios').all().length;
const created = $('Create Reservation').isExecuted ? $('Create Reservation').all().map((item) => item.json) : [];
const deposits = $('Register Deposit').isExecuted ? $('Register Deposit').all() : [];
return [{ json: summarize(total, created, deposits) }];`, [1980, 0]);

link('Run Demo Data', 'Build Demo Scenarios');
link('Build Demo Scenarios', 'List Reservations');
link('List Reservations', 'Drop Existing');
link('Drop Existing', 'Anything To Create?');
link('Anything To Create?', 'Create Reservation', 0);
link('Anything To Create?', 'Summary', 1);
link('Create Reservation', 'Plan Deposits');
link('Plan Deposits', 'Any Deposits?');
link('Any Deposits?', 'Register Deposit', 0);
link('Any Deposits?', 'Summary', 1);
link('Register Deposit', 'Summary');

// Flow 08 is set as this flow's Error Workflow by hand after import: workflow IDs differ on every n8n instance.
// The shared Header Auth credential is chosen by hand on the three HTTP nodes for the same reason.
const workflow = { name: '90 Demo Data', nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };

fs.writeFileSync('workflows/90-demo-data.json', `${JSON.stringify(workflow, null, 2)}\n`);
