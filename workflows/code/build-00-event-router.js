// Regenerates the event router and its stub handlers.
// Run from the repo root: node workflows/code/build-00-event-router.js
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const flagCore = fs.readFileSync('workflows/code/00-migration-flag.js', 'utf8').replaceAll('\r\n', '\n');
const tokenCore = fs.readFileSync('workflows/code/00-check-token.js', 'utf8').replaceAll('\r\n', '\n');
const validateCore = fs.readFileSync('workflows/code/00-validate-event.js', 'utf8').replaceAll('\r\n', '\n');

const id = (n) => `b1a1c1d1-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const write = (path, workflow) => fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);

// Condition ids must be unique per rule; the name length alone collides for two 16-letter events.
const eventIs = (name, conditionId = id(40 + name.length)) => ({
  outputKey: name,
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
    conditions: [
      {
        id: conditionId,
        leftValue: '={{ $json.evento }}',
        rightValue: name,
        operator: { type: 'string', operation: 'equals' },
      },
    ],
    combinator: 'and',
  },
});

// The sub-workflow is picked by hand after import: workflow IDs differ on every n8n instance.
const callHandler = (nodeId, name, position) => ({
  id: id(nodeId),
  name,
  type: 'n8n-nodes-base.executeWorkflow',
  typeVersion: 1.2,
  position,
  parameters: {
    source: 'database',
    workflowId: { __rl: true, value: '', mode: 'id' },
    mode: 'once',
    options: { waitForSubWorkflow: false },
  },
});

// Respond to Webhook answers the app before the handlers run, so its 5-second timeout is never at risk.
const respond = (nodeId, name, position, code, body) => ({
  id: id(nodeId),
  name,
  type: 'n8n-nodes-base.respondToWebhook',
  typeVersion: 1.1,
  position,
  parameters: body
    ? { respondWith: 'json', responseBody: body, options: { responseCode: code } }
    : { respondWith: 'noData', options: { responseCode: code } },
});

const isTrue = (conditionId, expression) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [{ id: conditionId, leftValue: expression, rightValue: '', operator: { type: 'boolean', operation: 'true', singleValue: true } }],
  combinator: 'and',
});

// Consent (HU-14): flow 09 answers `permitido`. An event without an email still goes on: flows 01 and 02 then only warn the shop.
const callConsentCheck = (nodeId, name, position) => ({
  id: id(nodeId),
  name,
  type: 'n8n-nodes-base.executeWorkflow',
  typeVersion: 1.2,
  position,
  parameters: {
    source: 'database',
    workflowId: { __rl: true, value: '', mode: 'id' },
    mode: 'once',
    options: { waitForSubWorkflow: true },
  },
});
const mayMessage = (nodeId, name, position, conditionId) => ({
  id: id(nodeId),
  name,
  type: 'n8n-nodes-base.if',
  typeVersion: 2.2,
  position,
  parameters: { conditions: isTrue(id(conditionId), "={{ $json.permitido === true || $json.razon === 'sin_email' }}"), options: {} },
});

write('workflows/00-event-router.json', {
  name: '00 Event Router',
  nodes: [
    {
      id: id(1),
      name: 'Receive App Event',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: 'b1a1c1d1-0000-4000-8000-0000000000aa',
      parameters: { httpMethod: 'POST', path: 'tienda', responseMode: 'responseNode', options: {} },
    },
    // Authentication (HU-14): the app can only post to a URL, so its token travels in ?token=; other callers may use X-Webhook-Token.
    {
      id: id(12),
      name: 'Check Token',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `${tokenCore}\nconst request = $input.first().json;\nconst result = checkWebhookToken({ configured: $env.TIENDA_WEBHOOK_TOKEN, header: request.headers?.['x-webhook-token'], query: request.query?.token });\nreturn [{ json: { ...result, body: request.body } }];`,
      },
    },
    {
      id: id(13),
      name: 'Token Accepted?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [440, 0],
      parameters: { conditions: isTrue(id(14), '={{ $json.authorized }}'), options: {} },
    },
    respond(15, 'Respond Accepted', [660, -60], 200),
    respond(16, 'Respond Unauthorized', [660, 200], 401, '={{ { error: "No autorizado" } }}'),
    // A wrong token ends here quietly (probes must not flood the shop with alerts); an empty configured token is a setup mistake and does alert.
    {
      id: id(17),
      name: 'Raise Token Misconfiguration',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, 200],
      parameters: {
        jsCode: "if ($('Check Token').first().json.misconfigured) throw new Error('TIENDA_WEBHOOK_TOKEN está vacío en n8n: el router rechaza todos los avisos de la tienda.');\nreturn [];",
      },
    },
    // Validation (HU-14): the reason names the field only, never a value from the payload.
    {
      id: id(2),
      name: 'Extract Event',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [880, -60],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `${validateCore}\nconst result = validateEvent($input.first().json.body);\nif (!result.ok) throw new Error('Aviso de la tienda rechazado: ' + result.reason);\nreturn [{ json: { evento: result.evento, datos: result.datos } }];`,
      },
    },
    // Migration flag (HU-10): while the Excel migration runs, its own creates would trigger flows 01 and 02 for historical rows.
    // A missing row, an unreadable table or a flag older than 30 minutes all mean "route as usual": a real event is never lost.
    {
      id: id(9),
      name: 'Read Migration Flag',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [1100, -60],
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
      parameters: {
        resource: 'row',
        operation: 'get',
        dataTableId: { __rl: true, mode: 'name', value: 'migration_state' },
        matchType: 'allConditions',
        filters: { conditions: [{ keyName: 'clave', condition: 'eq', keyValue: 'migracion' }] },
        returnAll: false,
        limit: 1,
      },
    },
    {
      id: id(10),
      name: 'Check Migration Flag',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1320, -60],
      parameters: {
        mode: 'runOnceForAllItems',
        jsCode: `${flagCore}\nif (isMigrationRunning($input.first()?.json, Date.now())) return [];\nconst event = $('Extract Event').first().json;\nreturn [{ json: { evento: event.evento, datos: event.datos } }];`,
      },
    },
    {
      id: id(3),
      name: 'Route by Event',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [1540, -60],
      parameters: {
        rules: { values: [eventIs('apartado.creado'), eventIs('abono.registrado'), eventIs('venta.registrada', id(61))] },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'unhandled event' },
      },
    },
    // New reservation: giving an email in the shop is the consent, so flow 09 records it (never over a withdrawn row) before flow 01 runs.
    {
      id: id(18),
      name: 'Mark New Reservation',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1760, -260],
      parameters: { mode: 'runOnceForAllItems', jsCode: 'return [{ json: { ...$input.first().json, registrar: true } }];' },
    },
    callConsentCheck(19, 'Check Consent for New Reservation (flow 09)', [1980, -260]),
    mayMessage(20, 'May Confirm Reservation?', [2200, -260], 62),
    callHandler(4, 'Call Reservation Confirmation (flow 01)', [2420, -300]),
    callConsentCheck(21, 'Check Consent for Deposit (flow 09)', [1760, -100]),
    mayMessage(22, 'May Send Receipt?', [1980, -100], 63),
    callHandler(5, 'Call Deposit Receipt (flow 02)', [2200, -140]),
    callHandler(8, 'Call Large Sale Alert (flow 04)', [1760, 60]),
    {
      id: id(7),
      name: 'Ignore Unhandled Event',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [1760, 220],
      parameters: {},
    },
    {
      id: id(23),
      name: 'Skip Message Without Consent',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [2420, -180],
      parameters: {},
    },
  ],
  connections: {
    'Receive App Event': { main: [[{ node: 'Check Token', type: 'main', index: 0 }]] },
    'Check Token': { main: [[{ node: 'Token Accepted?', type: 'main', index: 0 }]] },
    'Token Accepted?': {
      main: [
        [{ node: 'Respond Accepted', type: 'main', index: 0 }],
        [{ node: 'Respond Unauthorized', type: 'main', index: 0 }],
      ],
    },
    'Respond Accepted': { main: [[{ node: 'Extract Event', type: 'main', index: 0 }]] },
    'Respond Unauthorized': { main: [[{ node: 'Raise Token Misconfiguration', type: 'main', index: 0 }]] },
    'Extract Event': { main: [[{ node: 'Read Migration Flag', type: 'main', index: 0 }]] },
    'Read Migration Flag': { main: [[{ node: 'Check Migration Flag', type: 'main', index: 0 }]] },
    'Check Migration Flag': { main: [[{ node: 'Route by Event', type: 'main', index: 0 }]] },
    'Route by Event': {
      main: [
        [{ node: 'Mark New Reservation', type: 'main', index: 0 }],
        [{ node: 'Check Consent for Deposit (flow 09)', type: 'main', index: 0 }],
        [{ node: 'Call Large Sale Alert (flow 04)', type: 'main', index: 0 }],
        [{ node: 'Ignore Unhandled Event', type: 'main', index: 0 }],
      ],
    },
    'Mark New Reservation': { main: [[{ node: 'Check Consent for New Reservation (flow 09)', type: 'main', index: 0 }]] },
    'Check Consent for New Reservation (flow 09)': { main: [[{ node: 'May Confirm Reservation?', type: 'main', index: 0 }]] },
    'May Confirm Reservation?': {
      main: [
        [{ node: 'Call Reservation Confirmation (flow 01)', type: 'main', index: 0 }],
        [{ node: 'Skip Message Without Consent', type: 'main', index: 0 }],
      ],
    },
    'Check Consent for Deposit (flow 09)': { main: [[{ node: 'May Send Receipt?', type: 'main', index: 0 }]] },
    'May Send Receipt?': {
      main: [
        [{ node: 'Call Deposit Receipt (flow 02)', type: 'main', index: 0 }],
        [{ node: 'Skip Message Without Consent', type: 'main', index: 0 }],
      ],
    },
  },
  settings: { executionOrder: 'v1' },
});

const stub = (name, nodeBase) => ({
  name,
  nodes: [
    {
      id: id(nodeBase),
      name: 'When Called By Router',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      position: [0, 0],
      parameters: { inputSource: 'passthrough' },
    },
    {
      id: id(nodeBase + 1),
      name: 'Received Event',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [220, 0],
      parameters: {},
    },
  ],
  connections: { 'When Called By Router': { main: [[{ node: 'Received Event', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1' },
});

write('workflows/tests/00-stub-reservation-confirmation.json', stub('00 Stub · Reservation Confirmation (flow 01)', 20));
write('workflows/tests/00-stub-deposit-receipt.json', stub('00 Stub · Deposit Receipt (flow 02)', 30));

// Test-only handler that always fails (router tasks 3.1 and 3.2).
write('workflows/tests/00-stub-failing.json', {
  name: '00 Stub · Failing Handler (test only)',
  nodes: [
    {
      id: id(50),
      name: 'When Called By Router',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      position: [0, 0],
      parameters: { inputSource: 'passthrough' },
    },
    {
      id: id(51),
      name: 'Fail On Purpose',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { jsCode: "throw new Error('Fallo provocado en el manejador de prueba');" },
    },
  ],
  connections: { 'When Called By Router': { main: [[{ node: 'Fail On Purpose', type: 'main', index: 0 }]] } },
  settings: { executionOrder: 'v1' },
});
