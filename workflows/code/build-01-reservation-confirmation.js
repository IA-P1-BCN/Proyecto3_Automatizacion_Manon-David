// Regenerates workflows/01-reservation-confirmation.json from the tested Code node source.
// Run from the repo root: node workflows/code/build-01-reservation-confirmation.js
const fs = require('node:fs');

// Same output on LF and CRLF checkouts.
const formatCode = fs.readFileSync('workflows/code/01-format-confirmation.js', 'utf8').replaceAll('\r\n', '\n');

const id = (n) => `b1a1c1d1-0101-4000-8000-0000000000${String(n).padStart(2, '0')}`;

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
  name: '01 Reservation Confirmation',
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
      name: 'Format Confirmation',
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
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
          conditions: [
            {
              id: id(21),
              leftValue: '={{ $json.emailValido }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
    },
    sendEmail(
      4,
      'Send Customer Confirmation',
      [700, -80],
      '={{ $json.to }}',
      '={{ $json.confirmacion.subject }}',
      '={{ $json.confirmacion.body }}',
    ),
    sendEmail(
      5,
      'Send Shop Alert',
      [700, 100],
      '={{ $env.TIENDA_EMAIL_AVISOS }}',
      '={{ $json.aviso.subject }}',
      '={{ $json.aviso.body }}',
    ),
  ],
  connections: {
    'When Called By Router': { main: [[{ node: 'Format Confirmation', type: 'main', index: 0 }]] },
    'Format Confirmation': { main: [[{ node: 'Has Usable Email?', type: 'main', index: 0 }]] },
    'Has Usable Email?': {
      main: [
        [{ node: 'Send Customer Confirmation', type: 'main', index: 0 }],
        [{ node: 'Send Shop Alert', type: 'main', index: 0 }],
      ],
    },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync('workflows/01-reservation-confirmation.json', `${JSON.stringify(workflow, null, 2)}\n`);
