// Regenerates workflows/10-excel-migration.json (inactive, no credentials) from the tested logic.
// Run from the repo root: node workflows/code/build-10-excel-migration.js
// Credentials (shop Header Auth, SMTP) and the Error Workflow (flow 08) are chosen by hand after import:
// credential and workflow IDs differ on every n8n instance. The Data Table `migration_state` is referenced by name.
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/10-excel-migration.js', 'utf8').replaceAll('\r\n', '\n');

const nodes = [];
const connections = {};
const APP = 'http://tienda:8000';

function node(name, type, typeVersion, parameters, x, y = 0, extra = {}) {
  nodes.push({ id: `excel-migration-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
}
function code(name, text, x, y = 0, extra = {}) {
  node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: `${core}\n${text}` }, x, y, extra);
}
function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  connections[from].main[output] ||= [];
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}
// Reads stop the run on any error (nothing has been created yet); creates never stop on a 4xx/5xx or a network error:
// the answer becomes an item and the next stage judges it (2xx created, 422 held, anything else stops the run).
const readOptions = { timeout: 30000, response: { response: { fullResponse: true, responseFormat: 'json' } } };
const writeOptions = { timeout: 30000, response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } } };
function http(name, parameters, x, y = 0, extra = {}) {
  node(name, 'httpRequest', 4.2, { method: 'GET', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: readOptions, ...parameters }, x, y, extra);
}
// `method` must be a literal: with an expression n8n hides the body options and sends no body.
const post = (name, x, y = 0) => http(name, {
  method: 'POST',
  url: `={{ '${APP}' + $json.path }}`,
  sendBody: true,
  contentType: 'json',
  specifyBody: 'json',
  jsonBody: '={{ JSON.stringify($json.body) }}',
  options: writeOptions,
}, x, y, { onError: 'continueRegularOutput' });
const hasRequests = (name, id, x, y = 0) => node(name, 'if', 2.2, {
  conditions: {
    options: { caseSensitive: true, typeValidation: 'strict', version: 2 },
    conditions: [{ id, leftValue: '={{ !$json.empty }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
    combinator: 'and',
  },
  options: {},
}, x, y);
const flagTable = { __rl: true, mode: 'name', value: 'migration_state' };
const flagSchema = [
  { id: 'clave', displayName: 'clave', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
  { id: 'activa', displayName: 'activa', required: false, defaultMatch: false, display: true, type: 'boolean', canBeUsedToMatch: true },
  { id: 'desde', displayName: 'desde', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true },
];
const setFlag = (name, on, x, y, extra) => node(name, 'dataTable', 1.1, {
  resource: 'row',
  operation: 'upsert',
  dataTableId: flagTable,
  matchType: 'allConditions',
  filters: { conditions: [{ keyName: 'clave', condition: 'eq', keyValue: 'migracion' }] },
  columns: { mappingMode: 'defineBelow', value: { clave: 'migracion', activa: on, desde: on ? '={{ $now.toUTC().toISO() }}' : '' }, matchingColumns: [], schema: flagSchema },
  options: {},
}, x, y, extra);
const stopOnError = { onError: 'continueErrorOutput' };

// 1 · The form and the two sheets
node('Upload CSV Files', 'formTrigger', 2.5, {
  formTitle: 'Migración del Excel antiguo',
  formDescription: 'Sube el CSV de apartados y el CSV de ventas. Se cargan en la app con su fecha original; lo dudoso no se carga y te llega en un correo.',
  formFields: { values: [
    { fieldLabel: 'Apartados', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.csv', requiredField: true },
    { fieldLabel: 'Ventas', fieldType: 'file', multipleFiles: false, acceptFileTypes: '.csv', requiredField: true },
  ] },
  // With a Form node further down, n8n answers the submission from that last page by itself.
  options: { buttonLabel: 'Migrar' },
}, 0, 0, { webhookId: 'excel-migration-form' });
code('Prepare Migration', `const binary = $input.first().binary || {};
const shopAddress = String($env.TIENDA_EMAIL_AVISOS || '').trim();
if (!shopAddress.includes('@')) throw new Error('Configure TIENDA_EMAIL_AVISOS.');
const read = async (word) => {
  const key = Object.keys(binary).find((name) => name.toLowerCase().startsWith(word));
  if (!key) throw new Error('Falta el fichero de ' + word + '.');
  return (await this.helpers.getBinaryDataBuffer(0, key)).toString('utf8');
};
const prepared = prepareMigration(parseCsv(await read('apartados')), parseCsv(await read('ventas')));
return [{json: {...prepared, range: salesRange(prepared.sales)}}];`, 260);

// 2 · What the app already holds (nothing is created yet, so any error here just stops the run)
http('Read App Apartados', { url: `=${APP}/api/apartados` }, 520, 0, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
code('List Existing Apartados', `const prepared = $('Prepare Migration').first().json;
const apps = $input.first().json.body;
if (!Array.isArray(apps)) throw new Error('La app no devolvió la lista de apartados.');
const ids = [...new Set(findExisting(prepared.reservations, apps).map((found) => found.existingId).filter((id) => id !== null))];
return (ids.length ? ids.map((id) => ({path: '/api/apartados/' + id})) : [{path: SENTINEL.path}]).map((json) => ({json}));`, 780);
http('Read Existing Details', { url: `={{ '${APP}' + $json.path }}` }, 1040, 0, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
http('Read App Sales', {
  url: `=${APP}/api/ventas`,
  sendQuery: true,
  queryParameters: { parameters: [
    { name: 'desde', value: "={{ $('Prepare Migration').first().json.range?.desde ?? '2000-01-01' }}" },
    { name: 'hasta', value: "={{ $('Prepare Migration').first().json.range?.hasta ?? '2000-01-01' }}" },
  ] },
}, 1300, 0, { executeOnce: true, retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
code('Plan Creates', `const prepared = $('Prepare Migration').first().json;
const apps = $('Read App Apartados').first().json.body;
const appSales = $input.first().json.body;
if (!Array.isArray(appSales)) throw new Error('La app no devolvió la lista de ventas.');
const details = new Map($('Read Existing Details').all().map((item) => item.json.body).filter((body) => body && Array.isArray(body.abonos)).map((body) => [body.id, body]));
const existing = new Map();
for (const found of findExisting(prepared.reservations, apps)) {
  if (found.existingId === null) continue;
  const detail = details.get(found.existingId);
  if (!detail) throw new Error('No se pudo leer el apartado ' + found.existingId + ' de la app.');
  existing.set(found.key, {id: found.existingId, abonos: detail.abonos.map((abono) => ({fecha: abono.fecha, importe: abono.importe}))});
}
const plan = planCreates({reservations: prepared.reservations, sales: prepared.sales, existing, appSales});
return [{json: {...plan, held: prepared.held}}];`, 1560);

// 3 · Switch the migration flag on, then create apartados, abonos and sales in three stages.
// A stage with nothing to send hands one `{ empty: true }` marker around its HTTP node (n8n skips a node that gets no items).
setFlag('Flag On', true, 1820, 0);
code('Build Apartado Requests', "return withMarker(apartadoRequests($('Plan Creates').first().json.creates)).map((json) => ({json}));", 2080, 0, stopOnError);
hasRequests('Apartados To Send?', 'apartados', 2340);
post('Create Apartados', 2600);
code('Build Abono Requests', `const plan = $('Plan Creates').first().json;
const stage = abonoRequests(plan.creates, {requests: real($('Build Apartado Requests').all().map((item) => item.json)), responses: real($input.all().map((item) => item.json))});
return withMarker(stage.requests).map((json) => ({json}));`, 2860, 0, stopOnError);
hasRequests('Abonos To Send?', 'abonos', 3120);
post('Create Abonos', 3380);
code('Build Sale Requests', `const plan = $('Plan Creates').first().json;
resolveAbonos({requests: real($('Build Abono Requests').all().map((item) => item.json)), responses: real($input.all().map((item) => item.json))});
return withMarker(saleRequests(plan.sales)).map((json) => ({json}));`, 3640, 0, stopOnError);
hasRequests('Sales To Send?', 'sales', 3900);
post('Create Sales', 4160);

// 4 · Result, flag off, report
code('Summarise Run', `const plan = $('Plan Creates').first().json;
const sent = (name) => ($(name).isExecuted ? real($(name).all().map((item) => item.json)) : []);
const apartados = abonoRequests(plan.creates, {requests: real($('Build Apartado Requests').all().map((item) => item.json)), responses: sent('Create Apartados')});
const abonos = resolveAbonos({requests: real($('Build Abono Requests').all().map((item) => item.json)), responses: sent('Create Abonos')});
const sales = resolveSales({requests: real($('Build Sale Requests').all().map((item) => item.json)), responses: sent('Create Sales')});
return [{json: {
  created: {apartados: apartados.createdApartados, abonos: abonos.created, ventas: sales.created},
  skipped: plan.skipped,
  held: sortHeld([...plan.held, ...apartados.held, ...abonos.held, ...sales.held]),
  defaults: [...apartados.defaults, ...abonos.defaults],
}}];`, 4420, 0, stopOnError);
// The app sends its webhooks right after each create, but n8n starts the router executions up to a second or two later
// (measured on 2.44.5). Switching the flag off at once would let the last events through, so the flag stays on a little longer.
node('Let Events Pass', 'wait', 1.1, { resume: 'timeInterval', amount: 15, unit: 'seconds' }, 4680, 0, { webhookId: 'excel-migration-wait' });
setFlag('Flag Off', false, 4940, 0, { onError: 'continueErrorOutput' });
code('Build Report', `const flagError = Boolean($input.first()?.json?.error);
const outcome = $('Summarise Run').first().json;
return [{json: buildReport({...outcome, flagError})}];`, 5200);
node('Send Report', 'emailSend', 2.1, {
  fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}', toEmail: '={{ $env.TIENDA_EMAIL_AVISOS }}',
  subject: '={{ $json.subject }}', emailFormat: 'text', text: '={{ $json.body }}', options: {},
}, 5460);
node('Show Result', 'form', 2.5, {
  operation: 'completion',
  completionTitle: 'Migración terminada',
  completionMessage: 'Marisa ha recibido el informe por correo con lo cargado y lo que necesita su decisión.',
  options: {},
}, 5720);

// 5 · Failure path: switch the flag off, then fail so flow 08 alerts
code('Describe Failure', `const error = $json.error;
const message = typeof error === 'string' ? error : (error && (error.message || error.description)) || 'error desconocido';
return [{json: {message}}];`, 2600, 300);
setFlag('Flag Off After Failure', false, 2860, 300, { onError: 'continueRegularOutput' });
code('Fail Run', `const message = $('Describe Failure').first().json.message;
const flagStuck = Boolean($input.first()?.json?.error);
throw new Error('La migración se detuvo: ' + message + (flagStuck ? ' ATENCIÓN: no se pudo desactivar el aviso de migración; caduca solo a los 30 minutos.' : ' El aviso de migración se desactivó; repetirla carga solo lo que falte.'));`, 3120, 300);

for (const [from, to] of [
  ['Upload CSV Files', 'Prepare Migration'], ['Prepare Migration', 'Read App Apartados'], ['Read App Apartados', 'List Existing Apartados'],
  ['List Existing Apartados', 'Read Existing Details'], ['Read Existing Details', 'Read App Sales'], ['Read App Sales', 'Plan Creates'],
  ['Plan Creates', 'Flag On'], ['Flag On', 'Build Apartado Requests'], ['Build Apartado Requests', 'Apartados To Send?'],
  ['Create Apartados', 'Build Abono Requests'], ['Build Abono Requests', 'Abonos To Send?'], ['Create Abonos', 'Build Sale Requests'],
  ['Build Sale Requests', 'Sales To Send?'], ['Create Sales', 'Summarise Run'], ['Summarise Run', 'Let Events Pass'], ['Let Events Pass', 'Flag Off'],
  ['Flag Off', 'Build Report'], ['Build Report', 'Send Report'], ['Send Report', 'Show Result'],
  ['Describe Failure', 'Flag Off After Failure'], ['Flag Off After Failure', 'Fail Run'],
]) link(from, to);
// Gates: requests go through the HTTP node, a lone marker goes around it.
link('Apartados To Send?', 'Create Apartados', 0);
link('Apartados To Send?', 'Build Abono Requests', 1);
link('Abonos To Send?', 'Create Abonos', 0);
link('Abonos To Send?', 'Build Sale Requests', 1);
link('Sales To Send?', 'Create Sales', 0);
link('Sales To Send?', 'Summarise Run', 1);
link('Flag Off', 'Build Report', 1);
for (const name of ['Build Apartado Requests', 'Build Abono Requests', 'Build Sale Requests', 'Summarise Run']) link(name, 'Describe Failure', 1);

const workflow = { id: 'pasoFirmeExcelMigration10', name: '10 Excel Migration', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
fs.writeFileSync('workflows/10-excel-migration.json', `${JSON.stringify(workflow, null, 2)}\n`);
