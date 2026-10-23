# Automatically move linked issues to In Review

## Scope

Implements [#27 — Automatically move linked issues to In Review](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/27), assigned to `davidlafuentem`. Development starts on `feat/27-issue-review-status` from `dev`, independently of PR #25 and the log delivery in PR #26.

`.github/workflows/issue-review-status.yml` updates existing issue cards in [Project #43](https://github.com/orgs/IA-P1-BCN/projects/43) to **In Review** when a non-draft PR targeting `dev` is opened, reopened, marked ready, edited, or updated with a push. It fetches the current PR to avoid acting on stale event state.

Use explicit completion directives, one per line:

```text
Closes #18
```

The parser follows the same contract as PR #25's closing script, but this task includes its own implementation so it does not depend on that unmerged PR. Keep these contracts aligned during future maintenance. `Refs #18`, fenced examples, and cross-repository references are ignored.

The workflow does not close issues, merge PRs, add cards, or undo status changes when a PR is closed, converted to draft, or has a reference removed. It preserves closed issues and archived/Done/already-In-Review cards.

## Credential setup

Repository Actions must be allowed. An authorized teammate must provide a credential with access to the private repository and write access to organization Project #43:

- A classic PAT with `repo` and `project` scopes is one supported option, if allowed by the organization. Authorize organization SSO if required, use an expiration date, and rotate it when needed.
- A GitHub App installation token with appropriate repository read and organization project-write permissions can replace it, but token generation/refresh must be configured separately. Do not paste a short-lived installation token into a permanent secret and assume it will renew itself.

Store the selected credential as repository Actions secret **`PROJECT_AUTOMATION_TOKEN`**, through Settings → Secrets and variables → Actions. Enter its value directly into GitHub, not in chat, workflow JSON, or tracked files. `read:project` on a local CLI session is not project write access and is not automatically passed to Actions. The job's built-in token only checks out repository content.

The user created the credential outside chat and stored it as `PROJECT_AUTOMATION_TOKEN`. The agent verified that the secret name exists through GitHub CLI; its value was not retrieved or displayed. Existence alone does not verify its scopes, expiration, or organization access: these remain subject to the first real run and the repository/organization Actions policies.

## Installation and ordering

Development can proceed before PR #25 merges: the new files have distinct names and no runtime dependency on that PR. The two automations have separate roles:

| Automation | Role |
| --- | --- |
| PR #25 | A PR merged into `dev` closes its completed issues; Project's native rule moves closed cards to Done |
| Issue #27 | An eligible ready PR moves its existing issue cards to In Review |

For secure project-write handling this workflow uses `pull_request_target` and only checks out trusted base code, never the PR head. **GitHub requires its workflow entry on the default branch (`main`) to receive these events.** The default branch remains `main`; merging this task into `dev` alone is not full activation. `workflow_dispatch` also requires a workflow entry on the default branch to be available.

Reference: [GitHub workflow event documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target), including its default-branch context and security guidance.

1. Review and merge this task into `dev` through an explicitly authorized PR. Do not bypass pair review.
2. Through the normal reviewed `dev` → `main` delivery, install the workflow entry on `main`. This is a separate authorized integration action, not an automatic merge performed by the agent.
3. Keep `.github/scripts/issue-review-status.cjs` on `dev`: automatic runs check out the triggering base SHA; manual runs check out `dev`.
4. Configure `PROJECT_AUTOMATION_TOKEN` and confirm the issues are existing Project #43 items.
5. Run a controlled manual synchronization and observe the Actions run and card. Only then mark the integration behavior verified.

Installing the workflow does not replay old events. After installation, synchronize an existing eligible PR from the Actions UI or with:

```bash
gh workflow run issue-review-status.yml --ref dev -f pull_request_number=26
```

That run reads PR #26's current state. If it is already merged, closed, or a draft, it is skipped. Manual synchronization is a real board mutation and requires an authorized setup/test; it was not executed during local development.

## Local checks and remaining work

```bash
node --check .github/scripts/issue-review-status.cjs
node --test .github/scripts/issue-review-status.test.cjs
```

Mocked tests exercise the parser and API behavior without a real project token. Configuration parsing is not an end-to-end GitHub Actions or board test.

At implementation time PRs #25 and #26 were still open. Adding #27 to Project #43 via CLI failed because the local session has only `read:project`, not `project`. Add it through the board UI using an account with project-write permissions. The issue and its assignee were created successfully. The user subsequently configured the Actions secret and authorized commit and push; PR creation, integration, and real board synchronization remain separate pending actions.

## AI activity handoff

This section preserves issue-specific activity until `docs/ai-log.md` from #18 is integrated into `dev`. It does not recreate that file or include #18's delivery in this branch. At integration, append this verified summary to the shared log using its next available entry ID:

- **Date / issue:** 2026-10-23; #27 — Automatically move linked issues to In Review.
- **Tool/model:** OpenCode / `openai/gpt-6.1-sol`; GitHub CLI; Node.js for mocked checks.
- **Prompt:** “por favor, crea esa automatización. ¿podrás crear también la issue, y asignármela, además de crear la rama pertinente? ¿hay algún problema por crear esta automatización antes de mergear la PR25?” The user then authorized implementation with “ejecuta, por favor.”
- **Accepted decisions:** Separate issue and branch from `dev`; ready PR events plus manual synchronization; update issues rather than PR cards; preserve Done and draft behavior; no automatic merge or closure in this task.
- **Correction / implementation constraint:** Secure `pull_request_target` and manual-dispatch activation require the workflow on default `main`, in addition to its trusted script on `dev`. Development before #25 is safe, but installation is not complete after a dev-only merge.
- **Access and setup:** Issue #27 creation/assignment succeeded. Adding its card failed for lack of local `project` scope. The user subsequently created `PROJECT_AUTOMATION_TOKEN`; the agent verified its name exists without reading its value. Effective project-write access remains untested.
- **Verification:** The first 12 mocked tests passed, JavaScript syntax and Ruby YAML parsing passed. Read-only GraphQL queries against the real project confirmed that the implemented metadata and item-selection fields exist; issue #18 was already In Review at inspection time, without a mutation by this task. No real project transition has been executed. Final check results are recorded below.
- **Permissions:** Implementation approval did not authorize Git publication. The user later explicitly authorized commit and push, and confirmed secret creation. PR creation and merge have not been authorized for this task.

### Final local check results

- All 13 mocked Node.js tests passed, including mutation failures and idempotent reruns.
- JavaScript syntax check passed.
- Ruby parsed the workflow YAML and verified the `dev` target and manual trigger; this is not full Actions runtime validation.
- Read-only live GraphQL field/item queries succeeded; no mutation was sent.
- Git confirmed that the current branch is based on `origin/dev` and contains only this task's pending files.
- The repository Actions secret list now contains `PROJECT_AUTOMATION_TOKEN`. Issue #27 still needs its project membership reconciled.
- At this pre-publication checkpoint no commit or push had run for #27. Publication was authorized next; no PR, real workflow run, or board transition is claimed by these local results.
