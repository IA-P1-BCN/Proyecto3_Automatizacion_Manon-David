// Regenerates workflows/06-due-reminders.json (inactive, no credentials) from the tested logic.
// Run from the repo root: node workflows/code/build-06-due-reminders.js
// Credentials (shop Header Auth, kDrive Header Auth, SMTP) and the Error Workflow (flow 08) are chosen by hand after import:
// credential and workflow IDs differ on every n8n instance.
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/06-due-reminders.js', 'utf8').replaceAll('\r\n', '\n');

const nodes = [];
const connections = {};

function node(name, type, typeVersion, parameters, x, y = 0, extra = {}) {
  nodes.push({ id: `due-reminders-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
}
function code(name, text, x, y = 0) {
  node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: `${core}\n${text}` }, x, y);
}
function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  connections[from].main[output] ||= [];
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
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
function http(name, url, parameters, x, y = 0, extra = {}) {
  node(name, 'httpRequest', 4.2, { method: 'GET', url, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: options(), ...parameters }, x, y, extra);
}
const run = "$('Prepare Run').first().json";

// 1 · Triggers and run date
node('Every Morning 09:00', 'scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * *' }] } }, 0);
code('Scheduled Input', "return [{json: {mode: 'scheduled'}}];", 220);
node('Manual Run', 'manualTrigger', 1, {}, 0, 220);
node('Choose Date', 'set', 3.4, { mode: 'manual', assignments: { assignments: [
  { id: 'mode', name: 'mode', value: 'manual', type: 'string' },
  { id: 'date', name: 'fecha', value: '={{ $now.setZone("Europe/Madrid").toFormat("yyyy-MM-dd") }}', type: 'string' },
] }, options: {} }, 220, 220);
code('Prepare Run', `const input = runInput($input.first().json, $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd'));
const drive = String($env.KDRIVE_DRIVE_ID || '');
const directory = String($env.KDRIVE_DIRECTORY_ID || '');
if (!/^[1-9]\\d*$/.test(drive) || !/^[1-9]\\d*$/.test(directory)) throw new Error('Configure KDRIVE_DRIVE_ID y KDRIVE_DIRECTORY_ID.');
return [{json: {...input, drive_id: drive, directory_id: directory}}];`, 460);

// 2 · Read the app and the sent-record
http('Fetch Reservations', '=http://tienda:8000/api/apartados', {
  sendQuery: true, queryParameters: { parameters: [{ name: 'estado', value: 'activo' }] },
}, 700, 0, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
http('List Records Folder', `=https://api.infomaniak.com/3/drive/{{ ${run}.drive_id }}/files/{{ ${run}.directory_id }}/files`, {
  sendQuery: true, queryParameters: { parameters: [{ name: 'with', value: 'etag' }, { name: 'limit', value: '1000' }] },
  options: { ...options(), pagination: { pagination: {
    paginationMode: 'updateAParameterInEachRequest',
    parameters: { parameters: [{ type: 'qs', name: 'cursor', value: '={{ $response.body.cursor || "" }}' }] },
    paginationCompleteWhen: 'other', completeExpression: '={{ $response.body.has_more === false }}',
    limitPagesFetched: true, maxRequests: 100,
  } } },
}, 940);
code('Locate Records', 'return [{json: {file: findRecordsFile($input.all().map((item) => item.json))}}];', 1180);
node('Records Exist?', 'if', 2.2, isTrue('exists', '={{ $json.file !== null }}'), 1420);
http('Download Records', `=https://api.infomaniak.com/2/drive/{{ ${run}.drive_id }}/files/{{ $json.file.id }}/download`, { options: options('text') }, 1660);
code('Read Downloaded Records', `const response = $input.first().json;
if (response.statusCode !== 200 || typeof response.data !== 'string') throw new Error('No se pudo leer el registro de avisos existente.');
return [{json: {csv: response.data}}];`, 1900);
code('No Records Yet', "return [{json: {csv: null}}];", 1660, 220);

// 3 · Decide and send
code('Plan Reminders', `const response = $('Fetch Reservations').first().json;
if (response.statusCode !== 200) throw new Error('No se pudo consultar la API de la tienda.');
const records = parseRecords($input.first().json.csv);
const shopAddress = String($env.TIENDA_EMAIL_AVISOS || '').trim();
if (!shopAddress.includes('@')) throw new Error('Configure TIENDA_EMAIL_AVISOS.');
const today = ${run}.fecha;
return planReminders({reservations: response.body, today, records, shopAddress}).map((json) => ({json}));`, 2140);
node('Send Reminder', 'emailSend', 2.1, {
  fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}', toEmail: '={{ $json.to }}',
  subject: '={{ $json.subject }}', emailFormat: 'text', text: '={{ $json.body }}', options: {},
}, 2380, 0, { onError: 'continueRegularOutput' });

// 4 · Record what was accepted, then fail if anything was rejected
code('Collect Results', `const planned = $('Plan Reminders').all().map((item) => item.json);
const results = $input.all().map((item) => item.json);
const state = ${run};
const outcome = collectResults(planned, results, state.fecha);
const existing = $('Read Downloaded Records').isExecuted ? $('Read Downloaded Records').first().json.csv : null;
const file = $('Locate Records').first().json.file;
const csv = outcome.rows.length ? appendRecords(existing, outcome.rows) : null;
return [{json: {...state, file, csv, saved_rows: outcome.rows.length, failed: outcome.failed}}];`, 2620);
node('Has Rows To Save?', 'if', 2.2, isTrue('rows', '={{ $json.csv !== null }}'), 2860);
code('Prepare Upload', `const state = $input.first().json;
const size = Buffer.byteLength(state.csv, 'utf8');
if (size > 5000000) throw new Error('Registro de avisos demasiado grande para este flujo; revisar antes de modificar.');
const query = state.file ? 'file_id=' + state.file.id : 'directory_id=' + state.directory_id + '&file_name=avisos.csv&conflict=error';
const url = 'https://api.infomaniak.com/3/drive/' + state.drive_id + '/upload?' + query + '&total_size=' + size + '&with=etag';
return [{json: {...state, upload_url: url, if_match: state.file ? state.file.etag : 'blank'}, binary: {data: await this.helpers.prepareBinaryData(Buffer.from(state.csv, 'utf8'), 'avisos.csv', 'text/csv')}}];`, 3100);
http('Save Records', '={{ $json.upload_url }}', {
  method: 'POST', sendHeaders: true, headerParameters: { parameters: [
    { name: 'If-Match', value: '={{ $json.if_match }}' },
    { name: 'Content-Type', value: 'application/octet-stream' },
  ] },
  sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data',
}, 3340);
code('Verify Saved', `const response = $input.first().json;
const state = $('Prepare Upload').first().json;
if (response.body?.result !== 'success' || !Number.isSafeInteger(response.body?.data?.id)) throw new Error('kDrive no confirmó el guardado del registro de avisos; revisar antes de repetir.');
if (state.file && response.body.data.id !== state.file.id) throw new Error('kDrive devolvió un ID distinto del registro de avisos.');
if (state.failed > 0) throw new Error(state.failed + ' recordatorio(s) no se pudieron enviar; los enviados quedaron registrados. Revisar la credencial SMTP.');
return [{json: {fecha: state.fecha, recordatorios_registrados: state.saved_rows, fallidos: 0}}];`, 3580);
code('Verify Without Save', `const state = $input.first().json;
if (state.failed > 0) throw new Error(state.failed + ' recordatorio(s) no se pudieron enviar y no se registró ninguno. Revisar la credencial SMTP.');
return [{json: {fecha: state.fecha, recordatorios_registrados: 0, fallidos: 0}}];`, 3100, 220);

for (const [from, to] of [
  ['Every Morning 09:00', 'Scheduled Input'], ['Scheduled Input', 'Prepare Run'], ['Manual Run', 'Choose Date'], ['Choose Date', 'Prepare Run'],
  ['Prepare Run', 'Fetch Reservations'], ['Fetch Reservations', 'List Records Folder'], ['List Records Folder', 'Locate Records'],
  ['Locate Records', 'Records Exist?'], ['Download Records', 'Read Downloaded Records'],
  ['Read Downloaded Records', 'Plan Reminders'], ['No Records Yet', 'Plan Reminders'],
  ['Plan Reminders', 'Send Reminder'], ['Send Reminder', 'Collect Results'], ['Collect Results', 'Has Rows To Save?'],
  ['Prepare Upload', 'Save Records'], ['Save Records', 'Verify Saved'],
]) link(from, to);
link('Records Exist?', 'Download Records', 0);
link('Records Exist?', 'No Records Yet', 1);
link('Has Rows To Save?', 'Prepare Upload', 0);
link('Has Rows To Save?', 'Verify Without Save', 1);

const workflow = { id: 'pasoFirmeDueReminders06', name: '06 Due Date Reminders', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
fs.writeFileSync('workflows/06-due-reminders.json', `${JSON.stringify(workflow, null, 2)}\n`);
