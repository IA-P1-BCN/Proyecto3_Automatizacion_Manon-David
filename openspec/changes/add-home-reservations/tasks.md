# Tasks

## 1. Prerequisites and decisions

- [x] 1.1 Create the branch `feat/13-home-reservations` from `dev` without losing the uncommitted work; verify `git branch --show-current` shows it and `git status` still lists the new flow files.
- [x] 1.2 Get the flow 03 owner's agreement to the hook; verify it is recorded in `docs/decisions-clarify.md` with the date.
- [x] 1.3 Record the HU-13 decisions in `docs/decisions-clarify.md` (Option A only, Form Trigger channel, fixed price list in the code, Data Table `solicitudes_apartado` with `payment_key`, apartado created when the payment arrives, 11b matching rules, hook before the NoOp, consent origin `tienda`); add the issue row #13 to the branching table; verify none contradicts an existing decision. Add the postponed items (stale-request reminders, Telegram channel, Option B, an `origen` input for flow 09) to `docs/future-implementation-ideas.md`.

## 2. Pure logic

- [x] 2.1 Request validation, price lookup, reference generator, duplicate guard, Spanish emails and email check for flow 11 in `workflows/code/11-home-reservations.js`; verify `node --test workflows/code/11-home-reservations.test.js` passes (13 tests).
- [x] 2.2 Matching, claim check, apartado body, creation interpretation, update-failure handling and result shaping for flow 11b in `workflows/code/11b-match-request.js`; verify `node --test workflows/code/11b-match-request.test.js` passes (18 tests, including that a payment not about a request keeps every field and only gains `decision`).

## 3. Build the flows

- [x] 3.1 Generate flow 11 with `workflows/code/build-11-home-reservations.js` (form, validation, duplicate check, reference, row, consent, emails, completion pages); verify the JSON is inactive, has no credentials or `localhost`, every connection resolves, and the generated Code nodes run against a stubbed n8n context.
- [x] 3.2 Generate flow 11b with `workflows/code/build-11b-match-request.js` (read, decide, claim, re-read, create, update row, return); verify the JSON is inactive, has no credentials, every node is reachable from the trigger, and the generated Code nodes give the right result for created, lost claim, app refusal, app down, failed update and not-mine.
- [x] 3.3 Build the flow 03 hook in a copy (`03 New Remote Deposits`): Execute Workflow, Switch and NoOp with the rewiring of the validated-extraction output; verify by diff against the original that exactly three nodes were added, one connection removed and five added, no existing parameter changed, `active` false and the three `allow_*` gates false.
- [x] 3.4 Import flows 11, 11b and the flow 03 copy into a throwaway n8n, create the Data Table with all columns, choose the SMTP and shop credentials, flow 09 and flow 08; verify all three open without errors and 11b's execution input shows `payment`, `payment_key` and `allow_payment_registration`.

## 4. Tests with real data

- [x] 4.1 Save the sample requests and expected results in `workflows/tests/11-home-reservations.md` (valid, no consent, unknown model, altered price, duplicate, withdrawn consent, reference match, name-only match, request plus reservation, two requests, 3 € refused, app down, unknown reference); verify every spec scenario appears in the table.
- [x] 4.2 Run the request form with your own email; verify one `pendiente` row, no apartado in the app, one Spanish email to the shop and one to you with the reference, the 5 € minimum and the payment instructions.
- [x] 4.3 Run the 10 manual cases of flow 03 with the hook in place and an empty table; verify cases 01–09 give exactly the outcomes they gave before. Run on 2026-10-29 in manual mode with `allow_external_ai` on (synthetic notices sent to Groq by decision), then set back to off; registration and shop notices stayed off. Executions 183, 185, 187, 189, 191, 192, 194, 196, 197. The table was not empty (SOL-0001 `confirmada`, SOL-0002 `pendiente`, neither matching any payer), so 11b answered `not_mine` for the 7 validated payments and the hook did not run for 05 (review, no concept) and 08 (ignored).
- [x] 4.4 With registration still off, inject a notice with a pending request's reference; verify Marisa gets "Vista previa" and nothing changes. Turn registration on in your own draft only and repeat; verify an `activo` apartado with the paid amount, the row `confirmada` with its id, and one confirmation email from flow 01 and none from these flows. Run on 2026-10-29 with a 10 € Bizum from MARTA GIL, concept SOL-0002 (temporary injector in the n8n draft, restored afterwards). Registration off (execution 199): "Vista previa" in the review notice, row still `pendiente`. Registration on (execution 201): apartado 47 `activo`, 10 € paid, 99 € pending; SOL-0002 `confirmada` with `apartado_id` 47 and the payment key; one confirmation email from flow 01 (execution 205, router 203) to the request's address; no email node ran in flows 03 or 11b. Shop notices stayed off, so Marisa's preview notice was built but not sent.
- [x] 4.5 Run the same payment twice and two payments at once; verify one apartado exists and the second is told the request is already being processed. Send 3 €; verify the app's message reaches Marisa and the row is `pendiente` again. Stop the app during creation; verify the row stays `procesando`, the review email carries the warning and flow 08 alerts. Closed by decision on 2026-10-29: two payments at once and the app failing during creation are covered by unit tests only; the repeat, 3 € refusal and already-processing cases were run in n8n.
- [x] 4.6 Give the same payer an active reservation and a pending request, without the reference; verify nothing is created and Marisa decides. Closed by decision on 2026-10-29 without an n8n run; covered by unit tests 8 and 9 of `11b-match-request.test.js`.

## 5. Export and docs

- [x] 5.1 Export `workflows/11-home-reservations.json` and `workflows/11b-match-request.json` and verify they contain no credentials, `localhost`, real addresses, Bizum numbers or IBANs. Empty the workflow ID in the Execute Workflow node of the flow 03 copy and sanitize it with `node workflows/code/sanitize-03-tested-export.js`; verify it is inactive, credential-free, and that only one flow 03 export remains in `workflows/` so the AI inventory test passes.
- [x] 5.2 Pass `TIENDA_PAGO_INSTRUCCIONES` through `docker-compose.yml` and add a fake example to `.env.example`; verify `docker compose -p paso-firme config` resolves it from `.env` and `printenv` in the n8n container prints the value.
- [x] 5.3 Document in `docs/README-changes.md` the Data Table and its columns, the credentials and variables (names only), the price list location, the form URL, how a payment creates the apartado, the hook in flow 03, how to cancel a request and the consent origin; update the node count in `docs/remote-deposits-setup.md`; verify the text matches the tested flows.
- [ ] 5.4 Add flows 11 and 11b to `docs/ai-data-inventory.md` (no new AI use, personal data only in the Data Table and the emails) and note in the process map that HU-13 is covered by Option A; save screenshots of the form, the shop email and the customer email in `docs/evidence/11-home-reservations/` and add the entry to `docs/ai-log.md`; verify the entry says nothing new left n8n except the app calls and the emails. Progress 2026-10-29: inventory entries for flows 11 and 11b, `docs/evidence/11-home-reservations/README.md` (text evidence) and `AI-033` in `docs/ai-log.md` are written and the inventory test passes. The process-map note is added to `docs/process-map/README.md` (David's file, added at Manon's request; he reviews it in the PR). Still open: the three screenshots.
- [x] 5.5 Run the full `node --test workflows/code/*.test.js` and the backend `pytest`; verify no test fails. Run on 2026-10-29: 305 node tests passed, 0 failed; backend `pytest` 32 passed (in a throwaway virtualenv, because the local Python lacked `openpyxl`).
- [ ] 5.6 Sync the issue with `python scripts/sync_issue_tasks.py 13`, open the PR to `dev` with `Closes #13`, and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
