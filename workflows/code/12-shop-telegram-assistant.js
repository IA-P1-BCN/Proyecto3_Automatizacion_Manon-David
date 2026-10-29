// HU-12 pure boundary/rubric. No network, credentials, persistence or business writes.
const SHOP_INTENTS = ['weekly_collections', 'monthly_deadlines'];
const SHOP_HELP = 'Puedo responder a estas dos preguntas:\n1. ¿Cuánto se ha recaudado esta semana?\n2. ¿Qué apartados vencen este mes?';
const SHOP_UNAVAILABLE = 'No puedo verificar los datos ahora. Inténtalo de nuevo más tarde.';
const SHOP_LIMIT = 'La lista completa supera el límite seguro del chat. Consulta los apartados en la aplicación.';

function shopRequire(ok, code) { if (!ok) throw new Error(`HU12_${code}`); }
function shopObject(value, keys) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
}
function shopId(value) { return Number.isSafeInteger(value) && value > 0; }
function shopConfiguredId(value) {
  return typeof value === 'string' && /^[1-9]\d{0,15}$/.test(value) && shopId(Number(value)) ? Number(value) : null;
}
function shopDate(value) {
  shopRequire(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'DATE');
  const d = new Date(`${value}T00:00:00Z`);
  shopRequire(Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value && value >= '1900-01-01', 'DATE');
  return value;
}
function shopMadridDate(now) {
  const instant = new Date(now);
  shopRequire(Number.isFinite(instant.getTime()), 'CLOCK');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {timeZone:'Europe/Madrid', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(instant).map(x => [x.type,x.value]));
  return shopDate(`${p.year}-${p.month}-${p.day}`);
}
function shopPeriod(intent, today) {
  shopRequire(SHOP_INTENTS.includes(intent), 'INTENT'); shopDate(today);
  const d = new Date(`${today}T00:00:00Z`);
  if (intent === 'weekly_collections') {
    d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    return {intent, today, desde:d.toISOString().slice(0,10), hasta:today};
  }
  const [year,month] = today.split('-').map(Number);
  return {intent, today, desde:`${today.slice(0,7)}-01`, hasta:`${today.slice(0,7)}-${new Date(Date.UTC(year,month,0)).getUTCDate()}`};
}
function shopAuthorize(body, config, now) {
  const fail = {authorized:false, status:'ignored', request_id:'rejected'};
  const user = shopConfiguredId(config?.owner_user_id), chat = shopConfiguredId(config?.owner_chat_id);
  if (!user || !chat || !shopObject(body, ['request_id','update']) || !/^[a-z0-9_-]{8,64}$/.test(body.request_id)) return fail;
  const u = body.update;
  if (!shopObject(u,['update_id','message']) || !Number.isSafeInteger(u.update_id) || u.update_id < 0) return fail;
  const m = u.message;
  if (!shopObject(m,['message_id','date','from','chat','text']) || !shopId(m.message_id)
      || !shopObject(m.from,['id','is_bot']) || m.from.id !== user || m.from.is_bot !== false
      || !shopObject(m.chat,['id','type']) || m.chat.id !== chat || m.chat.type !== 'private'
      || !Number.isSafeInteger(m.date) || typeof m.text !== 'string' || m.text.length > 320 || !m.text.trim()) return fail;
  const age = new Date(now).getTime()/1000 - m.date;
  if (!Number.isFinite(age) || age < -30 || age > 300) return fail;
  return {authorized:true, request_id:body.request_id, text:m.text, today:shopMadridDate(now)};
}
function shopClassify(text) {
  if (typeof text !== 'string' || text.length > 320 || /[\p{Cc}\p{Cf}]/u.test(text)) return null;
  // Whole-question allowlist, not a blacklist or word stripping. No raw text leaves here.
  const q = text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim().replace(/^[¿¡]/,'').replace(/[?!.]$/,'').replace(/\s+/g,' ');
  const weekly = [
    'cuanto se ha recaudado esta semana','cuanto hemos cobrado esta semana',
    'cuanto hemos recaudado esta semana','cuanto se ha cobrado esta semana',
    'cuanto se recaudo esta semana','cuanto se ha recaudado en esta semana',
    'dime la recaudacion semanal','recaudacion de esta semana','recaudacion semanal','/semana',
  ];
  const due = ['que apartados vencen este mes','que apartados vencen en este mes',
    'muestrame los apartados que vencen este mes','dime que apartados vencen este mes',
    'apartados que vencen este mes','/vencimientos'];
  return weekly.includes(q) ? 'weekly_collections' : due.includes(q) ? 'monthly_deadlines' : null;
}
function shopPrepare(body, config, now) {
  const auth = shopAuthorize(body,config,now);
  if (!auth.authorized) return {...auth, messages:[]};
  const intent = shopClassify(auth.text);
  const base = {authorized:true, request_id:auth.request_id, today:auth.today};
  if (!intent) return {...base, status:'help', messages:[SHOP_HELP]};
  if (config.allow_external_ai !== true || config.allow_shop_reads !== true) return {...base,status:'disabled',messages:[]};
  return {...base,status:'interpret',expected_intent:intent,canonical_query:JSON.stringify({question:intent})};
}
function shopValidatePlan(agent, prepared) {
  shopRequire(prepared?.authorized === true && prepared.status === 'interpret' && SHOP_INTENTS.includes(prepared.expected_intent), 'PLAN_CONTEXT');
  const parsed = typeof agent?.output === 'string' ? JSON.parse(agent.output) : agent?.output;
  shopRequire(shopObject(parsed,['intent']) && parsed.intent === prepared.expected_intent, 'MODEL_OUTPUT');
  const steps = agent.intermediateSteps;
  shopRequire(Array.isArray(steps) && steps.length === 1, 'TOOL_COUNT');
  const step = steps[0], tool = parsed.intent === 'weekly_collections' ? 'Choose_Weekly_Collections_Plan' : 'Choose_Monthly_Deadlines_Plan';
  shopRequire(step?.action?.tool === tool && shopObject(step.action.toolInput,['intent']) && step.action.toolInput.intent === parsed.intent, 'TOOL_INPUT');
  const observation = JSON.parse(step.observation);
  shopRequire(shopObject(observation,['intent']) && observation.intent === parsed.intent, 'TOOL_RESULT');
  return {...shopPeriod(parsed.intent,prepared.today), request_id:prepared.request_id};
}
function shopCents(value, positive = false) {
  shopRequire(['number','string'].includes(typeof value) && /^\d+(?:\.\d{1,2})?$/.test(String(value)), 'AMOUNT');
  const [whole, fraction=''] = String(value).split('.');
  const n = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  shopRequire(Number.isSafeInteger(n) && n >= 0 && (!positive || n > 0), 'AMOUNT'); return n;
}
function shopAdd(a,b) { const sum=a+b; shopRequire(Number.isSafeInteger(sum),'OVERFLOW'); return sum; }
function shopResponse(response, requireCount = false) {
  shopRequire(response?.statusCode === 200 && Array.isArray(response.body), 'API_RESPONSE');
  shopRequire(response.body.length <= 10000 && Buffer.byteLength(JSON.stringify(response.body),'utf8') <= 5*1024*1024, 'API_LIMIT');
  const count = Object.entries(response.headers || {}).find(([k])=>k.toLowerCase()==='x-total-count')?.[1];
  shopRequire((!requireCount || count !== undefined) && (count === undefined || (/^\d+$/.test(String(count)) && Number(count)===response.body.length)), 'API_COUNT');
  const seen = new Set();
  for (const row of response.body) {
    shopRequire(row && shopId(row.id) && !seen.has(row.id), 'API_ID'); seen.add(row.id);
  }
  return response.body;
}
function shopCheckPeriod(period) {
  const expected = shopPeriod(period?.intent,period?.today);
  shopRequire(period.desde===expected.desde && period.hasta===expected.hasta,'PERIOD');
}
function shopWeekly(period, salesResponse, depositsResponse) {
  shopCheckPeriod(period); shopRequire(period.intent==='weekly_collections','INTENT');
  const lists = [shopResponse(salesResponse,true),shopResponse(depositsResponse)];
  const sums = lists.map((list,index)=>list.reduce((sum,row)=>{
    shopDate(row.fecha); shopRequire(row.fecha>=period.desde && row.fecha<=period.hasta,'RECORD_PERIOD');
    shopRequire(typeof row.forma_pago==='string' && row.forma_pago.trim().length>0,'METHOD');
    if (index===1) shopRequire(shopId(row.apartado_id),'RESERVATION_ID');
    return shopAdd(sum,shopCents(row.importe,true));
  },0));
  return {intent:period.intent,desde:period.desde,hasta:period.hasta,sales_cents:sums[0],deposits_cents:sums[1],total_cents:shopAdd(...sums),movement_count:lists[0].length+lists[1].length};
}
function shopField(value, required = true) {
  shopRequire(typeof value==='string' || (!required && (value===null || value===undefined)), 'FIELD');
  let text=String(value ?? '').normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu,' ').replace(/\s+/g,' ').trim();
  shopRequire(!required || text.length>0,'FIELD');
  // Plain text (no Telegram parse mode); break URL auto-linking in untrusted fields.
  text=text.replace(/:\/\//g, ': / /').replace(/\./g,'·').replace(/@/g,'[arroba]');
  return text.length>160 ? Array.from(text).slice(0,140).join('')+'… [texto abreviado]' : text || 'Sin indicar';
}
function shopMonthly(period, response) {
  shopCheckPeriod(period); shopRequire(period.intent==='monthly_deadlines','INTENT');
  const rows=shopResponse(response,true), selected=[];
  for (const row of rows) {
    shopRequire(['activo','liquidado','vencido'].includes(row.estado),'STATE');
    if (row.estado!=='activo') continue;
    shopDate(row.fecha_limite);
    if (row.fecha_limite<period.desde || row.fecha_limite>period.hasta) continue;
    selected.push({id:row.id,cliente:shopField(row.cliente),producto:shopField(row.producto),talla:shopField(row.talla,false),pending_cents:shopCents(row.pendiente),fecha_limite:row.fecha_limite,overdue:row.fecha_limite<period.today});
  }
  selected.sort((a,b)=>a.fecha_limite.localeCompare(b.fecha_limite)||a.id-b.id);
  return {intent:period.intent,desde:period.desde,hasta:period.hasta,rows:selected};
}
function shopEuro(cents) {
  shopRequire(Number.isSafeInteger(cents)&&cents>=0,'AMOUNT');
  const whole=String(Math.floor(cents/100)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return `${whole},${String(cents%100).padStart(2,'0')} €`;
}
function shopHumanDate(value) { return shopDate(value).split('-').reverse().join('/'); }
function shopRender(result) {
  if (result.intent==='weekly_collections') {
    shopRequire(result.total_cents===shopAdd(result.sales_cents,result.deposits_cents),'RUBRIC_TOTAL');
    return [`Recaudación de esta semana\nDel ${shopHumanDate(result.desde)} al ${shopHumanDate(result.hasta)} (Europe/Madrid)\nVentas directas: ${shopEuro(result.sales_cents)}\nAbonos de apartados: ${shopEuro(result.deposits_cents)}\nTotal recaudado: ${shopEuro(result.total_cents)}${result.movement_count===0?'\nNo hay movimientos registrados en este periodo.':''}`];
  }
  shopRequire(result.intent==='monthly_deadlines' && Array.isArray(result.rows),'RUBRIC_INTENT');
  const heading=`Apartados activos con fecha límite este mes\nDel ${shopHumanDate(result.desde)} al ${shopHumanDate(result.hasta)} (Europe/Madrid)`;
  if (!result.rows.length) return [heading+'\nNo hay apartados activos con fecha límite este mes.'];
  const records=result.rows.map((r,index)=>`${index+1}. Apartado #${r.id}\nCliente: ${r.cliente}\nProducto: ${r.producto} · Talla: ${r.talla}\nPendiente: ${shopEuro(r.pending_cents)}\nFecha límite: ${shopHumanDate(r.fecha_limite)}${r.overdue?' · Fuera de plazo':''}`);
  const chunks=[]; let chunk=heading;
  for (const record of records) {
    if ((chunk+'\n\n'+record).length>3400) { chunks.push(chunk); chunk=heading; }
    chunk+='\n\n'+record;
  }
  chunks.push(chunk);
  if (chunks.length>10 || chunks.some(s=>s.length>3400)) return [SHOP_LIMIT];
  return chunks.map((s,i)=>chunks.length>1?s+`\nParte ${i+1} de ${chunks.length}`:s);
}
function shopReply(requestId, status, messages) {
  shopRequire(typeof requestId==='string' && /^[a-z0-9_-]{8,64}$/.test(requestId),'REQUEST_ID');
  shopRequire(['ok','help','unavailable','disabled','ignored'].includes(status) && Array.isArray(messages) && messages.length<=10 && messages.every(s=>typeof s==='string'&&s.length>0&&s.length<=3500),'REPLY');
  return {request_id:requestId,status,messages};
}
function shopFixture() {
  const period=shopPeriod('weekly_collections','2026-10-28');
  const response=body=>({statusCode:200,headers:{'x-total-count':String(body.length)},body});
  const sales=response([{id:1,fecha:'2026-10-26',importe:20,forma_pago:'efectivo'}]);
  const deposits=response([5,10].map((importe,i)=>({id:i+1,apartado_id:1,fecha:'2026-10-27',importe,forma_pago:'bizum'})));
  const report=shopWeekly(period,sales,deposits);
  return {fixture_only:true,external_ai_called:false,shop_read:false,telegram_sent:false,report,messages:shopRender(report)};
}
if (typeof module!=='undefined') module.exports={SHOP_HELP,SHOP_UNAVAILABLE,SHOP_LIMIT,SHOP_INTENTS,shopObject,shopId,shopConfiguredId,shopDate,shopMadridDate,shopPeriod,shopAuthorize,shopClassify,shopPrepare,shopValidatePlan,shopCents,shopAdd,shopResponse,shopWeekly,shopMonthly,shopField,shopEuro,shopRender,shopReply,shopFixture};
