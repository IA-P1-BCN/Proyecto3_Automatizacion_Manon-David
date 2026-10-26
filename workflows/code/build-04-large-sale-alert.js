// Regenerates workflows/04-large-sale-alert.json from the tested Code node source.
// Run from the repo root: node workflows/code/build-04-large-sale-alert.js
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const alertCode = fs.readFileSync('workflows/code/04-format-alert.js', 'utf8').replaceAll('\r\n', '\n');

const id = (n) => `b1a1c1d1-0401-4000-8000-0000000000${String(n).padStart(2, '0')}`;

// Flow 08 is set as this flow's Error Workflow by hand after import: workflow IDs differ on every n8n instance.
// The false output of the IF is left unconnected: a sale at or below the threshold ends the run successfully.
const workflow = {
  name: '04 Large Sale Alert',
  nodes: [
    {
      id: id(1),
      name: 'When Called By Router',
      type: 'n8n-nodes-base.executeWorkflowTrigger',
      typeVersion: 1.1,
      position: [0, 0],
      parameters: { inputSource: 'passthrough' },
    },
    {
      id: id(2),
      name: 'Parse And Format',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { jsCode: alertCode },
    },
    {
      id: id(3),
      name: 'Is Sale Above Threshold?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [440, 0],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
          conditions: [
            {
              id: id(21),
              leftValue: '={{ $json.importe }}',
              rightValue: '={{ $json.umbral }}',
              operator: { type: 'number', operation: 'gt' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    {
      id: id(4),
      name: 'Send Large Sale Alert',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2.1,
      position: [680, -60],
      parameters: {
        fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}',
        toEmail: '={{ $env.TIENDA_EMAIL_AVISOS }}',
        subject: '={{ $json.subject }}',
        emailFormat: 'text',
        text: '={{ $json.body }}',
        options: {},
      },
    },
  ],
  connections: {
    'When Called By Router': { main: [[{ node: 'Parse And Format', type: 'main', index: 0 }]] },
    'Parse And Format': { main: [[{ node: 'Is Sale Above Threshold?', type: 'main', index: 0 }]] },
    'Is Sale Above Threshold?': { main: [[{ node: 'Send Large Sale Alert', type: 'main', index: 0 }], []] },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync('workflows/04-large-sale-alert.json', `${JSON.stringify(workflow, null, 2)}\n`);
