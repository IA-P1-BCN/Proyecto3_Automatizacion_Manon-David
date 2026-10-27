'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {sanitizeTestedExport}=require('./sanitize-03-tested-export');

test('sanitizer keeps layout, node identity, connections and tested code, but strips local bindings',()=>{
 const source={id:'local-id',meta:{instanceId:'local-instance'},active:true,pinData:{private:[{}]},
 settings:{errorWorkflow:'local-error-workflow'},connections:{A:{main:[[]]}},nodes:[
  {id:'n1',name:'A',position:[120,240],parameters:{jsCode:'return [];'},credentials:{imap:{id:'local'}}},
  {id:'n2',name:'Configure Authorized Test Sender and Groq Access',position:[540,100],parameters:{assignments:{assignments:[
   {name:'allow_payment_registration',value:true},{name:'authorized_test_sender',value:'personal@example.test'},
  ]}}},
 ]};
 const copy=JSON.stringify(source),safe=sanitizeTestedExport(source);
 assert.equal(JSON.stringify(source),copy);
 assert.deepEqual(safe.nodes[0].position,[120,240]);
 assert.equal(safe.nodes[0].id,'n1');assert.equal(safe.nodes[0].parameters.jsCode,'return [];');
 assert.deepEqual(safe.connections,source.connections);
 assert.ok(!safe.id&&!safe.meta&&!safe.settings.errorWorkflow&&!safe.nodes[0].credentials);
 assert.equal(safe.active,false);assert.deepEqual(safe.pinData,{});
 assert.equal(safe.nodes[1].parameters.assignments.assignments[0].value,false);
});

test('canonical tested workflow is inactive, sanitized and supports all ten stable manual cases',()=>{
 const w=JSON.parse(fs.readFileSync('workflows/03-remote-deposits.json','utf8'));
 assert.equal(w.active,false);assert.deepEqual(w.pinData,{});
 assert.ok(w.nodes.every(n=>!n.credentials));
 const injector=w.nodes.find(n=>n.name==='Inject the Selected Example as a Resolved Bank Notice');
 const run=new Function('$input',injector.parameters.jsCode);
 for(let i=1;i<=10;i++) {
  const output=run({all:()=>[{json:{test_case:String(i).padStart(2,'0')}}]});
  assert.equal(output.length,1);
  assert.deepEqual(output,run({all:()=>[{json:{test_case:String(i).padStart(2,'0')}}]}));
 }
 const output=run({all:()=>[{json:{test_case:'10'}}]});
 assert.match(output[0].json.text,/Concepto: apartado 25/);
 for(const n of w.nodes) if(n.type.endsWith('.code')) assert.doesNotThrow(()=>new Function('$input','$','$now',n.parameters.jsCode));
 for(const a of w.nodes.find(n=>n.name==='Configure Authorized Test Sender and Groq Access').parameters.assignments.assignments) {
  if(a.name.startsWith('allow_')) assert.equal(a.value,false);
 }
});
