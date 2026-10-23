# Design

## Context

`GET /api/ventas` and `GET /api/abonos` take `desde` and `hasta` (`YYYY-MM-DD`, inclusive) and return a list; n8n turns each element into an item. Sales have `concepto, importe, forma_pago`; deposits have `apartado_id, importe, forma_pago`. Payment methods are `efectivo`, `tarjeta`, `bizum`. The old Excel counted initial deposits as sales; in the app they are deposits. n8n runs with `GENERIC_TIMEZONE=Europe/Madrid`. See proposal.md and `specs/daily-close/spec.md`.

## Goals / Non-Goals

**Goals:** exact sums, one clear email, an idempotent history row, and a way to redo a missed night.

**Non-Goals:** pending-to-collect totals and monthly reporting (Medium level); reconciliation against the card-terminal CSV; reading the history back.

## Decisions

1. **Two triggers into one chain:** a Schedule Trigger at 23:55 and a Manual Trigger with a date field. Both feed a Set node that fixes `fecha` (today in Madrid, or the chosen date). *Alternative:* a separate recovery workflow; rejected as duplicate logic.

2. **Sum in whole cents in a Code node.** Convert each amount to integer cents, add per method and per source, convert back for display. *Alternative:* n8n Aggregate / Sum nodes on floats; rejected because float addition can produce errors such as 0.30000000000000004.

3. **Fetch with `desde = hasta = fecha`** for sales and deposits, with the HTTP node returning all items (no pagination parameters, so the app returns everything). An empty list still produces one run of the Code node (the node is set to run once even with no items).

4. **Unknown payment methods are shown as "otros"** and counted in the total rather than dropped. The app validates the three values, so this is a safety net, not an expected path.

5. **Email and history written in parallel from the Code node's output,** so a failed save does not block the email. A failure in either branch fails the execution, which triggers flow 08.

6. **Sheet columns:** `fecha, ventas_efectivo, ventas_tarjeta, ventas_bizum, abonos_efectivo, abonos_tarjeta, abonos_bizum, total_ventas, total_abonos, total`. The Google Sheets node uses *append or update* keyed on `fecha`. Sheet ID comes from configuration.

7. **Plain-text Spanish email** with a short table and the note that Bizum includes transfers.

## Risks / Trade-offs

- **[n8n down at 23:55]** The close doesn't run. → The manual-date trigger recovers it; the README tells the team to check the history for gaps.
- **[Payments after 23:55 or timing around midnight]** → By decision they belong to the next close; documented in the email footer and README.
- **[Float or rounding differences against the app]** → Cent arithmetic; the evidence compares the close to the app's own figures.
- **[Google Sheets credential or quota issues]** → Email still goes out; error workflow alerts.
- **[Rerun resends the email]** → Accepted: reruns are deliberate manual actions.
