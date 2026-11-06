// Generate an inactive credential-free workflow. Run from the repository root.
const fs = require('node:fs');
const core = fs.readFileSync('workflows/code/05-daily-close.js', 'utf8').replaceAll('\r\n', '\n');
const nodes = [], connections = {};
function node(name, type, typeVersion, parameters, x, y = 0, extra = {}) {
  nodes.push({ id: `daily-close-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
}
function code(name, text, x, y = 0) { node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: core + '\n' + text }, x, y); }
function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  connections[from].main[output] ||= [];
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}
const options = (format = 'json') => ({ timeout: 30000, response: { response: { fullResponse: true, responseFormat: format } } });
function http(name, url, parameters, x, extra = {}) {
  node(name, 'httpRequest', 4.2, { method: 'GET', url, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', options: options(), ...parameters }, x, 0, extra);
}
const cfg = "$('Prepare Close').first().json";
node('Nightly 23:55', 'scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: '55 23 * * *' }] } }, 0);
code('Scheduled Input', "return [{json: {mode:'scheduled', send_email:true}}];", 200);
node('Manual Close', 'manualTrigger', 1, {}, 0, 220);
node('Choose Date and Email', 'set', 3.4, { mode: 'manual', assignments: { assignments: [
  { id: 'mode', name: 'mode', value: 'manual', type: 'string' },
  { id: 'date', name: 'fecha', value: '={{ $now.setZone("Europe/Madrid").toFormat("yyyy-MM-dd") }}', type: 'string' },
  { id: 'email', name: 'send_email', value: false, type: 'boolean' },
] }, options: {} }, 200, 220);
code('Prepare Close', `const input = inputDate($input.first().json, $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd'));
const drive = String($env.KDRIVE_DRIVE_ID || '');
const directory = String($env.KDRIVE_DIRECTORY_ID || '');
if (!/^[1-9]\\d*$/.test(drive) || !/^[1-9]\\d*$/.test(directory)) throw new Error('Configure KDRIVE_DRIVE_ID y KDRIVE_DIRECTORY_ID.');
return [{json: {...input, drive_id:drive, directory_id:directory}}];`, 440);
for (const [name, endpoint, x] of [['Fetch Sales', 'ventas', 680], ['Fetch Deposits', 'abonos', 900]]) {
  http(name, `=http://tienda:8000/api/${endpoint}`, { sendQuery: true, queryParameters: { parameters: [
    { name: 'desde', value: `={{ ${cfg}.fecha }}` }, { name: 'hasta', value: `={{ ${cfg}.fecha }}` },
  ] } }, x, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
}
code('Calculate Close', `const sales = $('Fetch Sales').first().json;
const deposits = $('Fetch Deposits').first().json;
if (sales.statusCode !== 200 || deposits.statusCode !== 200) throw new Error('No se pudo consultar la API de la tienda.');
return [{json:{...${cfg}, ...calculate(${cfg}.fecha, sales.body, deposits.body)}}];`, 1120);
node('Email Requested', 'if', 2.2, { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [
  { id: 'email', leftValue: '={{ $json.send_email }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
], combinator: 'and' }, options: {} }, 1340);
node('Send Closing Email', 'emailSend', 2.1, {
  fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}', toEmail: '={{ $env.TIENDA_EMAIL_AVISOS }}',
  subject: '={{ $json.subject }}', emailFormat: 'text', text: '={{ $json.body }}', options: {},
}, 1550, -120, { onError: 'continueRegularOutput' });
code('Remember Email Result', `return [{json:{email_failed: Boolean($input.first().json.error)}}];`, 1760, -120);
code('Email Skipped', `return [{json:{email_failed:false}}];`, 1550, 160);
http('List History Folder', `=https://api.infomaniak.com/3/drive/{{ ${cfg}.drive_id }}/files/{{ ${cfg}.directory_id }}/files`, {
  sendQuery: true, queryParameters: { parameters: [{ name: 'with', value: 'etag' }, { name: 'limit', value: '1000' }] },
  options: { ...options(), pagination: { pagination: {
    paginationMode: 'updateAParameterInEachRequest', parameters: { parameters: [
      { type: 'qs', name: 'cursor', value: '={{ $response.body.cursor || "" }}' },
    ] }, paginationCompleteWhen: 'other', completeExpression: '={{ $response.body.has_more === false }}',
    limitPagesFetched: true, maxRequests: 100,
  } } },
}, 1980);
code('Locate History', `const file = findHistory($input.all().map(item => item.json));
const email_failed = $('Remember Email Result').isExecuted ? $('Remember Email Result').first().json.email_failed : false;
return [{json:{...$('Calculate Close').first().json, email_failed, file}}];`, 2200);
node('History Exists', 'if', 2.2, { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [
  { id: 'exists', leftValue: '={{ $json.file !== null }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
], combinator: 'and' }, options: {} }, 2420);
http('Download History', `=https://api.infomaniak.com/2/drive/{{ ${cfg}.drive_id }}/files/{{ $json.file.id }}/download`, {
  options: options('text'),
}, 2640);
code('Update History CSV', `const response = $input.first().json;
const csvText = response.data;
if (response.statusCode !== 200 || typeof csvText !== 'string') throw new Error('No se pudo leer el histórico existente.');
const state = $('Locate History').first().json;
return [{json:{...state, csv:upsertHistory(csvText, state.row)}}];`, 2860);
code('Create History CSV', `const state = $input.first().json;
return [{json:{...state, csv:upsertHistory(null,state.row)}}];`, 2640, 220);
code('Prepare Upload', `const state = $input.first().json;
const size = Buffer.byteLength(state.csv, 'utf8');
if (size > 5000000) throw new Error('Histórico demasiado grande para este flujo; revisar antes de modificar.');
const query = state.file ? 'file_id='+state.file.id : 'directory_id='+state.directory_id+'&file_name=basedatos.csv&conflict=error';
const url = 'https://api.infomaniak.com/3/drive/'+state.drive_id+'/upload?'+query+'&total_size='+size+'&with=etag';
return [{json:{...state,upload_url:url,if_match:state.file ? state.file.etag : 'blank'}, binary:{data:await this.helpers.prepareBinaryData(Buffer.from(state.csv,'utf8'),'basedatos.csv','text/csv')}}];`, 3080);
http('Save History', '={{ $json.upload_url }}', {
  method: 'POST', sendHeaders: true, headerParameters: { parameters: [
    { name: 'If-Match', value: '={{ $json.if_match }}' },
    { name: 'Content-Type', value: 'application/octet-stream' },
  ] },
  sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data', options: options(),
}, 3300);
code('Verify Result', `const response = $input.first().json;
const state = $('Prepare Upload').first().json;
if (response.body?.result !== 'success' || !Number.isSafeInteger(response.body?.data?.id)) throw new Error('kDrive no confirmó el guardado; revisar antes de repetir.');
if (state.file && response.body.data.id !== state.file.id) throw new Error('kDrive devolvió un ID distinto del histórico.');
if (state.email_failed) throw new Error('El histórico se guardó, pero falló el envío del resumen. Revisar credencial SMTP.');
return [{json:{fecha:state.fecha,total_centimos:state.row.total,history_file_id:response.body.data.id,email_requested:state.send_email,history_saved:true}}];`, 3520);
link('Nightly 23:55','Scheduled Input'); link('Scheduled Input','Prepare Close');
link('Manual Close','Choose Date and Email'); link('Choose Date and Email','Prepare Close');
for (const [from,to] of [['Prepare Close','Fetch Sales'],['Fetch Sales','Fetch Deposits'],['Fetch Deposits','Calculate Close'],['Calculate Close','Email Requested'],
  ['Send Closing Email','Remember Email Result'],['Remember Email Result','List History Folder'],['Email Skipped','List History Folder'],
  ['List History Folder','Locate History'],['Locate History','History Exists'],['Download History','Update History CSV'],['Update History CSV','Prepare Upload'],
  ['Create History CSV','Prepare Upload'],['Prepare Upload','Save History'],['Save History','Verify Result']]) link(from,to);
link('Email Requested','Send Closing Email',0); link('Email Requested','Email Skipped',1);
link('History Exists','Download History',0); link('History Exists','Create History CSV',1);
const workflow = { id: 'pasoFirmeDailyClose05', name: '05 Daily Close', active: false, nodes, connections,
  settings: { executionOrder:'v1', timezone:'Europe/Madrid' } };
fs.writeFileSync('workflows/05-daily-close.json', JSON.stringify(workflow,null,2)+'\n');
