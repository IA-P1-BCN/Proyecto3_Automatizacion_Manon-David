// Regenerates workflows/08-error-workflow.json from the tested Code node source.
// Run from the repo root: node workflows/code/build-08-error-workflow.js
const fs = require('node:fs');

const sanitiseCode = fs.readFileSync('workflows/code/08-sanitise-error.js', 'utf8');

const workflow = {
  name: '08 Error Workflow',
  nodes: [
    {
      id: 'b1a1c1d1-0801-4000-8000-000000000001',
      name: 'Error Trigger',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [0, 0],
      parameters: {},
    },
    {
      id: 'b1a1c1d1-0801-4000-8000-000000000002',
      name: 'Sanitise and Format Alert',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [240, 0],
      parameters: { jsCode: sanitiseCode },
    },
    {
      id: 'b1a1c1d1-0801-4000-8000-000000000003',
      name: 'Send Alert Email',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2.1,
      position: [480, 0],
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
    'Error Trigger': { main: [[{ node: 'Sanitise and Format Alert', type: 'main', index: 0 }]] },
    'Sanitise and Format Alert': { main: [[{ node: 'Send Alert Email', type: 'main', index: 0 }]] },
  },
  settings: { executionOrder: 'v1' },
};

fs.writeFileSync('workflows/08-error-workflow.json', `${JSON.stringify(workflow, null, 2)}\n`);
