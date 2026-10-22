const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completedIssueNumbers, closeCompletedIssues } = require('./close-completed-issues.cjs');

test('accepts explicit local completion lines and deduplicates issue numbers', () => {
  assert.deepEqual(completedIssueNumbers('Closes #17\r\n- fixes #18\nResolves #17\nRefs #19'), [17, 18]);
});

test('ignores partial references, examples, external repositories, and incidental mentions', () => {
  assert.deepEqual(completedIssueNumbers([
    'Refs #17', '> Closes #18', 'Example: Closes #19',
    'Closes other/repository#20', 'Closes https://github.com/org/repo/issues/21',
    '```text', 'Closes #22', '```', '~~~', 'Closes #23', '~~~',
  ].join('\n')), []);
});

function fixture(overrides = {}) {
  const calls = [];
  const context = {
    eventName: 'pull_request', repo: { owner: 'team', repo: 'shop' },
    payload: { action: 'closed', pull_request: {
      merged: true, number: 30, body: 'Closes #17\nCloses #18\nCloses #19',
      html_url: 'https://github.com/team/shop/pull/30',
      base: { ref: 'dev', repo: { full_name: 'team/shop' } },
      ...overrides,
    } },
  };
  const github = { rest: { issues: {
    get: async ({ issue_number }) => ({ data: {
      state: issue_number === 18 ? 'closed' : 'open',
      ...(issue_number === 19 ? { pull_request: {} } : {}),
    } }),
    update: async (params) => calls.push(['update', params]),
    createComment: async (params) => calls.push(['comment', params]),
  } } };
  return { context, github, calls, core: { info() {}, warning() {} } };
}

test('closes only open issues and records the merged PR', async () => {
  const f = fixture();
  await closeCompletedIssues(f);
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[0], ['update', {
    owner: 'team', repo: 'shop', issue_number: 17, state: 'closed', state_reason: 'completed',
  }]);
  assert.match(f.calls[1][1].body, /https:\/\/github.com\/team\/shop\/pull\/30/);
});

test('unmerged PRs, other targets, and missing directives make no writes', async () => {
  for (const overrides of [
    { merged: false }, { base: { ref: 'main' } }, { body: 'Refs #17' },
  ]) {
    const f = fixture(overrides);
    await closeCompletedIssues(f);
    assert.deepEqual(f.calls, []);
  }
});

test('rerunning after closure does not duplicate comments', async () => {
  const f = fixture();
  f.github.rest.issues.get = async () => ({ data: { state: 'closed' } });
  await closeCompletedIssues(f);
  assert.deepEqual(f.calls, []);
});

test('closes multiple distinct issues once each', async () => {
  const f = fixture({ body: 'Closes #17\nCloses #20\nCloses #17' });
  await closeCompletedIssues(f);
  assert.deepEqual(f.calls.filter(([action]) => action === 'update')
    .map(([, params]) => params.issue_number), [17, 20]);
});

test('API failures surface instead of reporting successful completion', async () => {
  const f = fixture({ body: 'Closes #17' });
  f.github.rest.issues.update = async () => { throw new Error('Permission denied'); };
  await assert.rejects(closeCompletedIssues(f), /Permission denied/);
  assert.deepEqual(f.calls, []);
});
