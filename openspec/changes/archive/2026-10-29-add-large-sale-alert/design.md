# Design

## Context

`venta.registrada` carries the sale as `datos`: `id, fecha, concepto, importe, forma_pago` (see `docs/guia-de-la-app.md`). The router (`workflows/00-event-router.json`) already owns the webhook and calls handlers as sub-workflows; flow 02 (`workflows/code/build-02-deposit-receipt.js`) is the pattern for a handler with a generated JSON, a formatting Code node, SMTP sending and flow 08 as Error Workflow. n8n Variables are paid, so config lives in plain environment variables read as `$env.…` (decision "Alert address and local port without paid n8n features"). See proposal.md and `specs/large-sale-alert/spec.md`.

## Goals / Non-Goals

**Goals:** a very small handler; threshold changeable without touching the flow; misconfiguration cannot hide.

**Non-Goals:** daily or monthly totals (HU-04, HU-08); deduplicating events (the app sends each once); alert channels other than email.

## Decisions

1. **Handler as sub-workflow `04 Large Sale Alert`, called from a new Switch output of the router.** Same shape as flows 01 and 02, so ownership and tests stay independent. *Alternative:* an IF inside the router; rejected because it puts business logic in the shared entry point.

2. **Threshold in `TIENDA_UMBRAL_VENTA_GRANDE`, parsed in a Code node.** Plain env var, `.env` → `docker-compose.yml` (`${TIENDA_UMBRAL_VENTA_GRANDE:-}`) → n8n, same path as `TIENDA_EMAIL_AVISOS`, already allowed by `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. A value change needs `docker compose up -d` (restart), not a flow edit. *Alternative:* a Data Table or the API for the threshold; rejected as extra moving parts for one number. *Assumption:* the decimal separator in the variable is a dot; a comma is rejected as invalid.

3. **Validation in code, decision in the flow.** One Code node parses threshold and `importe`, throws on missing or non-numeric values, and returns the Spanish-formatted amount. An IF node then compares `importe > umbral` (strict). The formatter is plain tested JS under `workflows/code/` embedded into the JSON by a generator, like flow 02, so source and flow cannot drift.

4. **Failing loudly on bad config.** An empty variable fails the run so flow 08 alerts; defaulting to a hard-coded value would hide the misconfiguration. *Assumption to confirm with Marisa:* the example value of 150 € in `.env.example`, since the README gives no figure.

5. **No API calls.** Everything needed is in the event, so the flow can never disagree with the app about amounts.

6. **Alert goes to `TIENDA_EMAIL_AVISOS`, sent with the existing SMTP credential.** One address for all shop alerts.

## Risks / Trade-offs

- **[Lost events]** A sale registered while n8n is down gives no alert. → Accepted and documented, as for the other event flows.
- **[Duplicate alert on manual re-run]** Re-executing an execution from the UI emails again. → Accepted; the app never sends an event twice. Revisit if flow 13 (automatic entry) ever replays sales.
- **[Threshold needs a restart]** Env vars are read at container start. → Documented in the README; it is still configuration, not a flow edit.
- **[Router change touches a shared file]** → Only one Switch output and one Execute Workflow node are added; re-export and run the router's sample-payload tests again.
