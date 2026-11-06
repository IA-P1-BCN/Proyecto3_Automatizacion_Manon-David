// HU-14: every AI node in the exported flows must be named in docs/ai-data-inventory.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const INVENTORY = fs.readFileSync(path.join(ROOT, 'docs', 'ai-data-inventory.md'), 'utf8');

// Flow 03 calls Groq with a plain HTTP Request, so the host is part of what makes a node an AI node.
const AI_HOSTS = ['api.groq.com', 'api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com', 'openrouter.ai', 'api.mistral.ai', 'api.cohere.com'];

function isAiNode(node) {
  if (String(node.type).toLowerCase().includes('langchain')) return true;
  const url = typeof node.parameters?.url === 'string' ? node.parameters.url.toLowerCase() : '';
  return AI_HOSTS.some((host) => url.includes(host));
}

function undocumentedAiNodes(workflowFile, workflow, inventory) {
  return (workflow.nodes || []).filter(isAiNode).filter((node) => !inventory.includes(node.name)).map((node) => `${workflowFile}: ${node.name}`);
}

function exportedWorkflows() {
  const dir = path.join(ROOT, 'workflows');
  return fs.readdirSync(dir).filter((file) => file.endsWith('.json')).map((file) => ({ file, workflow: JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) }));
}

test('every AI node in the exported flows is named in the inventory', () => {
  const missing = exportedWorkflows().flatMap(({ file, workflow }) => undocumentedAiNodes(file, workflow, INVENTORY));
  assert.deepEqual(missing, []);
});

test('the inventory finds the exact known AI nodes of canonical flows 03 and 12', () => {
  // Local ignored tested exports can coexist here; the preceding test still scans ALL
  // exports for undocumented nodes. This assertion describes only the canonical pair.
  const canonical = new Set(['03-remote-deposits.json', '12-shop-telegram-assistant.json']);
  const found = exportedWorkflows().filter(({ file }) => canonical.has(file)).flatMap(({ file, workflow }) => (workflow.nodes || []).filter(isAiNode).map((node) => `${file}: ${node.name}`));
  assert.deepEqual(found, [
    '03-remote-deposits.json: Extract Payer Amount and Concept from Bank Notice with Groq',
    '12-shop-telegram-assistant.json: Interpret Supported Shop Question',
    '12-shop-telegram-assistant.json: Groq Shop Query Model',
    '12-shop-telegram-assistant.json: Choose Weekly Collections Plan',
    '12-shop-telegram-assistant.json: Choose Monthly Deadlines Plan',
  ]);
});

test('an AI node that the inventory does not name is reported with its flow and name', () => {
  const copy = { nodes: [
    { name: 'Ask Model', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} },
    { name: 'Call Provider', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://api.openai.com/v1/chat/completions' } },
    { name: 'Plain API Call', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'http://tienda:8000/api/apartados' } },
  ] };
  assert.deepEqual(undocumentedAiNodes('99-fake.json', copy, INVENTORY), ['99-fake.json: Ask Model', '99-fake.json: Call Provider']);
});

test('a documented AI node passes', () => {
  const copy = { nodes: [{ name: 'Ask Model', type: '@n8n/n8n-nodes-langchain.agent', parameters: {} }] };
  assert.deepEqual(undocumentedAiNodes('99-fake.json', copy, `${INVENTORY}\n### Ask Model`), []);
});
