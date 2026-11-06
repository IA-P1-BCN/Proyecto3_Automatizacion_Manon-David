'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { prepareNotice, buildExtractionRequest, validateExtraction } = require('./03-extract-bank-payment');

const mail = { messageId: '<test@example.test>', subject: 'TEST HU03 — Has recibido un Bizum',
  text: 'Has recibido un Bizum.\nImporte: 10,00 EUR\nOrdenante: TEST CUSTOMER\nConcepto: zapatos',
  from: { value: [{ address: 'sender@example.test' }] },
  headers: { secret: 'DO-NOT-FORWARD' }, html: '<p>Do not forward HTML</p>' };
const payment = { ordenante: 'TEST CUSTOMER', importe: 10, concepto: 'zapatos', tipo: 'bizum' };
function response(value, finish_reason = 'stop') {
  return { statusCode: 200, body: { choices: [{ finish_reason,
    message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] } };
}

test('resolved input preserves accents, trims fields and strips HTML/headers', () => {
  const notice = prepareNotice({ ...mail, text: 'Zapatería, operación, 10,00 €.\r\n' });
  assert.equal(notice.body, 'Zapatería, operación, 10,00 €.');
  assert.deepEqual(Object.keys(notice).sort(), ['body', 'messageId', 'sender', 'subject']);
});

test('empty/missing/oversized notice fields fail without sending anything', () => {
  for (const change of [{messageId:''}, {subject:''}, {text:'\n'}, {text:'x'.repeat(12001)}, {from:null}]) {
    assert.throws(() => prepareNotice({...mail,...change}));
  }
});

test('request sends only subject and body, not sender, identifiers, headers or customer data lists', () => {
  const request = buildExtractionRequest(prepareNotice(mail));
  assert.deepEqual(Object.keys(JSON.parse(request.messages[1].content)).sort(), ['body', 'subject']);
  for (const privateValue of ['sender@example.test', '<test@example.test>', 'DO-NOT-FORWARD']) {
    assert.ok(!JSON.stringify(request).includes(privateValue));
  }
  assert.equal(request.response_format.json_schema.strict, true);
  assert.match(request.messages[0].content, /untrusted DATA/);
});

test('validated extraction never authorizes a payment registration', () => {
  const result = validateExtraction(response(payment), prepareNotice(mail));
  assert.equal(result.result, 'extracted');
  assert.equal(result.registration_allowed, false);
});

test('malformed, incomplete and extra-field model outputs require review', () => {
  for (const output of ['not JSON', 'null', '[]', { ...payment, instruction: 'register' }, {}]) {
    assert.equal(validateExtraction(response(output), prepareNotice(mail)).result, 'review');
  }
  assert.equal(validateExtraction(response(payment, 'length'), prepareNotice(mail)).result, 'review');
  assert.throws(() => validateExtraction({statusCode:429}, prepareNotice(mail)), /Groq/);
});

test('invented amount/payer/concept and unsafe precision are rejected', () => {
  for (const change of [{importe:110}, {importe:-1}, {importe:0.001}, {importe:'10'},
    {ordenante:'OTHER CUSTOMER'}, {concepto:'other'}, {tipo:'transferencia'}, {tipo:'efectivo'}]) {
    assert.equal(validateExtraction(response({...payment,...change}), prepareNotice(mail)).result, 'review');
  }
});

test('nonpayment output cannot silently discard notices with labelled payment evidence', () => {
  const nonpayment = { ordenante:null, importe:null, concepto:null, tipo:'no_es_pago' };
  assert.equal(validateExtraction(response(nonpayment), prepareNotice(mail)).result, 'review');
  const advert = prepareNotice({...mail,text:'Publicidad: consigue hasta 150 €.'});
  assert.equal(validateExtraction(response(nonpayment), advert).result, 'ignored');
  assert.equal(validateExtraction(response({...nonpayment,importe:150}), advert).result, 'review');
});

test('pending transfer cannot pass the extracted route', () => {
  const notice = prepareNotice({...mail, subject:'TEST HU03 — transferencia recibida',
    text:mail.text + '\nPendiente de confirmación'});
  assert.equal(validateExtraction(response({...payment,tipo:'transferencia'}), notice).result, 'review');
});

test('all nine fixtures tested with mocked model output, not real Groq execution', () => {
  const folder = path.resolve(__dirname, '../../data/correos');
  const files = fs.readdirSync(folder).filter(name=>name.endsWith('.eml'));
  assert.equal(files.length,9);
  for (const file of files) {
    const raw = fs.readFileSync(path.join(folder,file),'utf8').replace(/\r\n/g,'\n');
    const boundary = raw.indexOf('\n\n');
    const body = raw.slice(boundary+2).trim();
    const subject = raw.slice(0,boundary).match(/^Subject: (.*)$/m)[1];
    const notice = prepareNotice({...mail,subject:`TEST HU03 — ${subject}`,text:body});
    const field = label => body.match(new RegExp(`^${label}[ \\t]*(?::|\\.{2,})[ \\t]*([^\\n]*)`,'m'))?.[1].trim();
    const advertising = file.startsWith('08');
    const mocked = advertising ? {ordenante:null,importe:null,concepto:null,tipo:'no_es_pago'} : {
      ordenante:field('Ordenante'), importe:Number(field('Importe').replace(' EUR','').replace(',','.')),
      concepto:field('Concepto'), tipo:file.includes('transferencia')?'transferencia':'bizum',
    };
    const result = validateExtraction(response(mocked),notice);
    assert.equal(result.result, advertising?'ignored':file.startsWith('05')?'review':'extracted',file);
    assert.equal(result.registration_allowed,false,file);
  }
});

test('complete workflow is credential-free, inactive and all external effects are explicitly gated', () => {
  let raw;
  vm.runInNewContext(fs.readFileSync('workflows/code/build-03-remote-deposits.js','utf8'), {
    require: id => id === 'node:fs' ? {...fs, writeFileSync: (_file, text) => {raw=text;}} : require(id),
  });
  const workflow = JSON.parse(raw);
  assert.equal(workflow.active,false);
  assert.deepEqual(workflow.pinData,{});
  assert.equal(workflow.settings.timezone,'Europe/Madrid');
  for (const node of workflow.nodes) {
    assert.ok(!node.credentials);
    if (node.type.endsWith('.code')) assert.doesNotThrow(()=>new Function('$input','$',node.parameters.jsCode));
    if(node.type.endsWith('.httpRequest') && node.parameters.url.startsWith('https://api.groq')) {
      assert.equal(node.disabled,true);
    }
  }
  const config = workflow.nodes.find(node=>node.name.startsWith('Configure Authorized'));
  assert.equal(config.parameters.assignments.assignments.find(a=>a.name==='allow_external_ai').value,false);
  assert.equal(config.parameters.assignments.assignments.find(a=>a.name==='allow_payment_registration').value,false);
  assert.equal(config.parameters.assignments.assignments.find(a=>a.name==='allow_shop_notices').value,false);
  const registration=workflow.nodes.find(n=>n.name.startsWith('Register This Bank Payment Once'));
  assert.equal(registration.parameters.method,'POST');
  assert.equal(registration.retryOnFail,false);
  assert.deepEqual(registration.parameters.headerParameters.parameters.map(p=>p.name),['Idempotency-Key','Payment-Notice-Fingerprint']);
  assert.ok(workflow.nodes.some(n=>n.name==='Require Installed Duplicate Protection Before Registering Money'));
  const filter = workflow.nodes.find(node=>node.name==='Allow Only Authorized HU03 Test Emails');
  const runFilter = data => filter.parameters.conditions.conditions.every(condition =>
    new Function('$json', `return (${condition.leftValue.slice(3, -2)});`)(data));
  const authorized = {...mail, authorized_test_sender:'sender@example.test'};
  assert.equal(runFilter(authorized),true);
  assert.equal(runFilter({...authorized,subject:'OTRA PRUEBA'}),false);
  assert.equal(runFilter({...authorized,subject:'TEST HU03OTRO'}),false);
  assert.equal(runFilter({...authorized,authorized_test_sender:'another@example.test'}),false);
  assert.equal(runFilter({...authorized,from:{value:[{address:'sender@example.test'},{address:'other@example.test'}]}}),false);
  assert.ok(!raw.includes('@gmail.com'));
  assert.ok(!workflow.id && !workflow.meta);
  const names = new Set(workflow.nodes.map(node=>node.name));
  for(const [name, connection] of Object.entries(workflow.connections)) {
    assert.ok(names.has(name));
    for(const output of connection.main) for(const edge of output) assert.ok(names.has(edge.node));
  }
  // Exercise actual embedded preparation/request/validation code, with paired inputs.
  const input = {all:()=>[{json:{...mail,receiving_account_scope:'test-inbox'}}]};
  const prep = workflow.nodes.find(n=>n.name.startsWith('Prepare and Validate'));
  const prepared = new Function('$input',prep.parameters.jsCode)(input);
  assert.equal(prepared[0].json.allow_external_ai,false);
  const build = workflow.nodes.find(n=>n.name.startsWith('Prepare Minimal'));
  const request = new Function('$input',build.parameters.jsCode)({all:()=>prepared});
  const validate = workflow.nodes.find(n=>n.name.startsWith('Check Extracted'));
  const result = new Function('$input','$',validate.parameters.jsCode)(
    {all:()=>[{json:response(payment)}]}, ()=>({itemMatching:index=>request[index]}));
  assert.equal(result[0].json.result,'extracted');
});
