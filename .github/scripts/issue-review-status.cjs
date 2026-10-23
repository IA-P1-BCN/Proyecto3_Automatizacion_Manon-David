// Same explicit local-reference contract as PR #25; no dependency on that PR.
function completedIssueNumbers(body = '') {
  const numbers = new Set();
  let fence = null;
  for (const line of body.split(/\r?\n/)) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      continue;
    }
    if (fence) continue;
    const match = line.match(/^\s*(?:[-*]\s+)?(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#([1-9]\d*)\s*$/i);
    if (match && Number.isSafeInteger(Number(match[1]))) numbers.add(Number(match[1]));
  }
  return [...numbers];
}

const PROJECT_QUERY = `query ReviewProject($owner: String!, $number: Int!) {
  organization(login: $owner) {
    projectV2(number: $number) {
      id
      field(name: "Status") {
        ... on ProjectV2SingleSelectField { id options { id name } }
      }
    }
  }
}`;

const ITEMS_QUERY = `query ReviewIssueItems($id: ID!, $after: String) {
  node(id: $id) {
    ... on Issue {
      projectItems(first: 100, after: $after) {
        nodes {
          id isArchived project { id }
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue { name }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;

const UPDATE_STATUS = `mutation SetIssueReviewStatus(
  $projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!
) {
  updateProjectV2ItemFieldValue(input: {
    projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
    value: { singleSelectOptionId: $optionId }
  }) { projectV2Item { id } }
}`;

async function findProjectItem(github, issueId, projectId) {
  let after = null;
  do {
    const result = await github.graphql(ITEMS_QUERY, { id: issueId, after });
    const items = result.node?.projectItems;
    if (!items) throw new Error('Cannot read issue project items. Check token access.');
    const item = items.nodes.find((candidate) => candidate.project?.id === projectId);
    if (item) return item;
    if (!items.pageInfo.hasNextPage) return null;
    if (!items.pageInfo.endCursor || items.pageInfo.endCursor === after) {
      throw new Error('Invalid project-item pagination cursor.');
    }
    after = items.pageInfo.endCursor;
  } while (after);
  return null;
}

async function synchronizeReviewStatus({ github, context, core, prNumber }) {
  if (!/^\d+$/.test(String(prNumber)) || !Number.isSafeInteger(Number(prNumber)) || Number(prNumber) < 1) {
    throw new Error('Provide a positive pull request number.');
  }
  const repo = context.repo;
  const expectedRepo = `${repo.owner}/${repo.repo}`;
  if (expectedRepo !== 'IA-P1-BCN/Proyecto3_Automatizacion_Manon-David') {
    throw new Error('This automation is configured only for the Paso Firme repository.');
  }
  // Use live PR data, not a stale event body or a manually supplied issue number.
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: Number(prNumber) });
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'dev' || pr.base.repo.full_name !== expectedRepo) {
    core.info('PR is not an open, ready-for-review PR targeting this repository\'s dev branch; skipped.');
    return;
  }
  const numbers = completedIssueNumbers(pr.body || '');
  if (!numbers.length) {
    core.info('No explicit issue completion directives; nothing to update.');
    return;
  }

  const result = await github.graphql(PROJECT_QUERY, { owner: repo.owner, number: 43 });
  const project = result.organization?.projectV2;
  const field = project?.field;
  const option = field?.options?.find((item) => item.name === 'In Review');
  if (!project?.id || !field?.id || !option) {
    throw new Error('Project #43, its Status field, or its In Review option is missing or inaccessible.');
  }

  const missing = [];
  for (const issue_number of numbers) {
    const { data: issue } = await github.rest.issues.get({ ...repo, issue_number });
    if (issue.pull_request || issue.state !== 'open') {
      core.info(`#${issue_number} is not an open issue; skipped.`);
      continue;
    }
    const item = await findProjectItem(github, issue.node_id, project.id);
    if (!item) {
      core.warning(`#${issue_number} has no readable item in Project #43. Add it to the board and rerun.`);
      missing.push(issue_number);
      continue;
    }
    const status = item.fieldValueByName?.name;
    if (item.isArchived || status === 'Done' || status === 'In Review') {
      core.info(`#${issue_number}: archived, Done, or already In Review; skipped.`);
      continue;
    }
    await github.graphql(UPDATE_STATUS, {
      projectId: project.id, itemId: item.id, fieldId: field.id, optionId: option.id,
    });
    core.info(`Moved #${issue_number} to In Review for PR #${prNumber}.`);
  }
  if (missing.length) {
    throw new Error(`Project synchronization incomplete: add/check project items for ${missing.map((n) => `#${n}`).join(', ')} and rerun.`);
  }
}

module.exports = { completedIssueNumbers, synchronizeReviewStatus };
