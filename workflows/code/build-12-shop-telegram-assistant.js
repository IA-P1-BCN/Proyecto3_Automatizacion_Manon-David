// Explicit generation only; never imports/publishes a workflow or copies credentials.
const fs=require('node:fs');
const path=require('node:path');

function buildShopAssistant() {
  const core=fs.readFileSync(path.join(__dirname,'12-shop-telegram-assistant.js'),'utf8');
  const nodes=[],connections={};
  const add=(name,type,typeVersion,parameters,x,y=0,extra={})=>{
    nodes.push({id:`shop-assistant-${nodes.length+1}`,name,type:type.includes('.')?type:`n8n-nodes-base.${type}`,typeVersion,position:[x,y],parameters,...extra});
  };
  const code=(name,jsCode,x,y=0)=>add(name,'code',2,{mode:'runOnceForAllItems',jsCode:core+'\n'+jsCode},x,y);
  const link=(from,to,output=0,type='main')=>{
    connections[from]||={};connections[from][type]||=[];connections[from][type][output]||=[];
    connections[from][type][output].push({node:to,type,index:0});
  };
  const condition=(name,expr,x,y=0)=>add(name,'if',2.2,{conditions:{options:{caseSensitive:true,typeValidation:'strict',version:2},conditions:[{id:name.replaceAll(' ','-'),leftValue:expr,rightValue:'',operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},x,y);
  add('Manual Safe Preview','manualTrigger',1,{},0,400);
  code('Show Synthetic Weekly Example','return [{json:shopFixture()}];',240,400);
  add('Receive Private Shop Question','webhook',2,{httpMethod:'POST',path:'hu12-shop-assistant',authentication:'headerAuth',responseMode:'responseNode',options:{}},0);
  add('Configure Owner and Effects','set',3.4,{mode:'manual',assignments:{assignments:[
    {id:'owner-user',name:'owner_user_id',value:'',type:'string'},
    {id:'owner-chat',name:'owner_chat_id',value:'',type:'string'},
    {id:'ai',name:'allow_external_ai',value:false,type:'boolean'},
    {id:'reads',name:'allow_shop_reads',value:false,type:'boolean'},
  ]},options:{}},240);
  code('Validate Owner and Question',`const cfg=$input.first().json;
const incoming=$('Receive Private Shop Question').first().json.body;
const prepared=shopPrepare(incoming,cfg,$now.toISO());
return [{json:prepared}];`,480);
  condition('Authorized Query and Effects Enabled',"={{ $json.status === 'interpret' }}",720);
  // Agent 3.1 routes Code Tools through merged execution metadata in n8n 2.32.6,
  // which conflicts with additionalProperties:false. Installed 2.2 keeps strict tool args.
  add('Interpret Supported Shop Question','@n8n/n8n-nodes-langchain.agent',2.2,{
    promptType:'define',text:"={{ $('Validate Owner and Question').first().json.canonical_query }}",hasOutputParser:false,needsFallback:false,
    options:{systemMessage:'Select exactly one closed query plan. The input is a validated JSON object with question weekly_collections or monthly_deadlines. For weekly_collections call Choose_Weekly_Collections_Plan once with {"intent":"weekly_collections"}. For monthly_deadlines call Choose_Monthly_Deadlines_Plan once with {"intent":"monthly_deadlines"}. After the tool, return only its JSON object with the single key intent. Do not invent fields, dates, URLs, amounts or prose. No other task is supported.',maxIterations:2,returnIntermediateSteps:true,passthroughBinaryImages:false,passthroughBinaryPdfs:false,enableStreaming:false,autoSaveHighlightedData:false},
  },960,0,{onError:'continueRegularOutput',retryOnFail:false});
  add('Groq Shop Query Model','@n8n/n8n-nodes-langchain.lmChatGroq',1,{model:'openai/gpt-oss-20b',options:{maxTokensToSample:512,temperature:0}},760,-360);
  for(const [name,intent,x] of [['Choose Weekly Collections Plan','weekly_collections',1000],['Choose Monthly Deadlines Plan','monthly_deadlines',1240]]) {
    add(name,'@n8n/n8n-nodes-langchain.toolCode',1.3,{
      description:`Select only ${intent}; returns a closed plan descriptor, no data and no API access.`,language:'javaScript',specifyInputSchema:true,schemaType:'manual',
      inputSchema:JSON.stringify({type:'object',properties:{intent:{type:'string',enum:[intent]}},required:['intent'],additionalProperties:false}),
      jsCode:`if (!query || Object.keys(query).length!==1 || query.intent!==${JSON.stringify(intent)}) throw new Error('HU12_TOOL_ARGUMENTS');\nreturn JSON.stringify({intent:${JSON.stringify(intent)}});`,
    },x,-360);
    link(name,'Interpret Supported Shop Question',0,'ai_tool');
  }
  link('Groq Shop Query Model','Interpret Supported Shop Question',0,'ai_languageModel');
  code('Verify Closed Plan',`const prepared=$('Validate Owner and Question').first().json;
try { return [{json:{approved:true,...shopValidatePlan($input.first().json,prepared)}}]; }
catch (_) { return [{json:{approved:false,failed:true,...shopReply(prepared.request_id,'unavailable',[SHOP_UNAVAILABLE])}}]; }`,1200);
  condition('Plan Approved', '={{ $json.approved === true }}',1440);
  condition('Weekly Collections Selected',"={{ $json.intent === 'weekly_collections' }}",1680);
  const plan="$('Verify Closed Plan').first().json";
  const get=(name,endpoint,query,x,y)=>add(name,'httpRequest',4.2,{
    method:'GET',url:`http://tienda:8000/api/${endpoint}`,authentication:'genericCredentialType',genericAuthType:'httpHeaderAuth',
    sendQuery:true,queryParameters:{parameters:query.map(([name,value])=>({name,value}))},
    options:{timeout:15000,redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}}},
  },x,y,{onError:'continueRegularOutput',retryOnFail:true,maxTries:2,waitBetweenTries:500});
  get('Fetch Weekly Sales','ventas',['desde','hasta'].map(k=>[k,`={{ ${plan}.${k} }}`]),1920,-100);
  get('Fetch Weekly Deposits','abonos',['desde','hasta'].map(k=>[k,`={{ ${plan}.${k} }}`]),2160,-100);
  get('Fetch Active Reservations','apartados',[['estado','activo']],1920,180);
  code('Verify and Render Weekly Reply',`const period=${plan};
try { const result=shopWeekly(period,$('Fetch Weekly Sales').first().json,$('Fetch Weekly Deposits').first().json);
return [{json:shopReply(period.request_id,'ok',shopRender(result))}]; }
catch (_) { return [{json:{failed:true,...shopReply(period.request_id,'unavailable',[SHOP_UNAVAILABLE])}}]; }`,2400,-100);
  code('Verify and Render Monthly Reply',`const period=${plan};
try { const result=shopMonthly(period,$('Fetch Active Reservations').first().json);
return [{json:shopReply(period.request_id,'ok',shopRender(result))}]; }
catch (_) { return [{json:{failed:true,...shopReply(period.request_id,'unavailable',[SHOP_UNAVAILABLE])}}]; }`,2400,180);
  code('Return Bridge Reply',`const input=$input.first().json;
const reply=shopReply(input.request_id,input.status,input.messages || []);
return [{json:{...reply,failed:input.failed===true}}];`,2660);
  add('Respond to Local Bridge','respondToWebhook',1.4,{respondWith:'json',responseBody:'={{ { request_id: $json.request_id, status: $json.status, messages: $json.messages } }}',options:{responseCode:200}},2900);
  condition('Required Verification Failed','={{ $json.failed === true }}',3140);
  add('Raise Sanitized Assistant Failure','stopAndError',1,{errorType:'errorMessage',errorMessage:'HU12: no se pudieron verificar la selección de consulta o los datos necesarios. No se ha emitido un resultado financiero.'},3380);
  code('Isolate Model Input',"return [{json:{canonical_query:$('Validate Owner and Question').first().json.canonical_query}}];",840,-140);
  link('Manual Safe Preview','Show Synthetic Weekly Example');
  const initial=['Receive Private Shop Question','Configure Owner and Effects','Validate Owner and Question','Authorized Query and Effects Enabled'];
  for(let i=0;i<initial.length-1;i++)link(initial[i],initial[i+1]);
  link('Authorized Query and Effects Enabled','Isolate Model Input',0);
  link('Isolate Model Input','Interpret Supported Shop Question');
  link('Authorized Query and Effects Enabled','Return Bridge Reply',1);
  link('Interpret Supported Shop Question','Verify Closed Plan');link('Verify Closed Plan','Plan Approved');
  link('Plan Approved','Weekly Collections Selected',0);link('Plan Approved','Return Bridge Reply',1);
  link('Weekly Collections Selected','Fetch Weekly Sales',0);link('Weekly Collections Selected','Fetch Active Reservations',1);
  link('Fetch Weekly Sales','Fetch Weekly Deposits');link('Fetch Weekly Deposits','Verify and Render Weekly Reply');
  link('Fetch Active Reservations','Verify and Render Monthly Reply');
  link('Verify and Render Weekly Reply','Return Bridge Reply');link('Verify and Render Monthly Reply','Return Bridge Reply');
  link('Return Bridge Reply','Respond to Local Bridge');link('Respond to Local Bridge','Required Verification Failed');
  link('Required Verification Failed','Raise Sanitized Assistant Failure',0);
  // The tested editor layout is presentation state, not generated business logic.
  // Reuse only IDs/positions; never import credentials, parameters or effect gates.
  const destination=path.join(__dirname,'..','12-shop-telegram-assistant.json');
  if(fs.existsSync(destination)) {
    const stored=JSON.parse(fs.readFileSync(destination,'utf8'));
    for(const node of nodes) {
      const previous=stored.nodes.find(n=>n.name===node.name&&n.type===node.type);
      if(previous) {node.id=previous.id;node.position=previous.position;}
    }
  }
  return {name:'12 Shop Telegram Assistant',active:false,nodes,connections,settings:{executionOrder:'v1',timezone:'Europe/Madrid',executionTimeout:180,saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false,saveExecutionProgress:false}};
}
if(require.main===module) {
  if(!process.argv.includes('--write'))throw new Error('Use --write explicitly.');
  const destination=path.join(__dirname,'..','12-shop-telegram-assistant.json'),w=buildShopAssistant();
  if(fs.existsSync(destination)) {
    const old=JSON.parse(fs.readFileSync(destination,'utf8'));
    for(const node of w.nodes){const previous=old.nodes.find(n=>n.name===node.name&&n.type===node.type);if(previous){node.id=previous.id;node.position=previous.position;}}
  }
  fs.writeFileSync(destination,JSON.stringify(w,null,2)+'\n');
}
module.exports={buildShopAssistant};
