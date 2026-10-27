// Preserve the tested editor layout and behavior; remove only local bindings.
'use strict';
const fs = require('node:fs');

function sanitizeTestedExport(source) {
  const w = JSON.parse(JSON.stringify(source));
  if (!Array.isArray(w.nodes) || !w.connections) throw new Error('Invalid tested workflow export');
  for (const node of w.nodes) {
    delete node.credentials;
    delete node.webhookId;
    if (node.name === 'Configure Authorized Test Sender and Groq Access') {
      const assignments = node.parameters.assignments.assignments;
      for (const field of assignments) {
        if (field.name.startsWith('allow_')) field.value = false;
        if (field.name === 'authorized_test_sender') field.value = 'test-sender@example.invalid';
        if (field.name === 'shop_notice_to') field.value = 'shop-notices@example.invalid';
        if (field.name === 'shop_notice_from') field.value = 'shop-sender@example.invalid';
      }
    }
  }
  const result = {
    name: '03 Remote Deposits', nodes: w.nodes, connections: w.connections,
    active: false, pinData: {},
    settings: {executionOrder: w.settings?.executionOrder || 'v1', timezone: 'Europe/Madrid'},
    ...(w.nodeGroups?.length ? {nodeGroups:w.nodeGroups} : {}),
  };
  const text = JSON.stringify(result);
  if (/(?:gsk_|github_pat_|ghp_)[A-Za-z0-9_]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text)) {
    throw new Error('Potential secret in tested export: review before publication');
  }
  return result;
}

if (require.main === module) {
  const source = JSON.parse(fs.readFileSync('workflows/03-remote-deposits-tested.json','utf8'));
  fs.writeFileSync('workflows/03-remote-deposits.json', JSON.stringify(sanitizeTestedExport(source),null,2)+'\n');
}
module.exports = {sanitizeTestedExport};
