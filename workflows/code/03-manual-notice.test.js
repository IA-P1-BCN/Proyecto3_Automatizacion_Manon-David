'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {createManualNotice,applyConfiguredManualSender}=require('./03-manual-notice');

test('manual case is stable, simulated and does not send mail',()=>{
 const fixtures=[{test_case:'01',subject:'Bizum recibido',body:'Importe: 10,00 EUR'}];
 const a=createManualNotice('01',fixtures),b=createManualNotice('01',fixtures);
 assert.deepEqual(a,b);assert.match(a.messageId,/fixture-v1-01/);
 assert.match(a.text,/No corresponde a un ingreso real/);
 assert.throws(()=>createManualNotice('all',fixtures),/01 y 09/);
 assert.throws(()=>createManualNotice('02',fixtures),/encontrado/);
});

test('manual sender is adapted to test configuration, real IMAP sender remains unchanged',()=>{
 const mail={from:{value:[{address:'original@example.test'}]},authorized_test_sender:'allowed@example.test'};
 assert.equal(applyConfiguredManualSender(mail),mail);
 assert.equal(applyConfiguredManualSender({...mail,manual_fixture:true}).from.value[0].address,'allowed@example.test');
});

test('generated manual input exercises all nine bundled fixtures without extra mail or crypto requirements',()=>{
 const w=JSON.parse(fs.readFileSync('workflows/03-remote-deposits.json','utf8'));
 const inject=w.nodes.find(n=>n.name==='Inject the Selected Example as a Resolved Bank Notice');
 const execute=new Function('$input',inject.parameters.jsCode);
 const ids=new Set();
 for(let i=1;i<=9;i++) {
  const id=String(i).padStart(2,'0');
  const output=execute({all:()=>[{json:{test_case:id}}]});
  assert.equal(output.length,1);assert.equal(output[0].json.manual_fixture,true);
  assert.ok(output[0].json.subject.startsWith('TEST HU03'));
  assert.ok(output[0].json.text.includes('SIMULADO'));
  ids.add(output[0].json.messageId);
 }
 assert.equal(ids.size,9);
 const selector=w.nodes.find(n=>n.name==='Choose Bank Notice Test Case 01 to 09');
 assert.match(selector.parameters.assignments.assignments[0].value,/^(?:0[1-9]|10)$/);
});
