// Explicit generation only: node workflows/code/build-07-monthly-report.js --write
const fs = require('node:fs');
const path = require('node:path');

function buildMonthlyReport() {
  const core = fs.readFileSync(path.join(__dirname, '07-monthly-report.js'), 'utf8').replaceAll('\r\n', '\n');
  const pdfCore = fs.readFileSync(path.join(__dirname, '07-monthly-pdf.js'), 'utf8').replaceAll('\r\n', '\n');
  const nodes = [], connections = {};
  const add = (name, type, version, parameters, x, y = 0, extra = {}) => {
    nodes.push({ id: `monthly-report-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion: version, position: [x, y], parameters, ...extra });
  };
  const code = (name, jsCode, x, y = 0) => add(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: core + '\n' + jsCode }, x, y);
  const link = (from, to, output = 0) => {
    connections[from] ||= { main: [] };
    connections[from].main[output] ||= [];
    connections[from].main[output].push({ node: to, type: 'main', index: 0 });
  };
  add('Monthly Day 1 at 09:00', 'scheduleTrigger', 1.2, { rule: { interval: [{ field: 'cronExpression', expression: '0 9 1 * *' }] } }, 0);
  add('Scheduled Report Input', 'set', 3.4, { mode: 'manual', assignments: { assignments: [
    { id: 'mode', name: 'mode', value: 'scheduled', type: 'string' },
    { id: 'pdf', name: 'include_pdf', value: false, type: 'boolean' },
    { id: 'scheduled-execution', name: 'scheduled_execution', value: "={{ $mode === 'trigger' }}", type: 'boolean' },
  ] }, options: {} }, 220);
  add('Manual Report Preview', 'manualTrigger', 1, {}, 0, 240);
  add('Choose Month and Delivery', 'set', 3.4, { mode: 'manual', assignments: { assignments: [
    { id: 'mode', name: 'mode', value: 'manual', type: 'string' },
    { id: 'month', name: 'month', value: '={{ $now.setZone("Europe/Madrid").minus({months:1}).toFormat("yyyy-MM") }}', type: 'string' },
    { id: 'email', name: 'send_email', value: false, type: 'boolean' },
    { id: 'pdf', name: 'include_pdf', value: false, type: 'boolean' },
  ] }, options: {} }, 220, 240);
  code('Prepare Monthly Period', `const period = reportPeriod(reportGuardInput($input.first().json), $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd'));
if (period.send_email) {
  for (const key of ['TIENDA_EMAIL_FROM', 'TIENDA_EMAIL_AVISOS']) {
    if (!/^[^\\s<>@,;]+@[^\\s<>@,;]+\\.[^\\s<>@,;]+$/.test(String($env[key] || ''))) throw new Error('Configure una dirección válida en '+key+'.');
  }
}
return [{json:{...period, consulted_at:$now.toISO()}}];`, 460);
  const cfg = "$('Prepare Monthly Period').first().json";
  const sources = [
    ['Fetch Monthly Sales', 'ventas', true, 700],
    ['Fetch Monthly Deposits', 'abonos', true, 920],
    ['Fetch Current Reservations', 'apartados', false, 1140],
    ['Fetch Payment History', 'abonos', false, 1360],
    ['Fetch Vouchers', 'vales', false, 1580],
  ];
  for (const [name, endpoint, filtered, x] of sources) {
    const parameters = {
      method: 'GET', url: `http://tienda:8000/api/${endpoint}`, authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth',
      options: { timeout: 30000, response: { response: { fullResponse: true, responseFormat: 'json' } } },
    };
    if (filtered) {
      parameters.sendQuery = true;
      parameters.queryParameters = { parameters: ['desde', 'hasta'].map(name => ({ name, value: `={{ ${cfg}.${name} }}` })) };
    }
    add(name, 'httpRequest', 4.2, parameters, x, 0, { retryOnFail: true, maxTries: 3, waitBetweenTries: 1500 });
  }
  code('Calculate Monthly Report', `const period = ${cfg};
const report = reportCalculate(period, {
 sales:reportResponse($('Fetch Monthly Sales').first().json,'ventas',true),
 deposits:reportResponse($('Fetch Monthly Deposits').first().json,'abonos'),
 reservations:reportResponse($('Fetch Current Reservations').first().json,'apartados',true),
 history:reportResponse($('Fetch Payment History').first().json,'histórico de abonos'),
 vouchers:reportResponse($('Fetch Vouchers').first().json,'vales'),
},period.consulted_at);
return [{json:{...period,report}}];`, 1800);
  code('Format Monthly Report', `const input = $input.first().json;
return [{json:{...input,...reportRender(input.report),delivery_requested:reportShouldSend(input,$getWorkflowStaticData('global'))}}];`, 2020);
  add('Report Email Requested', 'if', 2.2, { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [
    { id: 'email', leftValue: '={{ $json.delivery_requested }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
  ], combinator: 'and' }, options: {} }, 2240);
  add('Send Monthly Report', 'emailSend', 2.1, { fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}', toEmail: '={{ $env.TIENDA_EMAIL_AVISOS }}', subject: '={{ $json.subject }}', emailFormat: 'html', html: '={{ $json.html }}', options: { fileAttachments: "={{ $json.pdf_attached ? 'pdf' : '' }}" } }, 2460, -120);
  code('Record Monthly Delivery', `const state = $getWorkflowStaticData('global');
const period = $('Format Monthly Report').first().json;
reportRemember(state,period,$input.first().json.messageId);
const delivery = $('Report Email Requested').first().json;
return [{json:{month:period.month,report:period.report,email_sent:true,pdf_attached:delivery.pdf_attached===true,pdf_warning:delivery.pdf_warning===true}}];`, 2680, -120);
  code('Monthly Preview Result', `const item = $input.first();
const result = item.json;
return [{json:{...result,email_sent:false,delivery_skipped:result.send_email ? 'already_sent_scheduled_period' : 'manual_preview'},...(item.binary ? {binary:item.binary} : {})}];`, 2460, 160);
  add('PDF Requested', 'if', 2.2, { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 2 }, conditions: [
    { id: 'pdf', leftValue: '={{ $json.include_pdf }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } },
  ], combinator: 'and' }, options: {} }, 2020, 400);
  // Append the new nodes: retain the original baseline node IDs and positions.
  code('Create PDF Input', `const item = $input.first();
return [{json:item.json,binary:{data:await this.helpers.prepareBinaryData(Buffer.from(item.json.html,'utf8'),'index.html','text/html')}}];`, 2240, 400);
  nodes[nodes.length - 1].onError = 'continueRegularOutput';
  add('Convert Report to PDF', 'httpRequest', 4.2, {
    method: 'POST', url: 'http://monthly-pdf:3000/forms/chromium/convert/html',
    sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [
      { parameterType: 'formBinaryData', name: 'files', inputDataFieldName: 'data' },
      { name: 'printBackground', value: 'true' }, { name: 'preferCssPageSize', value: 'true' },
    ] },
    options: { timeout: 35000, response: { response: { fullResponse: true, responseFormat: 'file', outputPropertyName: 'pdf' } } },
  }, 2460, 400, { onError: 'continueRegularOutput' });
  code('Validate PDF Result', pdfCore + `
const state = $('Format Monthly Report').first().json;
try {
 const item = $input.first();
 if (item.json.statusCode !== 200 || !item.binary?.pdf) throw new Error('pdf_unavailable');
 const bytes = await this.helpers.getBinaryDataBuffer(0,'pdf');
 if (!monthlyPdfValid(bytes,item.binary.pdf.mimeType)) throw new Error('pdf_invalid');
 const pdf = await this.helpers.prepareBinaryData(bytes,state.pdf_filename,'application/pdf');
 return [{json:{...state,pdf_attached:true,pdf_warning:false},binary:{pdf}}];
} catch (_) {
 return [{json:{...state,...reportRender(state.report,true),pdf_attached:false,pdf_warning:true}}];
}`, 2680, 400);
  code('PDF Skipped', `return [{json:{...$input.first().json,pdf_attached:false,pdf_warning:false}}];`, 2240, 650);
  link('Monthly Day 1 at 09:00', 'Scheduled Report Input');
  link('Scheduled Report Input', 'Prepare Monthly Period');
  link('Manual Report Preview', 'Choose Month and Delivery');
  link('Choose Month and Delivery', 'Prepare Monthly Period');
  const chain = ['Prepare Monthly Period', ...sources.map(row => row[0]), 'Calculate Monthly Report', 'Format Monthly Report', 'PDF Requested'];
  for (let i = 0; i < chain.length - 1; i++) link(chain[i], chain[i + 1]);
  link('Report Email Requested', 'Send Monthly Report', 0);
  link('Report Email Requested', 'Monthly Preview Result', 1);
  link('Send Monthly Report', 'Record Monthly Delivery');
  link('PDF Requested', 'Create PDF Input', 0);
  link('PDF Requested', 'PDF Skipped', 1);
  link('Create PDF Input', 'Convert Report to PDF');
  link('Convert Report to PDF', 'Validate PDF Result');
  link('Validate PDF Result', 'Report Email Requested');
  link('PDF Skipped', 'Report Email Requested');
  // Prefer the safe manual trigger when a client chooses the first trigger.
  const manualIndex = nodes.findIndex(node => node.type === 'n8n-nodes-base.manualTrigger');
  nodes.unshift(...nodes.splice(manualIndex, 1));
  return { name: '07 Monthly Report', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
}

if (require.main === module) {
  if (!process.argv.includes('--write')) throw new Error('Use --write explicitly. Tests must not overwrite the canonical JSON.');
  const destination = path.join(__dirname, '..', '07-monthly-report.json');
  const workflow = buildMonthlyReport();
  if (fs.existsSync(destination)) {
    const previous = JSON.parse(fs.readFileSync(destination, 'utf8'));
    for (const node of workflow.nodes) {
      const old = previous.nodes.find(item => item.name === node.name && item.type === node.type);
      if (old) { node.id = old.id; node.position = old.position; }
    }
  }
  fs.writeFileSync(destination, JSON.stringify(workflow, null, 2) + '\n');
}
module.exports = { buildMonthlyReport };
