// Regenerates workflows/09-consent-check.json and workflows/09b-consent-backfill.json (inactive, no credentials) from the tested logic.
// Run from the repo root: node workflows/code/build-09-consent.js
// Before importing, create the Data Table `consentimientos` (columns email, estado, fecha, origen, all text).
// The shop Header Auth credential (flow 09b) and the Error Workflow (flow 08) are chosen by hand after import:
// credential and workflow IDs differ on every n8n instance.
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const core = fs.readFileSync('workflows/code/09-consent.js', 'utf8').replaceAll('\r\n', '\n');
const APP = 'http://tienda:8000';

const register = { __rl: true, mode: 'name', value: 'consentimientos' };
const column = (id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true });
const schema = ['email', 'estado', 'fecha', 'origen'].map(column);

function builder(prefix) {
  const nodes = [];
  const connections = {};
  const node = (name, type, typeVersion, parameters, x, y = 0, extra = {}) =>
    nodes.push({ id: `${prefix}-${nodes.length + 1}`, name, type: `n8n-nodes-base.${type}`, typeVersion, position: [x, y], parameters, ...extra });
  const code = (name, text, x, y = 0, extra = {}) => node(name, 'code', 2, { mode: 'runOnceForAllItems', jsCode: `${core}\n${text}` }, x, y, extra);
  const link = (from, to, output = 0) => {
    connections[from] ||= { main: [] };
    connections[from].main[output] ||= [];
    connections[from].main[output].push({ node: to, type: 'main', index: 0 });
  };
  // Reading the whole register: a small table, and one read serves every item of the call.
  const readRegister = (name, x, extra) => node(name, 'dataTable', 1.1, { resource: 'row', operation: 'get', dataTableId: register, returnAll: true }, x, 0, extra);
  const insertRows = (name, value, x, y = 0) => node(name, 'dataTable', 1.1, {
    resource: 'row',
    operation: 'insert',
    dataTableId: register,
    columns: { mappingMode: 'defineBelow', value, matchingColumns: [], schema },
    options: {},
  }, x, y);
  return { nodes, connections, node, code, link, readRegister, insertRows };
}

// 09 · Consent Check: called with items that carry an `email` (or `datos.email`) and optionally `registrar: true`.
// Returns the same items plus `permitido` and `razon`. A missing row, a withdrawn row and an unreadable register all mean "do not send".
{
  const { nodes, connections, node, code, link, readRegister, insertRows } = builder('consent-check');
  node('When Called By Another Flow', 'executeWorkflowTrigger', 1.1, { inputSource: 'passthrough' }, 0);
  // An unreadable register must not stop the run here: Decide turns it into "do not send", then Return Decisions raises the alert.
  readRegister('Read Consent Register', 220, { alwaysOutputData: true, onError: 'continueRegularOutput' });
  code('Decide', `const inputs = $('When Called By Another Flow').all();
const known = $('Read Consent Register').all().map((item) => item.json).filter((row) => row.error || row.email);
const hoy = $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd');
return inputs.map((item) => {
  const input = item.json;
  const decision = decideConsent(input.email ?? input.datos?.email, known, { registrar: input.registrar === true, hoy });
  if (decision.insertar) known.push(decision.insertar);
  return { json: { ...input, permitido: decision.permitido, razon: decision.razon, insertar: decision.insertar } };
});`, 440);
  node('New Consent?', 'if', 2.2, {
    conditions: {
      options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'consent-new-1', leftValue: '={{ $json.insertar != null }}', rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
      combinator: 'and',
    },
    options: {},
  }, 660);
  insertRows('Record Consent', {
    email: '={{ $json.insertar.email }}',
    estado: '={{ $json.insertar.estado }}',
    fecha: '={{ $json.insertar.fecha }}',
    origen: '={{ $json.insertar.origen }}',
  }, 880, -100);
  // Both paths end here and the node reads Decide, so the result is the same whichever path ran last.
  code('Return Decisions', `const items = $('Decide').all();
if (items.some((item) => item.json.razon === 'registro_ilegible')) {
  throw new Error('No se pudo leer el registro de consentimientos: no se envía ningún mensaje a clientes.');
}
return items.map((item) => {
  const { insertar, ...decision } = item.json;
  return { json: decision };
});`, 1100);
  link('When Called By Another Flow', 'Read Consent Register');
  link('Read Consent Register', 'Decide');
  link('Decide', 'New Consent?');
  link('New Consent?', 'Record Consent', 0);
  link('New Consent?', 'Return Decisions', 1);
  link('Record Consent', 'Return Decisions');
  const workflow = { id: 'pasoFirmeConsentCheck09', name: '09 Consent Check', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
  fs.writeFileSync('workflows/09-consent-check.json', `${JSON.stringify(workflow, null, 2)}\n`);
}

// 09b · Consent Backfill: run by hand once. Records the customers already in the app; sends nothing, changes no existing row.
{
  const { nodes, connections, node, code, link, readRegister, insertRows } = builder('consent-backfill');
  node('Manual Run', 'manualTrigger', 1, {}, 0);
  node('Fetch Reservations', 'httpRequest', 4.2, {
    method: 'GET',
    url: `${APP}/api/apartados`,
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    options: { timeout: 30000 },
  }, 220);
  readRegister('Read Consent Register', 440, { alwaysOutputData: true });
  code('Plan Missing Consents', `const reservations = $('Fetch Reservations').all().map((item) => item.json);
const rows = $input.all().map((item) => item.json).filter((row) => row.email);
const hoy = $now.setZone('Europe/Madrid').toFormat('yyyy-MM-dd');
return missingConsents(reservations, rows, { hoy }).map((row) => ({ json: row }));`, 660);
  insertRows('Record Consents', {
    email: '={{ $json.email }}',
    estado: '={{ $json.estado }}',
    fecha: '={{ $json.fecha }}',
    origen: '={{ $json.origen }}',
  }, 880);
  link('Manual Run', 'Fetch Reservations');
  link('Fetch Reservations', 'Read Consent Register');
  link('Read Consent Register', 'Plan Missing Consents');
  link('Plan Missing Consents', 'Record Consents');
  const workflow = { id: 'pasoFirmeConsentBackfill09b', name: '09b Consent Backfill', active: false, nodes, connections, settings: { executionOrder: 'v1', timezone: 'Europe/Madrid' } };
  fs.writeFileSync('workflows/09b-consent-backfill.json', `${JSON.stringify(workflow, null, 2)}\n`);
}
