// Regenerates workflows/11b-match-request.json (inactive, no credentials) from the tested logic.
// Run from the repo root: node workflows/code/build-11b-match-request.js
// Chosen by hand after import: the shop Header Auth credential and flow 08 as the Error Workflow
// (credential and workflow IDs differ on every n8n instance). The Data Table `solicitudes_apartado` must exist first,
// with the extra text column `payment_key` that flow 11 does not use.
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/11b-match-request.js', 'utf8').replaceAll('\r\n', '\n');

const nodes = [];
const connections = {};

function node(name, type, typeVersion, parameters, x, y = 0, extra = {}) {
  nodes.push({ id: `match-request-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
}
function code(name, text, x, y = 0) {
  node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: `${core}\n${text}` }, x, y);
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
const table = { __rl: true, mode: 'name', value: 'solicitudes_apartado' };
const column = (id, type = 'string') => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type, canBeUsedToMatch: true });
const where = (...pairs) => ({ matchType: 'allConditions', filters: { conditions: pairs.map(([keyName, keyValue]) => ({ keyName, condition: 'eq', keyValue })) } });
const update = (name, pairs, values, schema, x, y) => node(name, 'dataTable', 1.1, {
  resource: 'row', operation: 'update', dataTableId: table, ...where(...pairs),
  columns: { mappingMode: 'defineBelow', value: values, matchingColumns: [], schema },
  options: {},
}, x, y, { onError: 'continueRegularOutput' });

const input = "$('When Called By Flow 03').first().json";
const decided = "$('Decide Request').first().json";
const claimed = "$('Check Claim').first().json";
const interpreted = "$('Interpret Creation').first().json";

// 1 · Input from flow 03: `payment`, `payment_key` and `allow_payment_registration`, plus whatever else it carries
node('When Called By Flow 03', 'executeWorkflowTrigger', 1.1, { inputSource: 'passthrough' }, 0);

// 2 · Read what is needed to decide
node('Read Requests', 'dataTable', 1.1, { resource: 'row', operation: 'get', dataTableId: table, returnAll: true }, 240, 0, { alwaysOutputData: true });
node('Read Active Reservations', 'httpRequest', 4.2, {
  method: 'GET', url: '=http://tienda:8000/api/apartados', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
  sendQuery: true, queryParameters: { parameters: [{ name: 'estado', value: 'activo' }] },
  options: { timeout: 30000, response: { response: { fullResponse: true, responseFormat: 'json' } } },
}, 480, 0, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
code('Decide Request', `const input = ${input};
const response = $('Read Active Reservations').first().json;
if (response.statusCode !== 200 || !Array.isArray(response.body)) throw new Error('No se pudo consultar la API de la tienda.');
const requests = $('Read Requests').all().map((item) => item.json);
const decision = decideRequest({payment: input.payment, requests, reservations: response.body, allowRegistration: input.allow_payment_registration});
return [{json: {...input, ...decision}}];`, 720);
node('Create Apartado?', 'if', 2.2, isTrue('create', '={{ $json.crear }}'), 960);

// 3 · Claim the request for this payment, then check that the claim is ours
update('Claim Request', [['ref', '={{ $json.request.ref }}'], ['estado', 'pendiente']],
  { estado: 'procesando', payment_key: '={{ $json.payment_key }}' }, [column('estado'), column('payment_key')], 1200, -120);
node('Read Claim', 'dataTable', 1.1, {
  resource: 'row', operation: 'get', dataTableId: table, returnAll: true, ...where(['ref', `={{ ${decided}.request.ref }}`]),
}, 1440, -120, { alwaysOutputData: true });
code('Check Claim', `const context = ${decided};
const rows = $input.all().map((item) => item.json);
if (claimHolds(rows, context.request, context.payment_key)) return [{json: {...context, claimed: true}}];
return [{json: {...context, claimed: false, decision: 'review', crear: false,
  reason: \`La solicitud \${context.request.ref} ya se está procesando con otro pago o no está pendiente.\`}}];`, 1680, -120);
node('Claimed?', 'if', 2.2, isTrue('claimed', '={{ $json.claimed }}'), 1920, -120);

// 4 · Create the apartado in the app; the app decides whether the amount is acceptable
code('Build Apartado Body', `const context = ${claimed};
return [{json: {...context, body: buildApartadoBody(context.request, context.payment)}}];`, 2160, -240);
// No retry and no automatic repeat: a lost answer is reported as uncertain, never resent blindly.
node('Create Apartado', 'httpRequest', 4.2, {
  method: 'POST', url: '=http://tienda:8000/api/apartados', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}',
  options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } },
}, 2400, -240, { onError: 'continueRegularOutput' });
code('Interpret Creation', `const context = $('Build Apartado Body').first().json;
const outcome = interpretCreation($input.first().json, context.request);
return [{json: {...context, ...outcome}}];`, 2640, -240);

// 5 · Update the request row according to the answer: confirm, release, or leave it for a person
node('Confirmed?', 'if', 2.2, isTrue('confirmed', "={{ $json.accion === 'confirmar' }}"), 2880, -240);
update('Mark Confirmed', [['ref', `={{ ${interpreted}.request.ref }}`]],
  { estado: 'confirmada', apartado_id: `={{ ${interpreted}.apartado_id }}` }, [column('estado'), column('apartado_id', 'number')], 3120, -360);
node('Released?', 'if', 2.2, isTrue('released', "={{ $json.accion === 'liberar' }}"), 3120, -120);
update('Release Request', [['ref', `={{ ${interpreted}.request.ref }}`]],
  { estado: 'pendiente', payment_key: '' }, [column('estado'), column('payment_key')], 3360, -240);
code('Check Row Update', `const context = ${interpreted};
const update = $input.first().json;
return [{json: afterRowUpdate(context, update)}];`, 3600, -300);

// 6 · One answer for flow 03: created, review, uncertain or not_mine
code('Return Result', `const context = $input.first().json;
return [{json: toResult(context, ${input})}];`, 3840, 0);

for (const [from, to, output, inputIndex] of [
  ['When Called By Flow 03', 'Read Requests'], ['Read Requests', 'Read Active Reservations'], ['Read Active Reservations', 'Decide Request'],
  ['Decide Request', 'Create Apartado?'],
  ['Create Apartado?', 'Claim Request', 0], ['Create Apartado?', 'Return Result', 1],
  ['Claim Request', 'Read Claim'], ['Read Claim', 'Check Claim'], ['Check Claim', 'Claimed?'],
  ['Claimed?', 'Build Apartado Body', 0], ['Claimed?', 'Return Result', 1],
  ['Build Apartado Body', 'Create Apartado'], ['Create Apartado', 'Interpret Creation'], ['Interpret Creation', 'Confirmed?'],
  ['Confirmed?', 'Mark Confirmed', 0], ['Confirmed?', 'Released?', 1],
  ['Released?', 'Release Request', 0], ['Released?', 'Return Result', 1],
  ['Mark Confirmed', 'Check Row Update'], ['Release Request', 'Check Row Update'], ['Check Row Update', 'Return Result'],
]) link(from, to, output ?? 0, inputIndex ?? 0);

const workflow = { id: 'pasoFirmeMatchRequest11b', name: '11b Match Pending Request', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
fs.writeFileSync('workflows/11b-match-request.json', `${JSON.stringify(workflow, null, 2)}\n`);
