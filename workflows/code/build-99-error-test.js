// Regenerates workflows/99-error-test.json: a test-only flow that fails on purpose.
// Run from the repo root: node workflows/code/build-99-error-test.js
const fs = require('node:fs');

const workflow = {
  name: '99 Error Test',
  nodes: [
    {
      id: 'b1a1c1d1-9901-4000-8000-000000000001',
      name: 'Receive Test Request',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [0, 0],
      webhookId: 'b1a1c1d1-9901-4000-8000-0000000000aa',
      parameters: { httpMethod: 'POST', path: 'error-test', options: {} },
    },
    {
      id: 'b1a1c1d1-9901-4000-8000-000000000002',
      name: 'Throw Test Error',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [240, 0],
      parameters: {
        jsCode: [
          '// Fails on purpose with the message sent in the request body, to exercise flow 08.',
          "const message = $input.first().json.body?.message ?? '';",
          'throw new Error(message);',
        ].join('\n'),
      },
    },
  ],
  connections: {
    'Receive Test Request': { main: [[{ node: 'Throw Test Error', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync('workflows/99-error-test.json', `${JSON.stringify(workflow, null, 2)}\n`);
