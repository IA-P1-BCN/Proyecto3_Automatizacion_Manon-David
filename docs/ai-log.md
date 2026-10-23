# AI Assistance Log

## Purpose and ownership

This is the project-wide record of meaningful AI assistance: tools and models, important prompts, accepted and rejected proposals, agent errors, corrections, and verification evidence.

- **Creation issue:** [#18 — Crear Bitacora](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/18).
- **Assigned teammate:** `davidlafuentem`, verified against GitHub on 2026-10-23.
- **Creation branch:** `docs/18-ai-log`, based on `dev`.
- **Sources:** `README.md`, the application guide, this conversation, Git history, and the GitHub issue/PR metadata actually inspected.

Creating this log is a separate delivery from #17 — Crear Agents.md. Future entries belong in the branch of the task they describe; they do not require reopening #18. This log is a maintained artifact, not a claim that every workflow has been implemented.

## Agent-driven maintenance rules

The agent working on an issue maintains this file as part of that issue. The agent-guidelines delivery in PR #25 already requires recording tools/models, key prompts, decisions, and corrected errors here. Apply the following procedure alongside that rule once the deliveries are integrated:

1. **At task start:** Read the current log and actual issue metadata. Identify the tool/model only when known. Do not treat historical decisions as current permissions.
2. **When meaningful context changes:** Record a prompt or decision that changes scope, architecture, business behavior, permissions, or implementation. Do not log every conversational turn or routine command.
3. **At the next working checkpoint:** Append or update the current task entry with the accepted/rejected suggestion, reason, and any agent mistake and correction. Do this without requiring the user to request a log update separately.
4. **After verification:** Record the checks actually performed, their results, and available evidence. Distinguish static checks, mocked tests, local integration tests, and real remote execution.
5. **Before requesting Git permission or handing off:** Check that the entry reflects the latest work and lists unresolved items. Include its changes in the reviewable diff for that task. Recording an action as completed must follow the action, not precede it.
6. **After an authorized publication or review action:** Add its commit/PR link when useful. If recording it creates another local change, disclose that change; do not create a follow-up commit or push without permission.
7. **When another teammate has updated the log:** Preserve their entries. Resolve overlapping edits by retaining both sets of facts rather than replacing the file with a local copy.

This is agent-assisted maintenance, not a background recorder. It operates while an agent is working with the repository and available conversation context. No CLI hook, conversation export, scheduled job, or external logging service has been installed. It cannot capture activity performed outside that context automatically. A teammate can add missing, verified context using the template below.

### Accuracy, language, and privacy

- Write technical summaries in English. Exact quoted user prompts may remain in their original language; label paraphrases as summaries.
- Use stable entry IDs so later corrections can refer to a specific entry. Dates use `Europe/Madrid` when the date is known; say that an exact date is unverified rather than inventing one.
- Keep historical facts and add explicit updates when their status changes. Correct inaccurate statements transparently.
- Never log secrets, OAuth tokens, one-time authorization codes, real customer data, or full bank emails. Use sanitized summaries and links to safe fixtures.
- Log actual activity only. A selected provider is not a tested model; validation is not proof of an executed integration.
- Log maintenance never grants permission to commit, push, open a PR, publish a workflow, or modify the supplied application.

## Tools and models

| Tool / model | Observed role | Verification boundary |
| --- | --- | --- |
| OpenCode / `openai/gpt-6.1-sol` | Requirements analysis, documentation, GitHub automation implementation, review, and corrections in this conversation | Model identity is supplied by the agent harness; no comparative model benchmark performed |
| Git and GitHub CLI | Inspect issues/PRs/Project metadata; perform explicitly authorized publication | GitHub CLI access is not a workflow execution test |
| Node.js | Syntax check and seven mocked tests for the issue-closing script in PR #25 | No real issues were closed by those tests |
| Ruby YAML parser | Parse the GitHub Actions YAML in PR #25 | Not full `actionlint` validation |
| Groq | Agreed provider for AI extraction inside future n8n workflows | Exact model not selected or tested in this work |
| n8n-mcp | Planned assistance for each teammate's independent local n8n | No connection or MCP-based workflow test verified here |

## Entries

### AI-001 — Requirements and agent guidelines

- **Date:** 2026-10-22. The initial delivery commit and PR are dated that day; individual conversational steps have no separately verified timestamps.
- **Related issue / PR:** [#17 — Crear Agents.md](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/17), [PR #25](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/pull/25).
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`.
- **Prompt excerpts:** “Lee y entiende los requerimientos de siguiente proyecto”; “Necesito crear el agents.md con tu ayuda”; “para commit, push y PR, debes pedir permiso.”
- **Accepted suggestions and reasons:** Essential first, then medium; a branch per assigned issue from `dev`; independent local environments; Gmail, Google Sheets, and Groq; JSON in Git with manual import/export and optional MCP assistance. These choices align the work with the assignment and the team's preferred collaboration model.
- **Rejected suggestions and reasons:** A shared n8n environment was discussed and declined by the user. Automatic commit/push/PR permission was rejected: autonomy covers branch and implementation work, not those operations.
- **Agent errors and corrections:** The agent initially interpreted autonomy as permission to commit, push, and open PRs. The user clarified the boundary, which was recorded explicitly in `AGENTS.md`.
- **Verification and evidence:** Read the assignment, API guide, sample CSVs, and nine-email fixture directory. Consulted actual issue metadata and identified #17 and its assignee. Initial delivery commit: `8e255e2`; technical documentation and branch names use English, while customer/shop messages target Spanish for Spain.
- **Remaining work at handoff:** PR review and integration; actual Gmail account/OAuth setup, Groq model selection, and local MCP configuration were not verified during this work.

### AI-002 — Issue completion and Project #43

- **Date:** Prepared with the 2026-10-22 delivery. Exact timestamps of the individual access checks are not independently verified here.
- **Related issue / PR:** Supporting automation requested during #17; delivered in [PR #25](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/pull/25). No separate issue number was supplied for this extension.
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`, GitHub CLI, Node.js, and Ruby.
- **Prompt excerpts:** “Debe tener en cuenta los nombres de la issues ya creadas y asignadas, y su número identificativo”; “queremos preparar la automatización para fusionar en dev y pasar entonces a done”.
- **Accepted suggestions and reasons:** Preserve original issue titles, put issue numbers in branches, and use explicit `Closes #N` lines for completed work. Close issues only after a reviewed PR is merged into `dev`; use the native Project `Item closed` rule for Done. This handles integration into a non-default branch without putting a project-access secret in Actions.
- **Rejected / deferred suggestions:** Approval alone does not close an issue. Automatic issue movement to In Review was discussed later but not implemented; it needs a separately scoped configuration and appropriate write access.
- **Agent errors and corrections:** An initial GitHub authorization command lacked a hostname in the noninteractive environment; retrying with `--hostname github.com` reached browser authorization. The first attempt then timed out. The user subsequently completed authorization, and `read:project` access was verified.
- **Verification and evidence:** Seven mocked Node.js tests passed; JavaScript syntax, YAML parsing, and whitespace checks passed. Project #43 was readable and had Status options `Todo`, `In Progress`, `In Review`, and `Done`. Full `actionlint` validation was unavailable. No end-to-end issue closure or board transition was executed.
- **Remaining work at handoff:** Install the workflow through human-reviewed integration. The native Project workflow settings cannot be independently inspected through the commands used here. Approval requirements must be enforced separately with branch protection. The installation PR may require manual issue closure.

### AI-003 — Publication and PR #25

- **Date:** PR #25 was created on 2026-10-22, verified from GitHub metadata.
- **Related issue / PR:** #17 — Crear Agents.md; [PR #25](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/pull/25).
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`, Git, and GitHub CLI.
- **Prompt excerpts:** “Vamos a crear la rama en dev, de la tarea de crear el agents.md. Luego haremos push”; “crea la pr, por favor.”
- **Accepted suggestions and reasons:** Obtain explicit permission for the commit, pushes, and PR; publish `dev` from the initial `main`, then publish the issue branch; request review from `ManonChab`.
- **Rejected / deferred suggestions:** No autonomous merge. Branch publication and PR creation do not imply approval or completion.
- **Agent errors and corrections:** The first issue-branch push failed because its GitHub Actions file required the `workflow` scope. Even after authorization, Git used a different credential without that scope. The agent retried using GitHub CLI's credential helper for that command only, and the push succeeded without changing persistent Git configuration.
- **Verification and evidence:** Commit `8e255e2` was published on `docs/17-agent-guidelines`; `dev` was published separately. PR #25 targets `dev`, requests human review, and includes `Closes #17`.
- **Remaining work at handoff:** PR review and merge. Authorization tokens and device codes are deliberately omitted from this log.

### AI-004 — Separate the AI log into issue #18

- **Date:** 2026-10-23, verified from corrective commit `1567702`.
- **Related issue / PR:** [#18 — Crear Bitacora](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/18); scope correction in PR #25 for #17.
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`, Git, and GitHub CLI.
- **Prompt excerpt:** “Vamos a hacer la 2 opción, porque nunca se pidió que se incluyera en la pr25 la creación de una bitacora. por tanto primero hay que arreglar la pr25, y luego crear la rama para hacer la issue 18.”
- **Accepted suggestions and reasons:** Keep one issue per delivery. Preserve the existing notes, remove the log from #17, and create `docs/18-ai-log` from `dev` for the log's own delivery.
- **Rejected suggestions and reasons:** Completing both #17 and #18 through PR #25 was rejected because the log's creation was not requested as part of that PR.
- **Agent errors and corrections:** The agent had created the AI log in #17's branch despite #18 being a separate task. Corrective commit `1567702` removed it from PR #25, adjusted the scope documentation, and preserved published history. Its PR description was also corrected.
- **Verification and evidence:** Compared the preserved file's Git object hash with the original and confirmed identical content. Confirmed that #18's branch starts at `dev`, PR #25 no longer lists `docs/ai-log.md`, and #18 remains open. The log was preserved as an untracked file in a separate local worktree, without publishing it.
- **Remaining work at handoff:** Review and deliver the log through its own authorized commit, push, and PR; do not close #18 before that delivery is integrated.

### AI-005 — Review and maintain the log

- **Date:** 2026-10-23 (current review session).
- **Related issue / PR:** #18 — Crear Bitacora; no PR created for this issue at this checkpoint.
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`, Git, and GitHub CLI.
- **Prompt excerpts:** “revisemos el borrador de la 18”; “ejecuta, me gusta la organización y que se automatice su autorelleno cada vez que vamos añadiendo prompts y decisiones”.
- **Accepted suggestions and reasons:** Organize the log into purpose, maintenance rules, tool/model inventory, evidence-based entries, and a reusable template. Have the active agent update meaningful context at working checkpoints without a separate reminder from the user.
- **Rejected / deferred suggestions:** No blanket conversation capture, secret collection, or invented historical prompts. No background recorder has been installed; agent-driven updates depend on the context available to the active agent.
- **Agent errors and corrections:** The preserved draft mixed historical permission states with current pending work and omitted later corrections. This revision labels historical checkpoints, links actual issues/PRs, and distinguishes verified dates from uncertain conversational timestamps.
- **Verification and evidence:** Re-read the draft, queried #18's title/assignee/open state, and checked PR #25's metadata and commits. Reviewed the revised Markdown and ran a whitespace check without reported errors. Confirmed that `docs/18-ai-log` still starts at `origin/dev` and its only pending file is this log; the #17 working directory is clean. No application tests or background-capture tests apply to this documentation-only change.
- **Permission update:** After reviewing the proposed organization, the user explicitly authorized the commit and push of `docs/18-ai-log`, then requested execution. This permission does not include PR creation or merging.
- **Remaining work at handoff:** Execute the authorized commit and push, then request permission for a PR targeting `dev`. Integration of #17 and #18 is needed for the shared repository to contain both the agent instructions and the maintained log.

### AI-006 — Post-PR review and convention alignment

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** none yet (documentation sync after PRs #24, #25, #26 and #28); branch `docs/sync-conventions`, from `dev` with `main` merged in.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "review project after PRs"; then decisions on PR target, branch names, Groq, nine emails and English PR/commit text; "fix the docs".
- **Accepted suggestions and reasons:** One convention for both agents: PRs target `dev`, branches `feat|docs|fix/<issue#>-…`, Groq inside flows, nine test emails, English commits and PRs. Issue-to-flow mapping recorded in `docs/decisions-clarify.md`. Transfers registered as `bizum` copied into `AGENTS.md`, which still listed the mapping as unresolved.
- **Rejected / deferred suggestions and reasons:** The assignment `README.md` was left unchanged (it still says eight emails and lists OpenRouter as an example), per the rule not to rewrite the supplied Spanish text. The event router has no GitHub issue yet; none was created.
- **Agent errors and corrections:** A first review pass read `origin/main` only and missed that `dev` held the new automation; corrected by comparing both branches. The first edit script ignored CRLF line endings and was fixed before any file was left half-edited.
- **Verification and evidence:** Ran the 20 mocked tests of the `.github/scripts` automation (pass; they do not prove real board changes). Grepped for leftover `OpenRouter`, `flow-<name>` and "8 emails"; only intentional history notes remain. No n8n flow was run.
- **Remaining work at handoff:** Review, commit, push and PR are pending the user's permission. Create an issue for the event router. Provision `PROJECT_AUTOMATION_TOKEN` and move the status workflow to `main`.

### AI-007 — Flow 08 Error Workflow skeleton and test flow (#5)

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** [#5 — HU-05 · Avisos de errores](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/5); branch `feat/5-error-workflow`; no PR yet.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "are we ready to start on HU-05?", "we will not pay anything in n8n... check that", "go ahead", "build the flow 08 skeleton", "go for it" (test flow).
- **Accepted suggestions and reasons:** n8n Variables are paid, so the shop address is a plain environment variable read as `$env.TIENDA_EMAIL_AVISOS`, with `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. The host port is `${TIENDA_PORT:-8000}` so each teammate sets it in their own `.env`. Sanitiser developed as tested code (12 unit tests) and embedded in the exported JSON by a generator, so source and flow cannot drift. SMTP (the team's mailbox) replaces Gmail for sending.
- **Rejected / deferred suggestions and reasons:** Exact-value masking of `API_KEY` skipped (n8n does not hold the app key; pattern masking covers headers and key=value pairs). README credential list (task 5.1) deferred because the README is the supplied assignment.
- **Agent errors and corrections:** `docker compose up` was run without the project name of the running stack (`paso-firme`) and created a second stack; the stray containers and network were removed and the stack recreated with `-p paso-firme`, keeping the data volumes. Two empty volumes remain. A first edit script ignored CRLF line endings and failed before changes were left half-applied. The user pasted a mailbox password in the chat; it was not written to any file, and rotating it was advised.
- **Verification and evidence:** 12 unit tests pass; both JSON files parse and import in a throwaway n8n container; `$env` access verified in a Code node and an expression there. In the user's n8n the five error scenarios were reported as passing; see `docs/evidence/08-error-workflow/README.md`. Scenario 6 was dropped by the team; timing and screenshots are still pending.
- **Remaining work at handoff:** record timing and screenshots (scenario 6 was dropped by the team); PR into `dev`. Update: David confirmed the switch to the Infomaniak mailbox and the Gmail wording was replaced in `AGENTS.md`, the specs, the decisions and the OpenSpec changes.

### AI-008 — Event router and failing-handler tests (#32)

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** [#32 — Event router (single webhook, routes app events to flows 01 and 02)](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/32), [PR #33](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/pull/33).
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "start on the event router issue #32 / explain this issue better"; "always make tasks visible in the kanban issues"; "when suggesting payloads, always give me the cmd to put in powershell"; "generate the failing stub".
- **Accepted suggestions and reasons:** Router plus sub-workflow handlers so each teammate owns separate files; webhook answers immediately and handlers are not awaited; unhandled events end successfully while a missing event name throws. Task checklists mirrored into every issue with `scripts/sync_issue_tasks.py`.
- **Rejected / deferred suggestions and reasons:** Strict input schema on the stub triggers deferred, so a new app field would not be rejected.
- **Agent errors and corrections:** "Stub" was used without explanation and was read as the Spanish "vale"; it was then explained as a placeholder handler. A shell `sed` edit corrupted the flow 08 generator and was redone with a proper edit. The flow 08 generator embedded CRLF on Windows checkouts and was fixed to normalise line endings.
- **Verification and evidence:** Clean n8n container: seven payloads routed as expected and a failing handler did not block the next event. Team n8n (reported): payloads, real app events, malformed-event alerts, failing handler. Finding: only a handler's own Error Workflow setting fires for its failure (alert absent with router-only, present once set on the handler). Details in `workflows/tests/00-event-router.md`.
- **Remaining work at handoff:** export and docs tasks (4.1 to 4.3) and review of PR #33.

## Entry template

Copy this template for the next meaningful unit of work. Replace all placeholders and omit empty optional fields. Use the next unused ID; do not renumber existing entries.

```markdown
### AI-NNN — Short task description

- **Date:** YYYY-MM-DD (Europe/Madrid), or state that the exact date is unverified.
- **Related issue / PR:** #N — Exact existing title; link the PR when available.
- **Tool and model:** Actual tool/model used; state unknown or untested when appropriate.
- **Prompt / request:** Sanitized exact excerpt, or a clearly labelled summary.
- **Accepted suggestions and reasons:** What was adopted and why.
- **Rejected / deferred suggestions and reasons:** What was declined or postponed and why.
- **Agent errors and corrections:** Actual mistake, impact, and correction, if any.
- **Verification and evidence:** Checks actually run, results, safe links, and limits.
- **Remaining work at handoff:** Pending decisions, blockers, or next authorized action.
```
