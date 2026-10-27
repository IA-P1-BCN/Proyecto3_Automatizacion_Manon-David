// Regenerates the event router and its stub handlers.
// Run from the repo root: node workflows/code/build-00-event-router.js
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const flagCore = fs.readFileSync('workflows/code/00-migration-flag.js', 'utf8').replaceAll('\r\n', '\n');

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

const missingEvent = {
  outputKey: 'missing event name',
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
    conditions: [
      {
        id: id(60),
        leftValue: '={{ $json.evento }}',
        rightValue: '',
        operator: { type: 'string', operation: 'equals' },
      },
    ],
    combinator: 'and',
  },
};

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
      parameters: { httpMethod: 'POST', path: 'tienda', options: {} },
    },
    {
      id: id(2),
      name: 'Extract Event',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.4,
      position: [220, 0],
      parameters: {
        mode: 'manual',
        assignments: {
          assignments: [
            { id: id(11), name: 'evento', type: 'string', value: '={{ $json.body?.evento ?? "" }}' },
            { id: id(12), name: 'datos', type: 'object', value: '={{ $json.body?.datos ?? {} }}' },
          ],
        },
        options: {},
      },
    },
    // Migration flag (HU-10): while the Excel migration runs, its own creates would trigger flows 01 and 02 for historical rows.
    // A missing row, an unreadable table or a flag older than 30 minutes all mean "route as usual": a real event is never lost.
    {
      id: id(9),
      name: 'Read Migration Flag',
      type: 'n8n-nodes-base.dataTable',
      typeVersion: 1.1,
      position: [440, 0],
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
      position: [660, 0],
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
      position: [880, 0],
      parameters: {
        rules: { values: [eventIs('apartado.creado'), eventIs('abono.registrado'), eventIs('venta.registrada', id(61)), missingEvent] },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'unhandled event' },
      },
    },
    callHandler(4, 'Call Reservation Confirmation (flow 01)', [1140, -120]),
    callHandler(5, 'Call Deposit Receipt (flow 02)', [1140, 20]),
    callHandler(8, 'Call Large Sale Alert (flow 04)', [1140, 160]),
    {
      id: id(6),
      name: 'Reject Event Without Name',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1140, 300],
      parameters: {
        jsCode: "throw new Error('El aviso de la tienda llegó sin nombre de evento');",
      },
    },
    {
      id: id(7),
      name: 'Ignore Unhandled Event',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [1140, 440],
      parameters: {},
    },
  ],
  connections: {
    'Receive App Event': { main: [[{ node: 'Extract Event', type: 'main', index: 0 }]] },
    'Extract Event': { main: [[{ node: 'Read Migration Flag', type: 'main', index: 0 }]] },
    'Read Migration Flag': { main: [[{ node: 'Check Migration Flag', type: 'main', index: 0 }]] },
    'Check Migration Flag': { main: [[{ node: 'Route by Event', type: 'main', index: 0 }]] },
    'Route by Event': {
      main: [
        [{ node: 'Call Reservation Confirmation (flow 01)', type: 'main', index: 0 }],
        [{ node: 'Call Deposit Receipt (flow 02)', type: 'main', index: 0 }],
        [{ node: 'Call Large Sale Alert (flow 04)', type: 'main', index: 0 }],
        [{ node: 'Reject Event Without Name', type: 'main', index: 0 }],
        [{ node: 'Ignore Unhandled Event', type: 'main', index: 0 }],
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
