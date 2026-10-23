// Accept explicit completion directives, not incidental issue mentions.
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

async function closeCompletedIssues({ github, context, core }) {
  const pr = context.payload.pull_request;
  if (context.eventName !== 'pull_request' || context.payload.action !== 'closed' ||
      !pr?.merged || pr.base.ref !== 'dev' || pr.base.repo.full_name !== `${context.repo.owner}/${context.repo.repo}`) {
    core.info('No merged pull request targeting this repository\'s dev branch.');
    return;
  }

  for (const issue_number of completedIssueNumbers(pr.body || '')) {
    const params = { ...context.repo, issue_number };
    const { data: issue } = await github.rest.issues.get(params);
    if (issue.pull_request) {
      core.warning(`#${issue_number} is a pull request, not an issue; skipped.`);
      continue;
    }
    if (issue.state === 'closed') {
      core.info(`#${issue_number} is already closed; skipped.`);
      continue;
    }
    await github.rest.issues.update({ ...params, state: 'closed', state_reason: 'completed' });
    await github.rest.issues.createComment({
      ...params,
      body: `Completed by ${pr.html_url}, merged into \`dev\`.`,
    });
    core.info(`Closed #${issue_number} after merging PR #${pr.number}.`);
  }
}

module.exports = { completedIssueNumbers, closeCompletedIssues };
