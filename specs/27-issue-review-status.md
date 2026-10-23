# Issue #27 — Automatically move linked issues to In Review

- **Issue:** https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/27
- **Assignee:** `davidlafuentem`
- **Branch:** `feat/27-issue-review-status`, from `dev`

## Domain and contract

A repository Issue has a number, title, assignee, state, and zero or more Project items. A PullRequest has a base branch, open/closed state, draft flag, and explicit completion references in its description. An existing Project #43 item has a Status field. This task changes only that item's Status; it does not change business records, issue state, or PR review/merge state.

## Triggers and inputs

- `pull_request_target` targeting `dev`: opened, reopened, ready_for_review, edited, synchronize.
- Manual dispatch with a positive `pull_request_number`, for existing PRs such as #25 and #26.
- Live PR metadata is fetched again for both trigger paths.
- Explicit standalone local directives `Closes #N`, `Fixes #N`, or `Resolves #N` identify completed issues; optional bullets and case variants are accepted. One directive per line. Partial `Refs`, external URLs/repository references, prose examples, and fenced code are ignored.

## Output and rules

1. Only open, non-draft PRs targeting this repository's `dev` are eligible.
2. Process distinct explicit issue references, never PR-number objects or closed issues.
3. Locate the existing Project #43 item, including pagination of issue project memberships.
4. Move it to the project's exact `In Review` option using IDs resolved at runtime.
5. Preserve archived, Done, and already-In-Review items. Never silently create missing cards.
6. Do not close issues, merge PRs, or revert removed references to another status.
7. Repeated runs must avoid unnecessary status mutations.

## Error cases

- Missing `PROJECT_AUTOMATION_TOKEN`: fail visibly before executing the script.
- Invalid manual PR input: fail without project mutation.
- Missing project/field/option or API permission failure: fail visibly; do not report success.
- Missing readable project membership: warn, continue other items, then fail with a reconciliation list.
- Mutation/API failure: propagate failure. Rerun safely; already-In-Review items are skipped.

## Security and setup

Use a project-write credential in an Actions secret, never in source or PR text. Do not execute PR-head code: checkout is pinned to the trusted base SHA for automatic runs and to `dev` for manual runs. Treat descriptions as data and pass PR numbers through an environment variable. Installation requires the workflow entry on the default branch (`main`) and the script on `dev`; see the operational guide. No secret or project-write permission has been provisioned by this implementation.

## Acceptance checks

- Ready eligible PRs update existing open issue cards.
- Draft, closed, other-target, partial-reference, and example cases cause no mutation.
- Multiple issues, deduplication, repeated runs, pagination, closed issues, Done/archived cards, and inaccessible/missing configuration are covered by mocked tests.
- Manual synchronization fetches the current PR state and references.
- Static/mocked verification is not a claim of actual board changes. A controlled real run remains required after installation and credential setup.
