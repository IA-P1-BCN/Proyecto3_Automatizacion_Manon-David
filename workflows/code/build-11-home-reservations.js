// Regenerates workflows/11-home-reservations.json (inactive, no credentials) from the tested logic.
// Run from the repo root: node workflows/code/build-11-home-reservations.js
// Chosen by hand after import: the SMTP credential, flow 09 in "Check Consent (flow 09)" and flow 08 as the Error Workflow
// (credential and workflow IDs differ on every n8n instance). The Data Table `solicitudes_apartado` must exist first.
const fs = require('node:fs');
const { PRODUCTS, SIZES, optionLabel } = require('./11-home-reservations.js');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/11-home-reservations.js', 'utf8').replaceAll('\r\n', '\n');

const nodes = [];
const connections = {};

function node(name, type, typeVersion, parameters, x, y = 0, extra = {}) {
  nodes.push({ id: `home-reservations-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
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
const ending = (name, title, message, x, y) => node(name, 'form', 2.5,
  { operation: 'completion', completionTitle: title, completionMessage: message, options: { appendAttribution: false } }, x, y);
const table = { __rl: true, mode: 'name', value: 'solicitudes_apartado' };
const column = (id, type = 'string') => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type, canBeUsedToMatch: true });
const columns = [['ref'], ['nombre'], ['telefono'], ['email'], ['producto'], ['talla', 'number'], ['precio', 'number'], ['estado'], ['fecha']];
const today = "$now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd')";
const requested = "$('Check Duplicate').first().json";

// 1 · The customer's form
node('Request Form', 'formTrigger', 2.6, {
  formTitle: 'Reserva tus zapatos',
  formDescription: 'Cuéntanos qué zapatos quieres apartar. Te escribiremos con los pasos para pagar el abono inicial.',
  formFields: { values: [
    { fieldLabel: 'Nombre', requiredField: true },
    { fieldLabel: 'Teléfono' },
    { fieldLabel: 'Email', fieldType: 'email', requiredField: true },
    { fieldLabel: 'Modelo', fieldType: 'dropdown', fieldOptions: { values: PRODUCTS.map((item) => ({ option: optionLabel(item) })) }, requiredField: true },
    { fieldLabel: 'Talla', fieldType: 'dropdown', fieldOptions: { values: SIZES.map((size) => ({ option: String(size) })) }, requiredField: true },
    { fieldLabel: 'Consentimiento', fieldType: 'checkbox', fieldOptions: { values: [{ option: 'Acepto que la tienda me escriba sobre mi apartado' }] }, requiredField: true },
  ] },
  options: { buttonLabel: 'Solicitar', appendAttribution: false },
}, 0);

// 2 · Validate; nothing is stored when the data is wrong
code('Validate Request', `const form = $input.first().json;
return [{json: validateRequest({
  nombre: form['Nombre'], telefono: form['Teléfono'], email: form['Email'],
  producto: form['Modelo'], talla: form['Talla'], consentimiento: form['Consentimiento'],
})}];`, 240);
node('Is Request Valid?', 'if', 2.2, isTrue('valid', '={{ $json.valido }}'), 480);
ending('Show Errors', 'Revisa tu solicitud', "={{ $json.errores.join('<br>') }}", 720, 200);

// 3 · One request per customer, model and size; the reference is the next number in the table
node('Read Requests', 'dataTable', 1.1, { resource: 'row', operation: 'get', dataTableId: table, returnAll: true }, 720, 0, { alwaysOutputData: true });
code('Check Duplicate', `const solicitud = $('Validate Request').first().json.solicitud;
const rows = $input.all().map((item) => item.json);
return [{json: checkDuplicate(solicitud, rows, ${today})}];`, 960);
node('Is Duplicate?', 'if', 2.2, isTrue('duplicate', '={{ $json.duplicado }}'), 1200);
ending('Show Duplicate', 'Ya tenemos tu solicitud',
  "={{ 'Tu referencia es ' + $json.ref + '. Usa esa referencia como concepto del pago.' }}", 1440, 200);

// 4 · Store the pending request; no apartado exists in the app yet
node('Save Request', 'dataTable', 1.1, {
  resource: 'row', operation: 'insert', dataTableId: table,
  columns: {
    mappingMode: 'defineBelow',
    value: Object.fromEntries(columns.map(([id]) => [id, `={{ $json.row.${id} }}`])),
    matchingColumns: [], schema: columns.map(([id, type]) => column(id, type)),
  },
  options: {},
}, 1440, 0);

// 5 · Consent (flow 09 records it and answers) then the emails
code('Prepare Consent Check', `return [{json: {email: ${requested}.row.email, registrar: true}}];`, 1680);
node('Check Consent (flow 09)', 'executeWorkflow', 1.2, {
  source: 'database', workflowId: { __rl: true, value: '', mode: 'id' }, mode: 'once', options: { waitForSubWorkflow: true },
}, 1920);
code('Plan Emails', `const shopAddress = String($env.TIENDA_EMAIL_AVISOS || '').trim();
if (!shopAddress.includes('@')) throw new Error('Configure TIENDA_EMAIL_AVISOS.');
return planEmails({
  row: ${requested}.row, permitido: $input.first().json.permitido === true,
  shopAddress, paymentInstructions: $env.TIENDA_PAGO_INSTRUCCIONES,
}).map((json) => ({json}));`, 2160);
node('Send Email', 'emailSend', 2.1, {
  fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}', toEmail: '={{ $json.to }}',
  subject: '={{ $json.subject }}', emailFormat: 'text', text: '={{ $json.body }}', options: { appendAttribution: false },
}, 2400, 0, { onError: 'continueRegularOutput' });
code('Verify Emails', `verifyEmails($input.all().map((item) => item.json));
return [{json: {ref: ${requested}.ref}}];`, 2640);
ending('Show Result', 'Solicitud recibida',
  `={{ 'Tu referencia es ' + $json.ref + '. Te hemos escrito con los pasos para pagar el abono inicial.' }}`, 2880, 0);

for (const [from, to, output] of [
  ['Request Form', 'Validate Request'], ['Validate Request', 'Is Request Valid?'],
  ['Is Request Valid?', 'Read Requests', 0], ['Is Request Valid?', 'Show Errors', 1],
  ['Read Requests', 'Check Duplicate'], ['Check Duplicate', 'Is Duplicate?'],
  ['Is Duplicate?', 'Show Duplicate', 0], ['Is Duplicate?', 'Save Request', 1],
  ['Save Request', 'Prepare Consent Check'], ['Prepare Consent Check', 'Check Consent (flow 09)'],
  ['Check Consent (flow 09)', 'Plan Emails'], ['Plan Emails', 'Send Email'], ['Send Email', 'Verify Emails'], ['Verify Emails', 'Show Result'],
]) link(from, to, output);

const workflow = { id: 'pasoFirmeHomeReservations11', name: '11 Home Reservations', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
fs.writeFileSync('workflows/11-home-reservations.json', `${JSON.stringify(workflow, null, 2)}\n`);
