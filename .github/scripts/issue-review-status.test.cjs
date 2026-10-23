const { test } = require('node:test');
const assert = require('node:assert/strict');
const { completedIssueNumbers, synchronizeReviewStatus } = require('./issue-review-status.cjs');

const repo = { owner: 'IA-P1-BCN', repo: 'Proyecto3_Automatizacion_Manon-David' };

function fixture({ pr = {}, issues = {}, cards = {}, pages = {}, project = undefined } = {}) {
  const mutations = [];
  const reads = [];
  const warnings = [];
  const metadata = project === undefined ? {
    id: 'project43', field: { id: 'status', options: [{ id: 'review', name: 'In Review' }] },
  } : project;
  const github = {
    rest: {
      pulls: { get: async () => ({ data: {
        state: 'open', draft: false, body: 'Closes #18',
        base: { ref: 'dev', repo: { full_name: `${repo.owner}/${repo.repo}` } }, ...pr,
      } }) },
      issues: { get: async ({ issue_number }) => ({ data: {
        node_id: `issue${issue_number}`, state: 'open', ...issues[issue_number],
      } }) },
    },
    graphql: async (query, variables) => {
      reads.push([query, variables]);
      if (query.includes('query ReviewProject')) return { organization: { projectV2: metadata } };
      if (query.includes('query ReviewIssueItems')) {
        if (pages[variables.id]) return pages[variables.id](variables.after);
        const card = cards[variables.id] === undefined ? {
          id: `item-${variables.id}`, project: { id: 'project43' }, isArchived: false,
          fieldValueByName: { name: 'In Progress' },
        } : cards[variables.id];
        return { node: { projectItems: {
          nodes: card ? [card] : [], pageInfo: { hasNextPage: false, endCursor: null },
        } } };
      }
      if (query.includes('mutation SetIssueReviewStatus')) {
        mutations.push(variables);
        return { updateProjectV2ItemFieldValue: { projectV2Item: { id: variables.itemId } } };
      }
      throw new Error('Unexpected GraphQL request');
    },
  };
  return {
    github, context: { repo }, prNumber: '26',
    core: { info() {}, warning(message) { warnings.push(message); } },
    mutations, reads, warnings,
  };
}

test('parses explicit local completion directives, deduplicates, and ignores examples', () => {
  assert.deepEqual(completedIssueNumbers([
    'Closes #18', '- fixes #17', 'Resolves #18', 'Refs #19',
    'Closes other/repo#20', '> Closes #21', 'Example: Closes #22',
    '```text', 'Closes #23', '```', '~~~', 'Closes #24', '~~~',
  ].join('\r\n')), [18, 17]);
});

test('updates the existing issue card with IDs resolved from project metadata', async () => {
  const f = fixture();
  await synchronizeReviewStatus(f);
  assert.deepEqual(f.mutations, [{
    projectId: 'project43', itemId: 'item-issue18', fieldId: 'status', optionId: 'review',
  }]);
});

test('uses live PR state for drafts, closed PRs, and other base branches', async () => {
  for (const pr of [{ draft: true }, { state: 'closed' }, { base: { ref: 'main' } }]) {
    const f = fixture({ pr });
    await synchronizeReviewStatus(f);
    assert.equal(f.reads.length, 0);
    assert.deepEqual(f.mutations, []);
  }
});

test('no completion directives means no project query or mutation', async () => {
  const f = fixture({ pr: { body: 'Refs #18' } });
  await synchronizeReviewStatus(f);
  assert.equal(f.reads.length, 0);
});

test('closed issues and PR references are skipped', async () => {
  const f = fixture({ pr: { body: 'Closes #18\nCloses #25' },
    issues: { 18: { state: 'closed' }, 25: { pull_request: {} } } });
  await synchronizeReviewStatus(f);
  assert.deepEqual(f.mutations, []);
});

test('Done, already-In-Review, and archived cards are preserved', async () => {
  for (const settings of [
    { fieldValueByName: { name: 'Done' } },
    { fieldValueByName: { name: 'In Review' } },
    { isArchived: true },
  ]) {
    const f = fixture({ cards: { issue18: {
      id: 'item18', project: { id: 'project43' }, ...settings,
    } } });
    await synchronizeReviewStatus(f);
    assert.deepEqual(f.mutations, []);
  }
});

test('multiple issues update once each despite duplicate directives', async () => {
  const f = fixture({ pr: { body: 'Closes #18\nCloses #17\nCloses #18' } });
  await synchronizeReviewStatus(f);
  assert.deepEqual(f.mutations.map((m) => m.itemId), ['item-issue18', 'item-issue17']);
});

test('missing project cards report incomplete synchronization without creating items', async () => {
  const f = fixture({ cards: { issue18: null } });
  await assert.rejects(synchronizeReviewStatus(f), /synchronization incomplete.*#18/);
  assert.equal(f.warnings.length, 1);
  assert.deepEqual(f.mutations, []);
});

test('finds memberships beyond the first page', async () => {
  const f = fixture({ pages: { issue18: (after) => ({ node: { projectItems: {
    nodes: after ? [{ id: 'page2item', project: { id: 'project43' } }] : [],
    pageInfo: { hasNextPage: !after, endCursor: after ? null : 'page2' },
  } } }) } });
  await synchronizeReviewStatus(f);
  assert.equal(f.mutations[0].itemId, 'page2item');
  assert.equal(f.reads.filter(([q]) => q.includes('query ReviewIssueItems')).length, 2);
});

test('invalid manual PR numbers are rejected before API access', async () => {
  for (const prNumber of ['0', '-1', '26; anything', '', '9007199254740992']) {
    const f = fixture();
    await assert.rejects(synchronizeReviewStatus({ ...f, prNumber }), /positive pull request/);
    assert.equal(f.reads.length, 0);
  }
});

test('missing project configuration and permission failures fail visibly', async () => {
  for (const project of [null, { id: 'project43', field: null },
    { id: 'project43', field: { id: 'status', options: [] } }]) {
    const f = fixture({ project });
    await assert.rejects(synchronizeReviewStatus(f), /missing or inaccessible/);
    assert.deepEqual(f.mutations, []);
  }
  const f = fixture();
  f.github.graphql = async () => { throw new Error('Permission denied'); };
  await assert.rejects(synchronizeReviewStatus(f), /Permission denied/);
});

test('rerunning against the resulting status does not repeat a mutation', async () => {
  const card = { id: 'item18', project: { id: 'project43' }, fieldValueByName: { name: 'Todo' } };
  const f = fixture({ cards: { issue18: card } });
  await synchronizeReviewStatus(f);
  card.fieldValueByName.name = 'In Review';
  await synchronizeReviewStatus(f);
  assert.equal(f.mutations.length, 1);
});

test('mutation failures propagate and never report success', async () => {
  const f = fixture();
  const original = f.github.graphql;
  f.github.graphql = async (query, variables) => {
    if (query.includes('mutation SetIssueReviewStatus')) throw new Error('Project write denied');
    return original(query, variables);
  };
  await assert.rejects(synchronizeReviewStatus(f), /Project write denied/);
  assert.deepEqual(f.mutations, []);
});
