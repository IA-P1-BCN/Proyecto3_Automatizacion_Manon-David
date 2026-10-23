# Issue completion after merging into dev

## Scope and ownership

Agent instructions correspond to issue **#17 — Crear Agents.md**, assigned to `davidlafuentem` when checked. The user also requested this supporting merge-to-completion automation; a dedicated issue number for that extension has not been provided. Do not invent one. Creating the AI log belongs to **#18 — Crear Bitacora**, which has its own branch and delivery; PR #25 must close only #17.

The team board is [IA-P1-BCN Project #43](https://github.com/orgs/IA-P1-BCN/projects/43). GitHub's default branch is currently `main`, so native closing keywords alone do not close issues when a PR is merged into `dev`.

## PR contract

Query the current issue title, assignee, description, and acceptance criteria before working. Include its number in the branch name and preserve its exact title in the PR description. When all criteria are satisfied, add a standalone line:

```text
Closes #17
```

Use one completion line per issue. `Fixes #17` and `Resolves #17` are also supported, case-insensitively, with an optional Markdown bullet. For partial work use `Refs #17`; it will not trigger closure. Inline prose, URLs, cross-repository references, blockquotes, and fenced examples are not completion directives for this automation. Do not include example completion lines outside code fences.

## Workflow behavior

`.github/workflows/close-issues-on-dev-merge.yml` handles `pull_request: closed` events targeting `dev`. It runs only for a merged PR, checks out the trusted base SHA, and calls `.github/scripts/close-completed-issues.cjs`. The PR body is handled as data, never interpolated into shell commands or evaluated as code.

For each explicit local completion directive, the script checks that the target is an issue rather than a PR, closes an open issue as completed, and comments with the merged PR URL. Already-closed issues are skipped, including their comments. An API error fails the run visibly; rerunning processes issues still open. If closure succeeds but its comment fails, rerunning skips the closed issue: its comment may be absent, but it will not be duplicated.

The job uses the built-in `GITHUB_TOKEN` with `contents: read`, `pull-requests: read`, and `issues: write`; it does not need an additional secret. The workflow is intended for the teammates' branches in this repository. Fork PRs may have read-only tokens and require a maintainer to complete closure manually. Do not switch to privileged execution of PR-head code to bypass that restriction.

Human review and merge are still required. Approval alone, closing without merge, and PRs targeting other branches do not trigger this automation.

## Installation and Project #43 configuration

1. Obtain permission for commit, push, and PR creation. Ensure `dev` exists remotely before opening a PR targeting it.
2. Review and merge the workflow and its script into `dev`. The initial installation PR may need manual issue closure: its base revision does not yet contain the automation. The workflow must already be in `dev` to process later merges.
3. A board administrator opens Project #43, then its **Workflows** settings.
4. Enable the native **Item closed** workflow and configure the issue's **Status** field to **Done** (verify the actual field and option names in the UI). This requires permission to edit the project; no project token is stored in Actions.
5. Confirm each tracked issue is actually an item in Project #43. The native rule does not add missing items. Add missing issues through the team's normal board process.
6. Test with a real, authorized completed issue: merge its reviewed PR into `dev`, inspect the Actions run, confirm the issue is closed, and verify its card becomes Done.

Project workflow configuration has not been directly verified or changed by the agent. The user completed browser authorization, and the CLI now has `read:project`. Read access to Project #43 was verified, including its `Status` options: `Todo`, `In Progress`, `In Review`, and `Done`. To inspect the board from another local environment, authorize and query it with:

```bash
gh auth refresh --hostname github.com --scopes read:project
gh project view 43 --owner IA-P1-BCN --format json
```

Read access alone does not grant permission to change project automation. Use the board UI with an authorized administrator. Do not mark setup complete until the close-to-Done behavior is observed.

## Local checks

```bash
node --check .github/scripts/close-completed-issues.cjs
node --test .github/scripts/close-completed-issues.test.cjs
```

Tests use mocked GitHub API calls. They cover completion directives, ignored references/examples, deduplication, unmerged PRs, other base branches, already-closed issues, and avoiding PR closure. They do not close real issues or prove the remote board rule is enabled.
