const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cents, inputDate, calculate, parseHistory, upsertHistory, findHistory } = require('./05-daily-close');
const date = '2026-10-23';
const movement = (id, importe, forma_pago = 'efectivo') => ({ id, fecha: date, importe, forma_pago });
const page = (data, has_more = false) => ({ statusCode: 200, body: { result:'success', data, has_more } });
const file = { id:9, name:'basedatos.csv', type:'file', status:'ok', etag:'0123456789abcdef' };

test('mixed day counts each source and initial deposit once', () => {
  const result = calculate(date, [movement(1,6.5), movement(2,20,'tarjeta')], [movement(1,10), movement(2,5,'bizum')]);
  assert.equal(result.row.total,4150); assert.equal(result.row.total_ventas,2650);
  assert.equal(result.row.total_abonos,1500); assert.equal(result.row.abonos_efectivo,1000);
  assert.match(result.body,/41,50 €/); assert.match(result.body,/Bizum incluye transferencias/);
});
test('decimal sums are exact and empty arrays still yield one close', () => {
  assert.equal(calculate(date,[movement(1,0.1),movement(2,0.2),movement(3,4.5)],[]).row.total,480);
  const empty = calculate(date,[],[]); assert.equal(empty.row.total,0); assert.match(empty.body,/No hubo movimientos/);
});
test('unknown methods are not dropped', () => {
  const r = calculate(date,[movement(1,12,'unexpected')],[]).row;
  assert.equal(r.ventas_otros,1200); assert.equal(r.total,1200);
});
test('invalid/duplicate/date-mismatched records fail rather than changing figures', () => {
  for (const records of [[movement(1,-1)], [movement(1,1.001)], [movement(1,1),movement(1,2)],
    [{...movement(1,2),fecha:'2026-10-22'}], [movement(1,'1,25')]]) {
    assert.throws(() => calculate(date, records, []));
  }
  assert.throws(() => cents('99999999999999999'));
});
test('manual default suppresses email; schedule and explicit opt-in enable it', () => {
  assert.equal(inputDate({mode:'manual',fecha:date},date).send_email,false);
  assert.equal(inputDate({mode:'manual',fecha:date,send_email:true},date).send_email,true);
  assert.equal(inputDate({mode:'scheduled'},date).send_email,true);
});
test('invalid/future dates and nonboolean email flag are rejected', () => {
  for (const fecha of ['2026-02-30','2026-10-24','23/10/2026','']) assert.throws(() => inputDate({mode:'manual',fecha},date));
  assert.throws(() => inputDate({mode:'manual',fecha:date,send_email:'false'},date));
});
test('CSV uses BOM, semicolons, comma decimals, and CRLF', () => {
  const csv = upsertHistory(null,calculate(date,[movement(1,10.25)],[]).row);
  assert.ok(csv.startsWith('\uFEFFfecha;')); assert.match(csv,/10,25/); assert.ok(csv.endsWith('\r\n'));
  assert.equal(parseHistory(csv).get(date).total,1025);
});
test('rerun replaces one date, preserves all others, sorts, and is idempotent', () => {
  const first = calculate(date,[],[]).row;
  let csv = upsertHistory(null,first);
  csv = upsertHistory(csv,{...first,fecha:'2026-10-22'});
  const updated = calculate(date,[movement(1,22)],[]).row;
  csv = upsertHistory(csv,updated);
  assert.equal(parseHistory(csv).size,2); assert.equal(parseHistory(csv).get(date).total,2200);
  assert.equal(parseHistory(csv).get('2026-10-22').total,0);
  assert.equal(upsertHistory(csv,updated),csv);
  assert.ok(csv.indexOf('2026-10-22') < csv.indexOf(date));
});
test('malformed, duplicate, or inconsistent history cannot be overwritten', () => {
  const row = calculate(date,[],[]).row;
  const csv = upsertHistory(null,row);
  for (const bad of ['', '<html>login</html>', csv+csv.split('\r\n')[1]+'\r\n', csv.replace(/0,00/, '9,00'), csv.replace(/0,00/,'0.00')]) {
    assert.throws(() => upsertHistory(bad,row));
  }
});
test('file discovery ignores registro.txt and identifies existing ID/ETag', () => {
  assert.equal(findHistory([page([{id:8,name:'registro.txt'}])]),null);
  assert.equal(findHistory([page([file])]).id,9);
  assert.equal(findHistory([page([{...file,status:null}])]).id,9);
});
test('discovery validates pagination, permissions, locked files and duplicate names', () => {
  assert.equal(findHistory([page([],true),page([file])]).id,9);
  for (const pages of [[page([],true)], [{statusCode:403,body:{}}], [page([file,file])],
    [page([{...file,etag:null}])], [page([{...file,status:'locked'}])]]) assert.throws(() => findHistory(pages));
});

test('generated workflow is inactive, has stable routes, no credential values or real IDs', () => {
  const wf = require('../05-daily-close.json');
  assert.equal(wf.active,false); assert.equal(wf.settings.timezone,'Europe/Madrid');
  assert.equal(wf.nodes.find(n=>n.name==='Nightly 23:55').parameters.rule.interval[0].expression,'55 23 * * *');
  assert.equal(wf.nodes.find(n=>n.name==='Save History').retryOnFail,undefined);
  assert.equal(wf.nodes.find(n=>n.name==='Send Closing Email').onError,'continueRegularOutput');
  assert.ok(wf.nodes.every(n=>!n.credentials));
  const names = new Set(wf.nodes.map(n=>n.name));
  for (const c of Object.values(wf.connections)) for (const branch of c.main) for (const target of branch) assert.ok(names.has(target.node));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const n of wf.nodes.filter(n=>n.type.endsWith('.code'))) assert.doesNotThrow(()=>new AsyncFunction(n.parameters.jsCode));
  assert.doesNotMatch(JSON.stringify(wf),/4573564|zynapse@|registro\.txt|2420593/);
});

async function runCode(name, input, executed = {}) {
  const wf = require('../05-daily-close.json');
  const text = wf.nodes.find(n => n.name === name).parameters.jsCode;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const select = (node) => ({ isExecuted: Object.hasOwn(executed,node), first: () => ({ json:executed[node] }) });
  const context = { helpers: { prepareBinaryData: async (buffer,fileName,mimeType) => ({ data:buffer.toString('base64'),fileName,mimeType }) } };
  return new AsyncFunction('$input','$','$env','$now',text).call(context,
    { first:()=>({json:input[0]}), all:()=>input.map(json=>({json})) }, select,
    { KDRIVE_DRIVE_ID:'1234',KDRIVE_DIRECTORY_ID:'99' },
    { setZone:()=>({ toFormat:()=>date }) });
}

test('embedded n8n code builds a create-only raw UTF-8 upload, counting BOM bytes', async () => {
  const prepared = (await runCode('Prepare Close',[{mode:'manual',fecha:date}]))[0].json;
  const result = calculate(date,[movement(1,3.5)],[]);
  const state = (await runCode('Locate History',[page([{id:8,name:'registro.txt'}])],{
    'Calculate Close':{...prepared,...result},
  }))[0].json;
  const csv = (await runCode('Create History CSV',[state]))[0].json;
  const upload = (await runCode('Prepare Upload',[csv]))[0];
  const url = new URL(upload.json.upload_url);
  assert.equal(url.searchParams.get('conflict'),'error');
  assert.equal(url.searchParams.get('directory_id'),'99');
  assert.equal(url.searchParams.get('file_name'),'basedatos.csv');
  assert.equal(url.searchParams.has('file_id'),false);
  assert.equal(Number(url.searchParams.get('total_size')),Buffer.from(upload.binary.data.data,'base64').length);
  assert.equal(upload.json.if_match,'blank');
});

test('embedded existing-history update uses same file ID and ETag, not create parameters', async () => {
  const result = calculate(date,[],[]);
  const previous = upsertHistory(null,result.row);
  const state = {...result,drive_id:'1234',directory_id:'99',file,email_failed:false};
  const update = (await runCode('Update History CSV',[{statusCode:200,data:previous}],{'Locate History':state}))[0].json;
  const upload = (await runCode('Prepare Upload',[update]))[0];
  const url = new URL(upload.json.upload_url);
  assert.equal(url.searchParams.get('file_id'),'9');
  for (const key of ['directory_id','file_name','conflict']) assert.equal(url.searchParams.has(key),false);
  assert.equal(upload.json.if_match,file.etag);
});

test('embedded result reports email failure after successful save and rejects uncertain saves', async () => {
  const state = {...calculate(date,[],[]),fecha:date,file,email_failed:true};
  await assert.rejects(runCode('Verify Result',[{statusCode:200,body:{result:'success',data:{id:9}}}],{'Prepare Upload':state}),/falló el envío/);
  await assert.rejects(runCode('Verify Result',[{statusCode:200,body:{result:'asynchronous'}}],{'Prepare Upload':state}),/no confirmó/);
  await assert.rejects(runCode('Verify Result',[{statusCode:200,body:{result:'success',data:{id:10}}}],{'Prepare Upload':state}),/ID distinto/);
});

test('real n8n text response uses data: update adds a date and preserves existing row', async () => {
  const original = calculate(date,[movement(1,14.90),movement(2,98.85,'tarjeta'),movement(3,79.90,'bizum')],[movement(1,20,'tarjeta')]).row;
  const existing = upsertHistory(null,original).replace(/^\uFEFF/,'');
  const newRow = {...calculate(date,[],[]).row,fecha:'2026-10-22'};
  const response = {data:existing,headers:{'content-type':'text/csv; charset=utf-8'},statusCode:200,statusMessage:'OK'};
  const result = (await runCode('Update History CSV',[response],{'Locate History':{row:newRow,file}}))[0].json;
  const rows = parseHistory(result.csv);
  assert.equal(rows.size,2);
  assert.equal(rows.get(date).total,21365);
  assert.equal(rows.get('2026-10-22').total,0);
  assert.equal(result.file.id,file.id);
});

test('download failure or non-text content cannot overwrite the history', async () => {
  for (const response of [{statusCode:403,data:'denied'}, {statusCode:200,data:{unexpected:true}}, {statusCode:200,data:'<html>login</html>'}]) {
    await assert.rejects(runCode('Update History CSV',[response],{'Locate History':{row:calculate(date,[],[]).row,file}}));
  }
});
