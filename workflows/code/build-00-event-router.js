// Regenerates the event router and its two stub handlers.
// Run from the repo root: node workflows/code/build-00-event-router.js
const fs = require('node:fs');

const id = (n) => `b1a1c1d1-0000-4000-8000-0000000000${String(n).padStart(2, '0')}`;
const write = (path, workflow) => fs.writeFileSync(path, `${JSON.stringify(workflow, null, 2)}\n`);

const eventIs = (name) => ({
  outputKey: name,
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
    conditions: [
      {
        id: id(40 + name.length),
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
    {
      id: id(3),
      name: 'Route by Event',
      type: 'n8n-nodes-base.switch',
      typeVersion: 3.2,
      position: [440, 0],
      parameters: {
        rules: { values: [eventIs('apartado.creado'), eventIs('abono.registrado'), missingEvent] },
        options: { fallbackOutput: 'extra', renameFallbackOutput: 'unhandled event' },
      },
    },
    callHandler(4, 'Call Reservation Confirmation (flow 01)', [700, -120]),
    callHandler(5, 'Call Deposit Receipt (flow 02)', [700, 20]),
    {
      id: id(6),
      name: 'Reject Event Without Name',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [700, 160],
      parameters: {
        jsCode: "throw new Error('El aviso de la tienda llegó sin nombre de evento');",
      },
    },
    {
      id: id(7),
      name: 'Ignore Unhandled Event',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [700, 300],
      parameters: {},
    },
  ],
  connections: {
    'Receive App Event': { main: [[{ node: 'Extract Event', type: 'main', index: 0 }]] },
    'Extract Event': { main: [[{ node: 'Route by Event', type: 'main', index: 0 }]] },
    'Route by Event': {
      main: [
        [{ node: 'Call Reservation Confirmation (flow 01)', type: 'main', index: 0 }],
        [{ node: 'Call Deposit Receipt (flow 02)', type: 'main', index: 0 }],
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
