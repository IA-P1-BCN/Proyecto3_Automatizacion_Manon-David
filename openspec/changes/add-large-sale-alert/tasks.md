# Tasks

## 1. Configuration

- [x] 1.1 Add `TIENDA_UMBRAL_VENTA_GRANDE` to `.env.example` (documented, example `150`) and to the n8n service in `docker-compose.yml` as `${TIENDA_UMBRAL_VENTA_GRANDE:-}`; verify with `docker compose config` that the value reaches the n8n container.

## 2. Build the flow

- [x] 2.1 Write the pure function that parses the threshold and `importe` (dot decimals), throws on empty, non-numeric or missing values, and formats the amount in Spanish, with unit tests in `workflows/code/` (threshold empty, `abc`, comma, missing `importe`, 4.5, 189.5); verify the tests pass.
- [x] 2.2 Create `04 Large Sale Alert` (Execute Workflow Trigger → Code node → IF `importe > umbral` → SMTP email to `$env.TIENDA_EMAIL_AVISOS` in Spanish; the false branch ends successfully) via a generator `build-04-large-sale-alert.js`; verify it runs in n8n with a sample payload for each spec scenario (above, equal, below).
- [x] 2.3 Set flow 08 as the Error Workflow of flow 04 and verify an empty threshold and a missing `importe` each trigger the alert.

## 3. Connect to the router

- [x] 3.1 Add a `venta.registrada` output to the Switch in `workflows/code/build-00-event-router.js` and an Execute Workflow node (not waiting) calling flow 04 with `body.datos`; regenerate the JSON and verify the other three routes still reach their targets.
- [x] 3.2 Update `workflows/tests/00-event-router.md` so `venta.registrada` is expected to reach flow 04 instead of being ignored; verify the unknown-event case still ends silently.

## 4. Tests with real events

- [x] 4.1 Save sample payloads and expected results in `workflows/tests/04-large-sale-alert.md` (above, equal, below, empty threshold, missing `importe`); verify every spec scenario is covered.
- [x] 4.2 Publish the router, register a sale below and a sale above the threshold from the app UI; verify exactly one email arrives, for the large one.
- [x] 4.3 Change the variable, restart n8n with `docker compose up -d`, repeat; verify the result changes and the exported JSON does not.

## 5. Export and docs

- [x] 5.1 Export `workflows/04-large-sale-alert.json` and the updated router; verify neither contains credentials, `localhost` or real addresses.
- [x] 5.2 Document the variable (name only), how to change it and why a restart is needed in `docs/README-changes.md`, and add the AI log entry; verify the README text matches the tested flow.
- [ ] 5.3 Open the PR to `dev` with `Closes #9` and verify the other teammate reviewed it.

## Workflow follow-up

- Update the `event-routing` scenarios in `add-event-router` (sale event now routed) when this change is applied.
- Mirror these tasks into issue #9 with `python scripts/sync_issue_tasks.py 9`.
- Archive this change after the PR is merged.
