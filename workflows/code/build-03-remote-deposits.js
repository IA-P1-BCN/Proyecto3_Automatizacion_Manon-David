// Run from repository root. Never reads or overwrites the user's original export.
'use strict';
const fs = require('node:fs');
const core = fs.readFileSync('workflows/code/03-extract-bank-payment.js', 'utf8') + '\n'
  + fs.readFileSync('workflows/code/03-match-bank-payment.js', 'utf8') + '\n'
  + fs.readFileSync('workflows/code/03-manual-notice.js', 'utf8');
const nodes = [], connections = {};
function node(name, type, version, parameters, x, y = 0, extra = {}) {
  nodes.push({ name, type: `n8n-nodes-base.${type}`, typeVersion: version,
    id: `remote-deposits-${nodes.length + 1}`, parameters, position: [x, y], ...extra });
}
function code(name, body, x, y = 0) {
  node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: `${core}\n${body}` }, x, y);
}
function link(from, to, output = 0) {
  connections[from] ||= { main: [] };
  connections[from].main[output] ||= [];
  connections[from].main[output].push({ node: to, type: 'main', index: 0 });
}
function booleanCondition(id, expression) {
  return { id, leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } };
}
function ifNode(name, conditions, x, y = 0) {
  node(name, 'if', 2.3, { conditions: { options: { caseSensitive: true, typeValidation: 'strict', version: 3 },
    conditions, combinator: 'and' }, options: {} }, x, y);
}
const receive = 'Receive Bank Payment Notices from Shop Mailbox';
const configure = 'Configure Authorized Test Sender and Groq Access';
const filter = 'Allow Only Authorized HU03 Test Emails';
const prepare = 'Prepare and Validate Bank Notice Details for Payment Review';
const request = 'Prepare Minimal Bank Notice Extraction Request for Groq';
const gate = 'Check Whether External AI Extraction Is Explicitly Enabled';
const extract = 'Extract Payer Amount and Concept from Bank Notice with Groq';
const validate = 'Check Extracted Payment Details Against the Original Bank Notice';
const manualSender = 'Apply Configured Test Sender Only to Manually Injected Notices';

node(receive, 'emailReadImap', 2.2, { format: 'resolved', mailbox: 'INBOX',
  postProcessAction: 'read', options: {customEmailConfig:'["UNSEEN"]'} }, 0, 0,
{ id: 'a4a0f47a-7d88-4450-ad92-18a9ce260723' });
node(configure, 'set', 3.4, {
  mode: 'manual', includeOtherFields: true,
  assignments: { assignments: [
    { id: 'authorized-sender', name: 'authorized_test_sender', type: 'string', value: 'test-sender@example.invalid' },
    { id: 'allow-external-ai', name: 'allow_external_ai', type: 'boolean', value: false },
    { id: 'allow-registration', name: 'allow_payment_registration', type: 'boolean', value: false },
    { id: 'allow-notices', name: 'allow_shop_notices', type: 'boolean', value: false },
    { id: 'account-scope', name: 'receiving_account_scope', type: 'string', value: 'paso-firme-test-mailbox' },
    { id: 'notice-to', name: 'shop_notice_to', type: 'string', value: 'shop-notices@example.invalid' },
    { id: 'notice-from', name: 'shop_notice_from', type: 'string', value: 'shop-sender@example.invalid' },
  ] }, options: {},
}, 220);
code(manualSender,'return $input.all().map((item,index)=>({json:applyConfiguredManualSender(item.json),pairedItem:{item:index}}));',330,-140);
ifNode(filter, [
  booleanCondition('sender', '={{ ($json.from?.value?.length === 1) && ($json.from.value[0].address ?? "").trim().toLowerCase() === $json.authorized_test_sender.trim().toLowerCase() }}'),
  booleanCondition('subject', '={{ /^TEST HU03(?:\\s|$)/.test(($json.subject ?? "").trim()) }}'),
], 440);
nodes.at(-1).id = 'b4ae7118-d9d9-4b90-b211-ddc9145a31c3';
code(prepare, `return $input.all().map((item,index) => {
 const j=item.json;
 if (!j.receiving_account_scope?.trim()) throw new Error('Configura el identificador estable del buzón.');
 return {json:{...prepareNotice(j), allow_external_ai:j.allow_external_ai===true,
 allow_payment_registration:j.allow_payment_registration===true, allow_shop_notices:j.allow_shop_notices===true,
 receiving_account_scope:j.receiving_account_scope, shop_notice_to:j.shop_notice_to, shop_notice_from:j.shop_notice_from},pairedItem:{item:index}};
});`, 660);
node('Create Stable Payment Key from Mailbox and Message Identifier', 'crypto', 1, {
 action:'hash',type:'SHA256',binaryData:false,encoding:'hex',dataPropertyName:'payment_key',
 value:'={{ JSON.stringify(["hu03-v1",$json.receiving_account_scope,$json.messageId]) }}',
}, 760,-160);
node('Fingerprint Notice Content to Flag Duplicate Bank Emails', 'crypto', 1, {
 action:'hash',type:'SHA256',binaryData:false,encoding:'hex',dataPropertyName:'notice_fingerprint',
 value:'={{ JSON.stringify(["hu03-content-v1",$json.receiving_account_scope,$json.subject,$json.body]) }}',
}, 880,-160);
code(request, 'return $input.all().map((item, index) => ({json: {...item.json, groq_request: buildExtractionRequest(item.json)}, pairedItem: {item:index}}));', 880);
ifNode(gate, [booleanCondition('allow', '={{ $json.allow_external_ai === true }}')], 1100);
node(extract, 'httpRequest', 4.2, {
  method: 'POST', url: 'https://api.groq.com/openai/v1/chat/completions',
  authentication: 'predefinedCredentialType', nodeCredentialType: 'groqApi',
  sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.groq_request) }}',
  options: { timeout: 45000, response: { response: { fullResponse: true, responseFormat: 'json' } } },
}, 1320, 0, { disabled: true, retryOnFail: false,
  notesInFlow: true, notes: 'Disabled until credentials and external-AI permission are configured. Payment registration has a separate false-by-default gate.' });
code(validate, `return $input.all().map((item, index) => {
  const notice = $('${request}').itemMatching(index).json;
  const {groq_request,...context}=notice;
  return {json: {...context, ...validateExtraction(item.json, notice)}, pairedItem: {item:index}};
});`, 1540);
ifNode('Check Whether the Notice Contains a Validated Payment Extraction', [
  booleanCondition('extracted', '={{ $json.result === "extracted" }}'),
], 1760);
ifNode('Check Whether the Notice Is a Non Payment Email', [booleanCondition('ignored', '={{ $json.result === "ignored" }}')], 1980, 160);
node('Ignore Non Payment Notice Without Registering Anything', 'noOp', 1, {}, 2200, 80);
node('Stop Before External AI Until the User Enables the Test', 'noOp', 1, {}, 1320, 280);
node('Ignore Email Outside the Authorized HU03 Test Scope', 'noOp', 1, {}, 660, 300);
for (const [a, b] of [[receive, configure], [configure, manualSender], [manualSender, filter], [filter, prepare],
  [prepare,'Create Stable Payment Key from Mailbox and Message Identifier'],
  ['Create Stable Payment Key from Mailbox and Message Identifier','Fingerprint Notice Content to Flag Duplicate Bank Emails'],
  ['Fingerprint Notice Content to Flag Duplicate Bank Emails',request],
  [request, gate], [gate, extract], [extract, validate], [validate, 'Check Whether the Notice Contains a Validated Payment Extraction'],
  ['Check Whether the Notice Is a Non Payment Email', 'Ignore Non Payment Notice Without Registering Anything']]) link(a, b);
link(filter, 'Ignore Email Outside the Authorized HU03 Test Scope', 1);
link(gate, 'Stop Before External AI Until the User Enables the Test', 1);
link('Check Whether the Notice Contains a Validated Payment Extraction', 'Check Whether the Notice Is a Non Payment Email', 1);
const caseNode='Keep Bank Notice Context for Reservation Identification';
node(caseNode,'noOp',1,{},2200,-120);
link('Check Whether the Notice Contains a Validated Payment Extraction',caseNode);
link('Check Whether the Notice Is a Non Payment Email',caseNode,1);
function shopHttp(name,url,x,extra={},settings={}) {
 node(name,'httpRequest',4.2,{method:'GET',url,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',
 options:{timeout:30000,response:{response:{fullResponse:true,responseFormat:'json'}}},...extra},x,-120,settings);
}
const fetch='Fetch All Shop Reservations Without Pagination Truncation';
shopHttp(fetch,'http://tienda:8000/api/apartados',2420);
link(caseNode,fetch);
const match='Identify the Reservation and Check Its Current Balance and Deadline';
code(match,`return $input.all().map((item,index)=>{
 const context=$('${caseNode}').itemMatching(index).json;
 if(item.json.statusCode!==200 || !Array.isArray(item.json.body)) throw new Error('No se pudo consultar los apartados.');
 const count=item.json.headers?.['x-total-count'];
 if(count!==undefined && Number(count)!==item.json.body.length) throw new Error('Lista de apartados incompleta.');
 const result=context.result==='extracted' || context.reason==='missing_payment_concept'
 ? matchReservation(context.payment,item.json.body,$now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd'))
 : {decision:'review',reason:'La extracción necesita revisión: '+context.reason,candidates:[],registration_allowed:false};
 return {json:{...context,...result},pairedItem:{item:index}};
});`,2640,-120);
link(fetch,match);
const eligible='Check Whether This Payment Has One Clear Eligible Reservation';
ifNode(eligible,[booleanCondition('register','={{ $json.decision === "register" }}')],2860,-120);
link(match,eligible);
const recheck='Fetch the Selected Reservation Again Before Any Financial Write';
shopHttp(recheck,'=http://tienda:8000/api/apartados/{{ $json.reservation.id }}',3080);
link(eligible,recheck);
const fresh='Revalidate the Selected Reservation Without Reassigning the Payment';
code(fresh,`return $input.all().map((item,index)=>{
 const c=$('${match}').itemMatching(index).json;
 if(item.json.statusCode!==200) throw new Error('No se pudo volver a consultar el apartado.');
 if(item.json.body.id!==c.reservation.id) throw new Error('La API devolvió otro apartado.');
 const reason=checkEligibility(item.json.body,c.payment,$now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd'));
 return {json:{...c,reservation:item.json.body,candidates:[item.json.body],
 decision:reason?'review':'register',reason:reason||c.reason,registration_allowed:!reason},pairedItem:{item:index}};
});`,3300,-120);
link(recheck,fresh);
const freshIf='Confirm the Reservation Still Accepts This Payment';
ifNode(freshIf,[booleanCondition('fresh','={{ $json.decision === "register" }}')],3520,-120);
link(fresh,freshIf);
const writeGate='Check Whether Payment Registration Is Explicitly Enabled';
ifNode(writeGate,[booleanCondition('write','={{ $json.allow_payment_registration === true }}')],3740,-120);
link(freshIf,writeGate);
node('Show the Proposed Payment Without Writing to the Shop','noOp',1,{},3960,120);
link(writeGate,'Show the Proposed Payment Without Writing to the Shop',1);
const contract='Check the Installed Shop API Supports Safe Payment Retries';
shopHttp(contract,'http://tienda:8000/openapi.json',3960);
link(writeGate,contract);
const ready='Require Installed Duplicate Protection Before Registering Money';
code(ready,`return $input.all().map((item,index)=>{
 assertPaymentSafetyCapability(item.json);
 const c=$('${fresh}').itemMatching(index).json;
 if(!/^[a-f0-9]{64}$/.test(c.payment_key||'') || !/^[a-f0-9]{64}$/.test(c.notice_fingerprint||'')) throw new Error('Falta la identidad del pago.');
 return {json:c,pairedItem:{item:index}};
});`,4180,-120);
link(contract,ready);
const register='Register This Bank Payment Once Against the Selected Reservation';
shopHttp(register,'=http://tienda:8000/api/apartados/{{ $json.reservation.id }}/abonos',4400,{
 method:'POST',sendHeaders:true,headerParameters:{parameters:[
 {name:'Idempotency-Key',value:'={{ $json.payment_key }}'},
 {name:'Payment-Notice-Fingerprint',value:'={{ $json.notice_fingerprint }}'}]},
 sendBody:true,specifyBody:'json',jsonBody:'={{ JSON.stringify({importe:$json.payment.importe,forma_pago:"bizum"}) }}',
 options:{timeout:30000,response:{response:{fullResponse:true,responseFormat:'json',neverError:true}}},
},{retryOnFail:false,onError:'continueRegularOutput'});
link(ready,register);
const outcome='Distinguish Confirmed Registration from Rejection or Uncertain Response';
code(outcome,`return $input.all().map((item,index)=>({json:interpretRegistration(item.json,$('${ready}').itemMatching(index).json),pairedItem:{item:index}}));`,4620,-120);
link(register,outcome);
const success='Check Whether the Shop Confirmed the Payment Registration';
ifNode(success,[booleanCondition('registered','={{ $json.decision === "registered" }}')],4840,-120);
link(outcome,success);
node('Payment Registered Customer Receipt Is Handled Only by HU02','noOp',1,{},5060,-120);
link(success,'Payment Registered Customer Receipt Is Handled Only by HU02');
const review='Prepare a Spanish Review Notice with Candidate Contact Details';
code(review,`return $input.all().map((item,index)=>({json:{...item.json,notice:reviewEmail(item.json)},pairedItem:{item:index}}));`,3300,400);
link(eligible,review,1);link(freshIf,review,1);link(success,review,1);
const noticeGate='Check Whether Shop Review Emails Are Explicitly Enabled';
ifNode(noticeGate,[booleanCondition('notice','={{ $json.allow_shop_notices === true }}')],3520,400);
link(review,noticeGate);
code('Verify Controlled Shop Email Addresses Before Sending',`return $input.all().map((item,index)=>{
 const j=item.json;
 for(const address of [j.shop_notice_to,j.shop_notice_from]) {
 if(typeof address!=='string' || !/^[^\\s@,;<>]+@[^\\s@,;<>]+\\.[^\\s@,;<>]+$/.test(address) || address.endsWith('.invalid')) throw new Error('Configura los correos de prueba de la tienda.');
 }
 return {json:j,pairedItem:{item:index}};
});`,3740,400);
link(noticeGate,'Verify Controlled Shop Email Addresses Before Sending');
node('Email Marisa the Review Reason and Available Candidate Contacts','emailSend',2.1,{
 fromEmail:'={{ $json.shop_notice_from }}',toEmail:'={{ $json.shop_notice_to }}',
 subject:'={{ $json.notice.subject }}',emailFormat:'text',text:'={{ $json.notice.body }}',options:{},
},3960,400);
link('Verify Controlled Shop Email Addresses Before Sending','Email Marisa the Review Reason and Available Candidate Contacts');
const postNotice='Keep the Review Outcome and Escalate Any Uncertain Financial Write';
code(postNotice,`return $input.all().map((item,index)=>{
 const c=$('${review}').itemMatching(index).json;
 if(c.decision==='uncertain') throw new Error('Registro de abono sin confirmación: revisar antes de repetir.');
 return {json:c,pairedItem:{item:index}};
});`,4180,400);
link('Email Marisa the Review Reason and Available Candidate Contacts',postNotice);
link(noticeGate,postNotice,1);

const manual='Start One Synthetic Bank Notice Test Without Sending Email';
const choose='Choose Bank Notice Test Case 01 to 09';
const inject='Inject the Selected Example as a Resolved Bank Notice';
node(manual,'manualTrigger',1,{},-440,-320);
node(choose,'set',3.4,{mode:'manual',assignments:{assignments:[
 {id:'test-case',name:'test_case',type:'string',value:'01'},
]},options:{}},-220,-320);
code(inject,'',0,-320);
nodes.at(-1).parameters.jsCode=fs.readFileSync('workflows/code/03-inject-test-notices.js','utf8');
link(manual,choose);link(choose,inject);link(inject,configure);

// Keep the user's reviewed canvas when intentionally rebuilding supporting code.
// Sanitizing the tested export is preferred for publication after editor tests.
const referencePath='workflows/03-remote-deposits.json';
if (fs.existsSync(referencePath)) {
 const reference=JSON.parse(fs.readFileSync(referencePath,'utf8'));
 const positions=new Map(reference.nodes.map(n=>[n.name,n.position]));
 for(const n of nodes) if(positions.has(n.name)) n.position=positions.get(n.name);
}

fs.writeFileSync('workflows/03-remote-deposits.json', JSON.stringify({
  name: '03 Remote Deposits', nodes, connections, active: false, pinData: {},
  settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' },
}, null, 2) + '\n');
