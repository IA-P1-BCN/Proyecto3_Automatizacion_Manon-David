const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {buildShopAssistant}=require('./build-12-shop-telegram-assistant');
const w=buildShopAssistant(),byName=new Map(w.nodes.map(n=>[n.name,n]));
function reach(name){const found=new Set(),pending=[name];while(pending.length){const n=pending.pop();if(found.has(n))continue;found.add(n);for(const outputs of Object.values(w.connections[n]||{}))for(const edges of outputs)for(const e of edges||[])pending.push(e.node);}return found;}
test('canonical JSON matches generator',()=>assert.deepEqual(JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'..','12-shop-telegram-assistant.json'))),w));
test('inactive, identity/effect/credential-free and minimal retention',()=>{assert.equal(w.active,false);const fields=byName.get('Configure Owner and Effects').parameters.assignments.assignments;assert.deepEqual(fields.map(x=>x.value),['','',false,false]);assert.ok(w.nodes.every(n=>!n.credentials));assert.equal(w.settings.saveDataErrorExecution,'none');assert.equal(w.settings.saveDataSuccessExecution,'none');assert.equal(w.settings.saveManualExecutions,false);});
test('all nodes/connections are uniquely resolved',()=>{assert.equal(byName.size,w.nodes.length);assert.equal(new Set(w.nodes.map(n=>n.id)).size,w.nodes.length);for(const [from,types] of Object.entries(w.connections)){assert.ok(byName.has(from));for(const outputs of Object.values(types))for(const edges of outputs)for(const e of edges||[])assert.ok(byName.has(e.node));}});
test('manual preview has no path to an external call',()=>assert.deepEqual([...reach('Manual Safe Preview')],['Manual Safe Preview','Show Synthetic Weekly Example']));
test('webhook requires independent bridge credential and bounded entry',()=>{const n=byName.get('Receive Private Shop Question');assert.equal(n.parameters.authentication,'headerAuth');assert.equal(n.parameters.responseMode,'responseNode');assert.equal(n.parameters.path,'hu12-shop-assistant');});
test('only three app reads, fixed URLs and auth, no redirect',()=>{const http=w.nodes.filter(n=>n.type==='n8n-nodes-base.httpRequest');assert.equal(http.length,3);for(const n of http){assert.equal(n.parameters.method,'GET');assert.match(n.parameters.url,/^http:\/\/tienda:8000\/api\/(ventas|abonos|apartados)$/);assert.equal(n.parameters.genericAuthType,'httpHeaderAuth');assert.equal(n.parameters.options.redirect.redirect.followRedirects,false);assert.equal(n.maxTries,2);assert.equal(n.onError,'continueRegularOutput');}});
test('agent cannot call API, memory, workflow, arbitrary code or reply tools',()=>{const tools=w.nodes.filter(n=>n.type.endsWith('.toolCode'));assert.equal(tools.length,2);for(const n of tools){assert.equal(n.parameters.specifyInputSchema,true);assert.equal(JSON.parse(n.parameters.inputSchema).additionalProperties,false);assert.ok(!/fetch|https?:|require\(|eval\(|getCredentials|\$\(/.test(n.parameters.jsCode));}assert.ok(!w.nodes.some(n=>/memory|httpRequestTool|workflowTool/i.test(n.type)));const a=byName.get('Interpret Supported Shop Question');assert.equal(a.typeVersion,2.2);assert.equal(a.parameters.options.maxIterations,2);assert.equal(a.parameters.options.returnIntermediateSteps,true);assert.match(a.parameters.text,/canonical_query/);assert.ok(!a.parameters.text.includes('body'));for(const name of reach('Interpret Supported Shop Question')){assert.ok(!w.connections[name]?.ai_tool);assert.ok(!w.connections[name]?.ai_languageModel);}});
test('all embedded code parses and errors are sanitized',()=>{for(const n of w.nodes.filter(n=>n.type==='n8n-nodes-base.code'))assert.doesNotThrow(()=>new Function(n.parameters.jsCode),n.name);assert.match(byName.get('Verify Closed Plan').parameters.jsCode,/catch \(_\)/);assert.ok(!byName.get('Raise Sanitized Assistant Failure').parameters.errorMessage.includes('$json'));});
test('no Telegram sender or token is embedded',()=>{assert.ok(!JSON.stringify(w).includes('api.telegram.org'));assert.ok(!w.nodes.some(n=>n.type==='n8n-nodes-base.telegram'));assert.ok(!JSON.stringify(w).includes('HU12_TELEGRAM_BOT_TOKEN'));});
function runCode(name,input,context={}) {
  const get=name=>({first:()=>({json:context[name]})});
  return new Function('$input','$','$now',byName.get(name).parameters.jsCode)({first:()=>({json:input})},get,{toISO:()=> '2026-10-28T12:00:00Z'})[0].json;
}
test('actual model-error code returns safe failure without an approved plan',()=>{
  const out=runCode('Verify Closed Plan',{error:'upstream secret value'},{'Validate Owner and Question':{authorized:true,status:'interpret',request_id:'fixture_12345678',today:'2026-10-28',expected_intent:'weekly_collections'}});
  assert.equal(out.approved,false);assert.equal(out.failed,true);assert.equal(out.status,'unavailable');assert.ok(!JSON.stringify(out).includes('secret'));
});
for(const name of ['Verify and Render Weekly Reply','Verify and Render Monthly Reply']) test('actual rubric code sanitizes required API failures: '+name,()=>{
  const p={intent:name.includes('Weekly')?'weekly_collections':'monthly_deadlines',today:'2026-10-28',desde:name.includes('Weekly')?'2026-10-26':'2026-10-01',hasta:name.includes('Weekly')?'2026-10-28':'2026-10-31',request_id:'fixture_12345678'};
  const failed={statusCode:401,body:{secret:'must not leak'}};
  const out=runCode(name,failed,{'Verify Closed Plan':p,'Fetch Weekly Sales':failed,'Fetch Weekly Deposits':failed,'Fetch Active Reservations':failed});
  assert.equal(out.failed,true);assert.equal(out.status,'unavailable');assert.ok(!JSON.stringify(out).includes('must not leak'));assert.match(out.messages[0],/No puedo verificar/);
});
test('actual closed tools reject unexpected args and return only their enum',()=>{
  for(const name of ['Choose Weekly Collections Plan','Choose Monthly Deadlines Plan']){
    const n=byName.get(name),intent=name.includes('Weekly')?'weekly_collections':'monthly_deadlines';
    const execute=new Function('query',n.parameters.jsCode);
    assert.deepEqual(JSON.parse(execute({intent})),{intent});
    assert.throws(()=>execute({intent,url:'http://evil.test'}));assert.throws(()=>execute('process.exit()'));
  }
});
