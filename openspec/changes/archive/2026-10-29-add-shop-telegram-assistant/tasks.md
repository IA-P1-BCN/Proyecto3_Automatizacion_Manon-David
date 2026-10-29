# Tasks

Issue #12 — HU-12 · Marisa pregunta a su negocio. Initial active-work timebox: five hours, excluding waiting and human review. All boxes are implementation work, not evidence that it has run. No publication, real message or financial write is authorized by this checklist.

## 1. Closed questions and verification rubric

- [x] 1.1 Add pure logic for independent owner/envelope checks, bounded whole-question recognition, canonical model input and strict plan validation; verify JavaScript unit tests cover the agreed aliases, strangers/groups/forwards, empty configuration, unknown periods, personal text, multi-intent questions and malicious/invalid tool or model output, with no privileged calls on rejected paths.
- [x] 1.2 Add Madrid calendar boundaries, complete-response checks and integer-cent collection totals; verify fixed-clock tests for Monday/month/year/DST edges, initial deposits counted once, valid empty data, malformed/duplicate/out-of-period records, incomplete counts and overflow, including the EUR 35 fixture in the spec.
- [x] 1.3 Add current-month active-deadline selection and deterministic Spanish text/chunk generation; verify tests for API pending copied unchanged, today versus overdue, terminal records excluded, stable date/ID ordering, hostile/control/markup fields, empty results and full-list message limits without silent record loss.
- [x] 1.4 Create the issue-facing spec and initial setup/test guide alongside the pure helpers; verify the guide names exactly the two supported questions, their periods, fixed reply formats, security/data boundaries, expected failures and the local credential/variable names without values.

## 2. New inactive n8n workflow and constrained Agent

- [x] 2.1 Generate `workflows/12-shop-telegram-assistant.json` with authenticated bridge webhook, explicit manual preview, configuration gates, independent authorization, fixed GET plans and deterministic rubric/replies; verify JSON/expression/connection tests show no application write, no arbitrary endpoint/recipient, inactive/default-off settings and no change to an existing workflow.
- [x] 2.2 Connect the installed Groq chat-model node and fixed Code Tools to the AI Agent with bounded iterations, strict schema/selection checks and no memory/raw-result access; verify malicious/model-tool fixture tests and installed-node compatibility checks, including required tool evidence and rejection of model-authored answers. Do not claim real Groq tool calling until its authorized integration test.
- [x] 2.3 Add sanitized automatic error behavior and local Error Workflow association instructions without editing flow 08; verify forced mocked API/model failures return unavailability rather than zeros, never expose credentials/personal payloads and cannot dispatch a Telegram reply from the agent.
- [x] 2.4 Add the new AI-node/data-flow inventory section and workflow configuration notes; verify the existing inventory/regression tests pass and the documented manual trigger/effect gates match the generated JSON. Preserve Manon's shared-file changes and do not relax HU-14 tests or requirements.

## 3. Isolated local Telegram bridge

- [x] 3.1 Implement outbound Telegram polling, startup bot/webhook checks, a single-consumer lock, bounded owner discovery and repeated owner validation; verify Python tests with fake endpoints cover forged identities, wrong chats, replay shape, existing webhooks, competing consumers and discovery without automatic enrollment, business reads or messages.
- [x] 3.2 Implement local metadata-only cursor/rate/delivery persistence and fixed internal webhook requests; verify restart/duplicate/stale/rate-limit tests and injected crash/timeouts suppress uncertain retries, never store messages/answers/keys and never send to a model-selected destination. If any chunk was sent before a crash, hold the incomplete delivery for review instead of rebuilding a mixed-snapshot answer.
- [x] 3.3 Add bridge Dockerfile and optional `docker-compose.shop-assistant.yml` with safe environment-name templates; verify overlay/service validation shows no published port, privileged mount or shop credential, and tests show token-bearing URL exceptions are sanitized. Do not start or recreate the existing shop/n8n services.
- [x] 3.4 Complete bridge/setup/recovery instructions with BotFather creation, local owner pairing, one consumer per bot, secret storage, explicit send gate, test/production URL choice, state retention, partial-delivery limits and stop-only-this-service rollback; verify documented commands work against isolated fake services without contacting Telegram or requiring a public tunnel.
- [x] 3.5 Apply the user-approved file-secret revision: hidden local token entry, private files outside the repo, path-only environment configuration, non-root matching UID and read-only file mounts; verify helper/reader unit tests, actual offline Docker permissions/read-only/no-secret-env checks, Compose/OpenSpec validation and updated setup/evidence without overwriting user secrets or starting the live bridge.

## 4. Executed integration and review preparation

- [x] 4.1 Execute the exported workflow and bridge in a disposable isolated n8n stack with fake shop/Groq/Telegram and independent state; verify both questions end to end, forbidden-path call counts remain zero, actual Agent tool/output serialization is validated and replay/restart/failure paths match the spec. Record actual versions and any blocker rather than treating pure tests as integration.
- [x] 4.2 Add and run an independent GET-only comparison against David's shop at host port 8001; verify weekly totals and monthly selected IDs/amounts match workflow calculations without printing customer contacts, sending messages or creating financial records, and record the time/date and non-atomic-read limitation.
- [x] 4.3 Guide David through creating the dedicated bot and local credentials without sharing tokens; import only the new inactive draft, associate credentials locally and execute the explicit manual preview from his editor with effect gates off. Verify expected node outputs and preserve all manual layout/credential work; do not substitute CLI tests for this step.
- [x] 4.4 After explicit authorization for each external effect, perform controlled real Groq/tool-call and private Telegram editor-triggered tests through the bridge; verify David receives both correct replies, real-provider failures do not invent answers and unauthorized/duplicate cases reveal nothing or duplicate nothing. Record which cases used fakes versus real services; if a second account or a live failure test is unavailable, state the exact coverage limitation.
- [x] 4.5 Export the tested safe workflow and finish setup/evidence/issue spec/AI-log records and the README link; verify credential/identity/effect defaults are restored in the shared JSON, secret/personal-data scans and focused regressions pass, and `openspec validate add-shop-telegram-assistant --strict` plus `git diff --check` succeed. List unexecuted publication/automatic-error tests explicitly.

## Workflow follow-up

- Reassess progress at the five-hour active-work boundary. Keep optional questions and HU-11/13 outside this delivery; report a genuine integration blocker instead of hiding it or weakening checks.
- Ask separately before publishing the new workflow, unattended bot operation, syncing implementation tasks to the remote issue, committing, pushing or opening its PR. None of #19's permissions carries over.
- A ready PR targets `dev`, identifies the exact issue title, requests Manon and uses a standalone `Closes #12` only when acceptance is met; otherwise document the blocker and use `Refs #12`.
- The pair reviews and merges. Verify issue closure and board Done independently after integration, and archive this OpenSpec change only when separately requested and appropriate.
