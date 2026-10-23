# Tasks

## 1. Build the router

- [x] 1.1 Create `00 Event Router` with a POST Webhook on path `tienda`, responding immediately, and verify with `curl` against the Test URL that the call is answered and the body appears under `body`.
- [x] 1.2 Add a Switch on `{{ $json.body.evento }}` with outputs for `apartado.creado`, `abono.registrado`, a fallback that ends successfully, and a "missing event name" branch that throws; verify each output is reached with a sample payload.
- [x] 1.3 Connect the two outputs to Execute Workflow nodes (not waiting for the result) that call flows 01 and 02 and pass `body.datos` plus the event name; verify with stub sub-workflows that each receives the exact payload.

## 2. Tests with real events

- [x] 2.1 Save sample payloads for the four app events (copied from `docs/guia-de-la-app.md`) in `workflows/tests/00-event-router.md` with the expected route for each, and verify the file lists all four plus a malformed one.
- [x] 2.2 Publish the router and create a reservation and a deposit from the app UI; verify in n8n's Executions that both events were routed to the right output.
- [ ] 2.3 Post `venta.registrada`, an unknown event, and a body without `evento`; verify the first two end successfully with no alert and the third triggers the error workflow.

## 3. Failure behaviour

- [ ] 3.1 Make a stub handler fail and then send another event; verify the second event is still routed.
- [ ] 3.2 Verify which workflow's *Error Workflow* setting fires when a called sub-workflow fails, and set flow 08 on the right workflows; record the finding in `docs/ai-log.md`.

## 4. Export and docs

- [ ] 4.1 Export to `workflows/00-event-router.json` and verify the file contains no credentials.
- [ ] 4.2 Document in the README the webhook path, Test vs Production URL, "publish the router", and that events are lost if n8n is down; verify the steps work from a clean `docker compose up -d`.
- [ ] 4.3 Open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Replace the stub handlers with the real flows 01 and 02 as their changes are applied.
- Archive this change after the PR is merged.
