// Regenerates workflows/02-deposit-receipt.json from the tested Code node source.
// Run from the repo root: node workflows/code/build-02-deposit-receipt.js
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const formatCode = fs.readFileSync('workflows/code/02-format-receipt.js', 'utf8').replaceAll('\r\n', '\n');

const id = (n) => `b1a1c1d1-0201-4000-8000-0000000000${String(n).padStart(2, '0')}`;

const isTrue = (conditionId, expression) => ({
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
  conditions: [
    {
      id: conditionId,
      leftValue: expression,
      rightValue: '',
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    },
  ],
  combinator: 'and',
});

const sendEmail = (nodeId, name, position, toEmail, subject, text) => ({
  id: id(nodeId),
  name,
  type: 'n8n-nodes-base.emailSend',
  typeVersion: 2.1,
  position,
  parameters: {
    fromEmail: '={{ $env.TIENDA_EMAIL_FROM }}',
    toEmail,
    subject,
    emailFormat: 'text',
    text,
    options: {},
  },
});

// Flow 08 is set as this flow's Error Workflow by hand after import: workflow IDs differ on every n8n instance.
const workflow = {
  name: '02 Deposit Receipt',
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
      name: 'Format Receipt',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [220, 0],
      parameters: { jsCode: formatCode },
    },
    {
      id: id(3),
      name: 'Has Usable Email?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [440, 0],
      parameters: { conditions: isTrue(id(21), '={{ $json.emailValido }}'), options: {} },
    },
    {
      id: id(4),
      name: 'Is Reservation Settled?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [680, -120],
      parameters: { conditions: isTrue(id(22), '={{ $json.liquidado }}'), options: {} },
    },
    sendEmail(5, 'Send Collect Your Shoes', [940, -220], '={{ $json.to }}', '={{ $json.recogida.subject }}', '={{ $json.recogida.body }}'),
    sendEmail(6, 'Send Partial Receipt', [940, -60], '={{ $json.to }}', '={{ $json.recibo.subject }}', '={{ $json.recibo.body }}'),
    sendEmail(
      7,
      'Send Shop Alert',
      [680, 120],
      '={{ $env.TIENDA_EMAIL_AVISOS }}',
      '={{ $json.aviso.subject }}',
      '={{ $json.aviso.body }}',
    ),
  ],
  connections: {
    'When Called By Router': { main: [[{ node: 'Format Receipt', type: 'main', index: 0 }]] },
    'Format Receipt': { main: [[{ node: 'Has Usable Email?', type: 'main', index: 0 }]] },
    'Has Usable Email?': {
      main: [
        [{ node: 'Is Reservation Settled?', type: 'main', index: 0 }],
        [{ node: 'Send Shop Alert', type: 'main', index: 0 }],
      ],
    },
    'Is Reservation Settled?': {
      main: [
        [{ node: 'Send Collect Your Shoes', type: 'main', index: 0 }],
        [{ node: 'Send Partial Receipt', type: 'main', index: 0 }],
      ],
    },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync('workflows/02-deposit-receipt.json', `${JSON.stringify(workflow, null, 2)}\n`);
