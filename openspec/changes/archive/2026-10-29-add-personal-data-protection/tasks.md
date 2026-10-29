# Tasks

## 1. Configuration and decisions

- [x] 1.1 Add `TIENDA_WEBHOOK_TOKEN` (fake placeholder) to `.env.example` and to the n8n service in `docker-compose.yml` as `${TIENDA_WEBHOOK_TOKEN:-}`, and change the example `N8N_WEBHOOK_URL` to include `?token=`; verify with `docker compose config` that the value reaches the n8n container and the app's URL.
- [x] 1.2 Record the decisions in `docs/decisions-clarify.md` (token in query or header and why not Header Auth; Data Table register; fail closed; backfill basis) and move the consent entry out of `docs/future-implementation-ideas.md`; verify nothing contradicts `docs/constitution.md`.
- [x] 1.3 Ask the other teammate to confirm the small edits to flows 06 and 06b and the consent basis (an email given in the shop); note the answer in the decisions file.
tick
## 2. Webhook authentication and validation

- [x] 2.1 Write the pure token check (header first, then query, constant-time compare, empty configured token rejects everything) in `workflows/code/00-check-token.js` with unit tests (valid header, valid query, wrong, missing, empty configured, token with special characters); verify the tests pass.
- [x] 2.2 Write `workflows/code/00-validate-event.js` with unit tests for every event in `docs/guia-de-la-app.md` (valid, missing `datos`, `importe` as text, invalid email, unknown event passes through, reason never contains payload values); verify the tests pass.
- [x] 2.3 Update `build-00-event-router.js`: Webhook set to respond with Respond to Webhook, token check, `401` response, `200` response on accept, validation step before the migration flag; regenerate and verify with the app's real URL, a wrong token, no token, an empty configured token (alert from flow 08) and the old URL.
- [x] 2.4 Update `workflows/tests/00-event-router.md` with the new cases and run the previous routing cases again; verify they still reach flows 01, 02, 04 and the ignored/unknown paths.

## 3. Consent register and check

- [x] 3.1 Write `workflows/code/09-consent.js` (normalise email, validate, decide `permitido`/`no_permitido` with reason) with unit tests (uppercase and spaces, active, withdrawn, missing, invalid, table error); verify the tests pass.
- [x] 3.2 Create the Data Table `consentimientos` in n8n (`email`, `estado`, `fecha`, `origen`) and document the steps; verify it appears in the editor.
- [x] 3.3 Generate `09 Consent Check` (Execute Workflow Trigger → read table → Code) via `build-09-consent-check.js` with flow 08 as Error Workflow; verify active, withdrawn, missing, invalid email and a renamed table (fail closed with alert).
- [x] 3.4 Generate `09b Consent Backfill` (manual trigger → `GET /api/apartados` → distinct valid emails → insert missing only); verify the first run creates the expected rows, the second run changes nothing and nothing is emailed.
- [x] 3.5 In the router, record consent on `apartado.creado` with an email (never over `retirado`) and check it on `abono.registrado` before calling flow 02; verify with an active, a withdrawn, a missing and a no-email customer, and with the table unreadable.
- [x] 3.6 Add the consent call before the customer email in flows 06 and 06b (generators `build-06-due-reminders.js`, `build-06b-expired-reservations.js`); verify a withdrawn customer gets nothing and is not recorded as notified, and an active one still gets the reminder once.

## 4. AI data disclosure

- [x] 4.1 Write `docs/ai-data-inventory.md` from the real flows (flow 03 Groq: fields sent, fields never sent, gates, legal basis, how to disable) and add the rule for future AI flows to `docs/constitution.md`; verify against `workflows/03-remote-deposits.json`.
- [x] 4.2 Write `workflows/code/ai-inventory.test.js` that fails on an AI node missing from the inventory; verify it passes now and fails when a fake AI node is added to a copy of a flow.

## 5. Tests, export and docs

- [x] 5.1 Save the scenarios and expected results in `workflows/tests/09-consent.md` (every spec scenario, including the 401 cases and the fail-closed cases); verify every spec scenario is covered.
- [x] 5.2 Export `00-event-router.json`, `06`, `06b`, `09` and `09b`; verify none contains credentials, the token value, real addresses or `localhost`, and run the whole unit-test suite.
- [x] 5.3 Document the new variable and table, the changed `N8N_WEBHOOK_URL`, how to withdraw consent and the import order (create the table → import 09 → run 09b → import the router) in `docs/README-changes.md`; add the entry to `docs/ai-log.md`.
- [x] 5.4 Sync the issue with `python scripts/sync_issue_tasks.py 14`, open the PR to `dev` with `Closes #14` and verify the other teammate reviewed it. Done: PR #51 merged by the other teammate.

## Workflow follow-up

- Archive this change after the PR is merged; the `event-routing` main spec (from `chore/archive-merged-changes`) may need a follow-up delta for the router's new behaviour.
- Tell the team to update their own `N8N_WEBHOOK_URL` when this lands.
