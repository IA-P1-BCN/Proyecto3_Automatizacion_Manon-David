# Tasks

## 1. Build the flow

- [x] 1.1 Create `90 Demo Data` with a Manual Trigger and the Code node `Build Demo Scenarios` (five scenarios from design decision 6, demo email from `$env.TIENDA_EMAIL_AVISOS`, overdue date = today minus 100 days); cover the Code node with `node --test workflows/code/90-build-scenarios.test.js` and verify in n8n that it outputs five items.
- [x] 1.2 Add `List Reservations` (`GET http://tienda:8000/api/apartados`, shared Header Auth credential) and the Code node that drops scenarios whose `cliente` already exists; verify with an app without demo data (five items pass) and with a list that already contains two demo names (three pass).
- [x] 1.3 Add `Create Reservation` (`POST /api/apartados`) and the Code node that turns each created reservation into its deposits (only for reservations created in this run); verify the ids and that scenarios 3 to 5 have no deposits.
- [x] 1.4 Add `Register Deposit` (`POST /api/apartados/{id}/abonos`) and the final summary node (created, skipped, ids); verify on a clean app that scenario 1 ends `activo` with `abonado` 30,00 / `pendiente` 59,90 and scenario 2 ends `liquidado`.

## 2. Wire and test end to end

- [x] 2.1 Set flow 08 as the flow's *Error Workflow*; verify by temporarily pointing one node at a wrong URL (not the credential) that the failure triggers flow 08's alert, then restore the URL.
- [x] 2.2 Run the flow on a clean app (`SEED=0` or after `docker compose down -v`) with the router and flows 01 and 02 published; verify the five reservations in the app screen: states `activo`, `liquidado`, `liquidado`, `activo` (no email) and `activo` past its deadline, and that the emails arrive only in the `TIENDA_EMAIL_AVISOS` inbox.
- [x] 2.3 Run the flow a second time; verify nothing is created, no email is sent and the summary says everything was skipped.
- [x] 2.4 Verify the partly-loaded case: pin the `List Reservations` output with a list that lacks two demo names, run the flow, and check that only those two scenarios would be created (unpin afterwards; do not send the requests to the app a third time).

## 3. Export and docs

- [x] 3.1 Export to `workflows/90-demo-data.json` and verify no credentials, no real addresses and no `localhost` are in it.
- [ ] 3.2 Write `workflows/tests/90-demo-data.md` (expected final states, email count, PowerShell checks with `Invoke-RestMethod`), add the flow to the README credentials/variables list in `docs/README-changes.md`, and save screenshots of the demo reservations in the app and of the received emails in `docs/evidence/90-demo-data/`.
- [ ] 3.3 Log prompts and agent corrections in `docs/ai-log.md`, open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
