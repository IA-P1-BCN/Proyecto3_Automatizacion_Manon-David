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

### AI-009 — Local Docker ports for HU-04 preparation

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** #4 — HU-04 · Cierre de caja automático; branch `feat/4-daily-close` from updated `origin/dev`. No PR for this task yet.
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`.
- **Prompt / request:** “haz los cambios para que dependan de las variables en .env, y crea una rama para issue HU-04 con los cambios”.
- **Accepted decisions and reasons:** Keep browser ports in each teammate's ignored `.env` so Git updates do not replace local preferences. Reuse `TIENDA_PORT` already integrated by Manon and add `N8N_PORT_HOST`; internal service ports stay 8000 and 5678. Preserve the merged HU-05 environment configuration.
- **Agent errors and corrections:** The earlier local Compose edit used fixed host ports on the #27 working tree. Removed only that edit before creating #4's branch from current `origin/dev`, then implemented the requested parameterization in the proper branch.
- **Verification and evidence:** Confirmed #4 is open and assigned to `davidlafuentem`, and `.env` is ignored by Git. Prior fixed mappings returned HTTP 200 for both services. Compose resolution and HTTP checks for the parameterized setup are verified at handoff; no financial workflow execution is claimed.
- **Remaining work at handoff:** Implement and test HU-04 separately after its specification review. This environment preparation is not completion of HU-04. Commit, push, and PR require permission. The earlier personal-kit conversation remains excluded from this log.

### AI-010 — HU-04 kDrive CSV implementation and local verification

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** #4 — HU-04 · Cierre de caja automático; `feat/4-daily-close`, no PR yet.
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`; Node.js tests; isolated Docker n8n import; Infomaniak developer documentation.
- **Prompt excerpts:** “comienza, ejecuta la creación del flujo que cree ese fichero, y en el que se vaya generando el cierre (todo lo necesario para la hu-04)”; “los separadores de columna que sean \";\" para que no se confundan con los decimales.”
- **Accepted decisions and reasons:** Replace Google Sheets with the free-account kDrive API; history is `basedatos.csv`, created once and replaced by the same file ID. Use semicolons, decimal commas and UTF-8 BOM. Recalculate one date without duplicate rows; manual email is opt-in. Keep unrelated files untouched. Schedule remains 23:55 Madrid; later same-date transactions require a manual rerun, correcting the old spec's inaccurate next-day claim.
- **Connection context:** User confirmed SMTP works after local sender/recipient configuration. A drive-scoped token was created in n8n; the user reported successful drive listing after adding the required account_id. No token was copied into repository files. WebDAV is not assumed available on the free plan. A previous overly broad token was discouraged; no claim is made about its revocation.
- **Implementation:** Generated inactive `workflows/05-daily-close.json` with schedule/manual inputs, complete-array API reads, cent arithmetic, optional Spanish SMTP, paginated history discovery, strict CSV upsert and ETag-protected upload. Separate tested source and generator follow the existing flow 08 pattern. Configured non-secret destination IDs only in the ignored `.env`, passed through Compose; exports contain no actual account/Drive/folder IDs or credential associations.
- **Agent errors and corrections:** OpenSpec CLI was unavailable, so its existing artifacts were updated directly and no CLI validation is claimed. First disposable import required an explicit workflow ID; the generator now provides a stable non-secret ID and the second import succeeded. Initial generated-Code syntax test used a synchronous Function parser, which incorrectly rejected valid async binary preparation; corrected the harness to AsyncFunction and added execution tests for the embedded create/update/result stages.
- **Verification and evidence:** 15 HU-04 unit/embedded-code tests and 12 unchanged HU-05 tests passed. Export imported successfully into an isolated disposable n8n container with no network access or user volumes. Read-only local API records for 2026-10-23, 2026-10-22 and 2026-10-21 were independently summed using Python Decimal and matched the shared calculation source (21365, 27390 and 5690 combined cents). No customer data or API key was printed. Compose destination values resolved correctly and were applied without deleting volumes. See `docs/evidence/05-daily-close/README.md`, `workflows/tests/05-daily-close.md` and `docs/daily-close-setup.md`; live n8n/cloud tests are pending.
- **Remaining work at handoff:** Import in the user's n8n, associate shop Header Auth, kDrive Header Auth (`token_n8n`) and SMTP, select the local flow 08 reference, run first creation and same-ID replacement against kDrive, compare three app dates, capture evidence and test schedule/error delivery with explicit publication permission. No actual cloud file, financial records, new email or live n8n workflow was created by this implementation. Commit/push/PR and issue-checklist synchronization require permission; the GitHub issue's older Sheets checklist has not been silently edited.

### AI-011 — Manual integration feedback and HU-04 review publication

- **Date:** 2026-10-24 (Europe/Madrid); manual feedback includes the preceding evening.
- **Related issue / PR:** #4 — HU-04 · Cierre de caja automático; `feat/4-daily-close`. The requested review PR targets `dev` with Manon as reviewer; its final URL is reported at publication time.
- **Tool and model:** OpenCode / `openai/gpt-6.1-sol`; Node.js and GitHub CLI.
- **Prompt / request:** User confirmed successful SMTP, kDrive creation, second-date update and repeated dates without duplicate lines, then requested “publica la issue, haz commit y pr para Manon” and “ejecuta”. This authorizes the delivery commit, push, issue checklist synchronization and PR; not merge or a claim of full acceptance.
- **Agent error and correction:** Actual n8n text download output contains CSV under `data`; the generated update originally read `body`. The user corrected the live workflow manually. Repository generator and regression tests now consistently use `data` for this text response; JSON HTTP responses still use `body`. The user's exported workflow retained that correction.
- **Export preparation:** Preserved an exact copy of the manual export outside Git before regenerating a credential-free inactive export. Restored safe manual defaults (today, no email), explicit Madrid workflow timezone and pagination limits. Removed local credential references/metadata through the generator; no changes were made to the live n8n workflow or cloud file.
- **Verification:** 29 local tests passed (17 HU-04 and 12 unchanged HU-05). Prior read-only API comparisons and disposable import are documented separately. Reported manual results are distinguished from agent-executed tests in `docs/evidence/05-daily-close/README.md`.
- **Pending acceptance:** Real empty-day and output-failure tests, automatic Error Workflow dispatch, scheduled execution and same-file-ID confirmation remain unverified. User requested insertion-order rows after observing ascending-date sorting; that change is explicitly listed as pending, not silently treated as complete. The review PR uses `Refs #4`, not `Closes #4`, so its merge must not automatically close an incomplete issue.
- **Exclusion:** Personal kit configuration/sharing discussions remain outside this project log; no contents from those discussions are included in this entry.
### AI-009 — Flow 02 Deposit Receipt (#2)

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** [#2 — HU-02 · Recibo de cada abono](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/2); PR not opened yet.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "pick the next HU to my name, which is HU 2"; `/opsx:apply add-deposit-receipt`; "all tests done and successfull, you can go ahead and tick"; "3.1: I have exported it, use this one".
- **Accepted suggestions and reasons:** The formatting and message texts live in a tested Code node source (`workflows/code/02-format-receipt.js`, 8 unit tests) so the flow never recalculates the app's figures. The exported flow is committed as the deliverable, stripped of credential references, the flow 08 ID, the instance ID and the flow ID. The sync script now reads issue #2's tasks from the working copy while the branch is open.
- **Rejected / deferred suggestions and reasons:** Extracting a formatting sub-workflow shared with flow 01 deferred (design decision 2). Importing the flow into the team's n8n was done by Manon, not by the agent.
- **Agent errors and corrections:** The agent first created the branch for HU-01 instead of HU-02 and deleted it (no commits lost). `scripts/sync_issue_tasks.py` read issue #2's tasks from `origin/dev`, so the first tick was not mirrored; fixed by reading the working copy. The agent's formatting printed "talla null" for a reservation without a size; the evidence screenshots exposed it and it was fixed with a unit test (test 9), so the committed Code node is newer than the one in the n8n tested by Manon until she pastes it. The generated JSON differs from the n8n export only in node IDs and positions, so `workflows/code/build-02-deposit-receipt.js` is a reference, not the source of the committed file.
- **Verification and evidence:** Unit tests of the Code node pass. Manon reported on the team's n8n: receipts for a partial and a final deposit, the shop alert for an empty email and for an email without `@`, successful executions, deposits from the app screen and the API, two deposits in a row, and flow 08's alert after breaking the SMTP credential. Details in `workflows/tests/02-deposit-receipt.md`. Not run by the agent: any n8n execution.
- **Remaining work at handoff:** screenshots in `docs/evidence/02-deposit-receipt/`, the README text from `docs/README-changes.md`, opening the PR to `dev` with `Closes #2`, and David's review.

### AI-010 — Flow 01 Reservation Confirmation (#1)

- **Date:** 2026-10-23 (Europe/Madrid).
- **Related issue / PR:** [#1 — HU-01 · Confirmación al apartar](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/1); PR not opened yet.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "pull dev and let's start HU 1"; `/opsx:apply add-reservation-confirmation`; Manon pasted the PowerShell test payloads back to run them; "also test with [a test inbox]"; "all 4 emails arrived and look right, tick the tasks"; "2.2 / successfull"; "2.3: I will not break the SMTP, don't ask again"; "3.1 3.3, go ahead".
- **Accepted suggestions and reasons:** The formatting and message texts live in a tested Code node source (`workflows/code/01-format-confirmation.js`, 9 unit tests), modelled on flow 02, so the flow never recalculates the app's figures. The committed flow is the n8n export stripped of credential references, the flow 08 ID and instance data; its Code node is identical to the repo source.
- **Rejected / deferred suggestions and reasons:** Task 2.3 (breaking the SMTP credential on purpose) was declined by Manon and is left unticked; execution 44 showed flow 08 alerting after a real SMTP rejection, but that is not the specified test. Shared formatting sub-workflow with flow 02 stays deferred.
- **Agent errors and corrections:** A shell heredoc containing the Spanish text failed on Windows and the files were rewritten with the Write tool. The first PowerShell loop got a 422 on payload 1 that was not explained; re-sending the same payload worked. The first run used the placeholder `example.com` address, which rejects mail (nullMX), so flow 01 failed and flow 08 alerted; real tests used a test inbox. The generated JSON differs from the n8n export in node IDs and positions, so `workflows/code/build-01-reservation-confirmation.js` is a reference, not the source of the committed file.
- **Verification and evidence:** Unit tests pass. The agent sent the payloads through the router on the team's n8n: payloads 1 to 4 gave four successful flow 01 executions and four emails that Manon confirmed arrived with the right content; payloads 5 and 6 (no email, email without `@`) gave successful executions and Manon confirmed the shop alerts; payload 8 (no `precio`) failed flow 01 and ran flow 08. Details in `workflows/tests/01-reservation-confirmation.md`. The agent cannot read inboxes.
- **Remaining work at handoff:** opening the PR to `dev` with `Closes #1` and David's review.

### AI-012 — Flow 04 Large Sale Alert (#9)

- **Date:** 2026-10-25 (Europe/Madrid).
- **Related issue / PR:** [#9 — HU-09 · Aviso de ventas grandes](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/9); PR not opened yet.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "let's start HU-9. as the latest PR has not been accepted yet, maybe pull that branch in local"; "yes go ahead, keep in mind PR has not been accepted yet"; "keep the Code node, continue with 2.2"; "yes, go ahead with 3.1 and 3.2"; "write the sample payloads for 4.1"; "confirm everything, draft 5.2".
- **Accepted suggestions and reasons:** The threshold is read from the plain environment variable `TIENDA_UMBRAL_VENTA_GRANDE`, and the parsing, validation and Spanish formatting live in a tested Code node source (`workflows/code/04-format-alert.js`, 6 unit tests) with the comparison in an IF node, modelled on flow 02. An empty or invalid threshold fails the run so flow 08 alerts, instead of defaulting. The router gets one new Switch output and one Execute Workflow node; the `event-routing` spec of `add-event-router` was updated so `venta.registrada` is routed.
- **Rejected / deferred suggestions and reasons:** A flow built only from IF and Set nodes (no Code node) was offered after Manon questioned writing code; Manon chose to keep the Code node because the brief allows it "cuando sea necesario".
- **Agent errors and corrections:** The agent started with the Code node pattern of flow 02 without asking whether this flow needed one; Manon questioned it and the brief was checked (it allows Code nodes). The first test payload 11 for "other events" was an incomplete deposit event, so flow 02 failed and flow 08 alerted; the payload in the test file was replaced by a full one. A plain `docker compose up -d` created a second, empty stack and failed on port 5678 because the team's stack runs under the project name `paso-firme`; the fix was `docker compose down` for the stray stack and `docker compose -p paso-firme up -d`. Two PowerShell test runs failed because the `$url` line was missing or pasted with angle brackets. The router generator briefly rewrote the three stub JSON files with different line endings; they were restored.
- **Verification and evidence:** 6 unit tests pass. Manon reported on the team's n8n, through the router webhook: sales of 189,50 € and 150,01 € each produced one alert email, a sale equal to or below the threshold produced none, a sale without `importe` or with `importe` as text failed flow 04 and flow 08 alerted, and an `abono.registrado` event did not run flow 04. Manon also confirmed the remaining checks of tasks 2.3, 3.1, 3.2, 4.2 and 4.3 as passed. Details in `workflows/tests/04-large-sale-alert.md`. The agent ran no n8n execution and cannot read inboxes.
- **Remaining work at handoff:** the PR to `dev` with `Closes #9` and David's review (task 5.3). A clean `docker compose up -d` from an empty volume was not run, to keep Manon's flows; the committed flow JSONs are the generated files and contain no credentials, `localhost` or addresses.

### AI-014 — Flow 06 Due Date Reminders (#6)

- **Date:** 2026-10-26 (Europe/Madrid).
- **Related issue / PR:** [#6 — HU-06 · Recordatorios de vencimiento](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/6); branch `feat/6-due-reminders`; PR not opened yet.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "what HU should we focus on next"; "propose HU-06 with /opsx:propose"; "/opsx:apply"; "3.2 and 3.3 OK, tested, works"; "1.1 . David confirms"; "4.2 - 4.6. confirmed"; "yes" (README text and this entry).
- **Accepted suggestions and reasons:** The sent-record lives in `avisos.csv` in the kDrive folder of HU-04, as a separate file (Manon chose it over n8n static data and over no record: it survives restarts and Marisa can open it). Emails are sent directly, like flows 01 and 02, with no shared sub-workflow (Manon chose it over extracting one now). The decision logic, text and CSV rules are a tested Code node source (`workflows/code/06-due-reminders.js`, 24 unit tests); the JSON is generated.
- **Rejected / deferred suggestions and reasons:** A catch-up rule ("7 days or fewer and not yet reminded") was left out because it changes what the assignment's "7 days" means; a day with n8n down is not recovered automatically. Expiring overdue reservations is HU-07, a separate change.
- **Agent errors and corrections:** `scripts/sync_issue_tasks.py` printed nothing for issue 6 because the issue was not in its list, so nothing was mirrored; one line was added. The date check threw a `RangeError` on an impossible date such as `2026-13-01` instead of the intended message; a unit test caught it and it was fixed (flow 05's copy has the same flaw and was not touched). The first draft of `workflows/tests/06-due-reminders.md` contained a claim about the app's date rules and a list of which cases Manon had run that nobody had stated; both were removed.
- **Verification and evidence:** 24 unit tests pass. The generated JSON imports in a throwaway n8n container and is inactive. Manon reported on the team's n8n that the sending branches, the record order, flow 08 as Error Workflow and the live runs of tasks 4.2 to 4.6 passed; David confirmed the shared kDrive folder. No data left n8n except the calls to the app, to kDrive and to the mailbox; no AI model is used in this flow. Screenshots: `docs/evidence/06-due-reminders/` (pending).
- **Remaining work at handoff:** screenshots (task 5.3), the PR to `dev` with `Closes #6` and David's review (task 5.4). The `scripts/sync_issue_tasks.py` change belongs to David's tooling area and should be mentioned in the PR.

### AI-015 — Flow 10 Excel Migration (#10)

- **Date:** 2026-10-27 (Europe/Madrid).
- **Related issue / PR:** [#10 — HU-10 · Migración del Excel antiguo](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/10); branch `feat/10-excel-migration`; PR not opened yet.
- **Tool and model:** Claude Code / Claude Sonnet 5.5 (Manon's agent).
- **Prompt / request:** "let's review H10, tell me more about it"; "settle those decisions first"; "let's not finish essential before building H-10"; "yes, go ahead"; "/opsx:apply"; "table created, continue with the build".
- **Accepted suggestions and reasons:** The migration asks the app whether a row exists (customer, product, date, price) instead of keeping a register, so the app stays the source of truth. A "migration running" flag in an n8n Data Table makes the router ignore events during the run, because the app cannot be told not to send webhooks and the CSV has no emails. The CSVs come in through a form upload (no change to `docker-compose.yml`). Doubtful rows are held and mailed to Marisa. All decisions are in `docs/decisions-clarify.md` ("Excel migration: …"). The logic (cleaning, grouping, rules, plan, request building, report) is tested Code-node source (`workflows/code/10-excel-migration.js`, 54 tests incl. the flag check); the JSON is generated.
- **Rejected / deferred suggestions and reasons:** An import register in Google Sheets or an n8n table (second source of truth). Skipping events by old `fecha` (in `abono.registrado` the payload's `fecha` is the apartado's date, so real new deposits would be lost). Mounting `data/` into the n8n container. Merging customers by phone.
- **Agent errors and corrections:** (1) The agent first said some CSV apartados might be past their 90-day deadline; `fecha_limite` is `fecha` + 90 days and every row is inside it. (2) It said Essential was not finished from a stale local `dev` (15 commits behind); Manon corrected it and it pulled. (3) Its first recommendation for the webhooks (skip by old `fecha`) was wrong for the reason above and was replaced by the flag. (4) The first generated flow sent empty bodies (the app answered 422 "Field required" for every row): n8n hides the HTTP body options when `method` is an expression, so each create got its own node with a literal method. (5) A node that receives no items does not run in n8n, so stages with nothing to send pass an `{ empty: true }` marker around the HTTP node. (6) With the flag switched off right after the last create, all 16 historical events still reached flows 01 and 02, because n8n starts the router executions up to a second after the app sends them; a 15-second wait before switching it off fixed it. (7) The Form Trigger's `responseNode` mode was rejected by n8n 2.44.5; it answers from the Form node at the end of the flow instead. Each was found by running the flow, not by the unit tests.
- **Verification and evidence:** 131 unit tests pass (54 for this change). The generated JSON imports and runs in a throwaway stack (n8n 2.44.5, the repo's app with `SEED=0`, Mailpit): clean load gave 7 apartados, 10 abonos, 6 ventas with the original dates and the report email; a second run created nothing; a partial load was completed; a wrong key, an unreachable app and an empty `TIENDA_EMAIL_AVISOS` each stopped the run; with the router published all 16 historical events were ignored. Details and limits in `workflows/tests/10-excel-migration.md` and `workflows/tests/00-event-router.md`. No data left that stack except the calls to the throwaway app and mailbox; no AI model is used in this flow. Screenshots: `docs/evidence/10-excel-migration/` (pending).
- **Remaining work at handoff:** run cases 1, 2 and 7 on the team's n8n with the real flows 01 and 02 and flow 08 as Error Workflow (tasks 5.5, 6.1), screenshots (task 6.3), David's review of the four assumptions (task 1.3), the PR to `dev` with `Closes #10` (task 6.4). The router JSON changed: `scripts/import_new_workflows.py` does not replace an existing flow, so the team's router must be re-imported by hand.

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
