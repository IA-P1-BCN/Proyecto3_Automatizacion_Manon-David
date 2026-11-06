# Design

## Context

`GET /api/ventas` and `GET /api/abonos` take `desde` and `hasta` (`YYYY-MM-DD`, inclusive) and return a list; n8n turns each element into an item. Sales have `concepto, importe, forma_pago`; deposits have `apartado_id, importe, forma_pago`. Payment methods are `efectivo`, `tarjeta`, `bizum`. The old Excel counted initial deposits as sales; in the app they are deposits. n8n runs with `GENERIC_TIMEZONE=Europe/Madrid`. See proposal.md and `specs/daily-close/spec.md`.

## Goals / Non-Goals

**Goals:** exact sums, one clear email, an idempotent history row, and a way to redo a missed night.

**Non-Goals:** pending-to-collect totals and monthly reporting (Medium level); reconciliation against the card-terminal CSV; editing transactions from the closing flow; changing `registro.txt` or other kDrive documents.

## Decisions

1. **Two triggers into one chain:** Schedule at 23:55 and Manual Trigger with a Set node for `fecha` and boolean `send_email` (default false for manual). Scheduled email is enabled. No public form was approved; use the local editor. Validate calendar dates and reject future dates.

2. **Sum in whole cents in a Code node.** Convert each amount to integer cents, add per method and per source, convert back for display. *Alternative:* n8n Aggregate / Sum nodes on floats; rejected because float addition can produce errors such as 0.30000000000000004.

3. **Fetch with `desde = hasta = fecha`**, no pagination parameters. HTTP nodes return a full response containing the entire array, so empty days keep one item. Retry bounded read requests, never blindly retry the history POST. Reject malformed amounts, dates and duplicate record IDs rather than silently changing financial figures.

4. **Unknown payment methods are shown as "otros"** and counted in the total rather than dropped. The app validates the three values, so this is a safety net, not an expected path.

5. **Isolate output failures without relying on parallel scheduling:** when requested, attempt SMTP first using `continueRegularOutput`, remember a sanitized failure flag, then attempt history. SMTP failure does not prevent storage; history failure does not prevent the prior email attempt. If storage succeeds but SMTP failed, throw at the final node. A history failure throws at its failing node. Configure flow 08 as Error Workflow locally. Email warns that it does not itself confirm history persistence. This preserves the requirement that both outputs are attempted, rather than assuming visual branches always execute in parallel in n8n v1 ordering.

6. **kDrive history:** `basedatos.csv` with `fecha;ventas_efectivo;ventas_tarjeta;ventas_bizum;ventas_otros;abonos_efectivo;abonos_tarjeta;abonos_bizum;abonos_otros;total_ventas;total_abonos;total`. UTF-8 BOM, decimal commas, CRLF; strict schema and consistent totals. Read folder pages with `with=etag`, verify completeness, locate the exact file name. New file: POST upload with `directory_id`, `file_name`, `conflict=error`, `If-Match: blank`. Existing file: download, validate and upsert, POST upload with `file_id` and `If-Match` from listing. Never delete/recreate/rename on conflict. Invalid/locked files or API failure abort without overwriting. A conflict requires a fresh manual read/recalculation. File ID is rediscovered each run, avoiding mutable static workflow state. Existing rows survive and dates are sorted. Maximum output size 5 MB, max 100 folder pages; reaching either limit fails safely instead of assuming absence.

7. **Plain-text Spanish email** with a short table and the note that Bizum includes transfers.

## Risks / Trade-offs

- **[n8n down at 23:55]** The close doesn't run. → The manual-date trigger recovers it; the README tells the team to check the history for gaps.
- **[Payments after 23:55]** → Rerun that date manually. They do not belong to the next calendar-date query automatically.
- **[Float or rounding differences against the app]** → Cent arithmetic; the evidence compares the close to the app's own figures.
- **[kDrive credential, quota, or version conflicts]** → Requested email is attempted first; flow 08 handles the save failure. No write retry that could overwrite concurrent changes.
- **[Manual reruns]** → Recompute the selected date and replace its row. Email stays disabled unless explicitly requested. Scheduled SMTP delivery retries are not automatic; email provider acceptance after a network timeout cannot guarantee exactly-once delivery.
- **[Both teammates share the same file]** → ETag/conflict guards prevent last-writer-wins, but only one scheduled writer should own a production history. Use separate test folders; do not manually edit history during a close.
- **[Access verification]** → User reports list access with a drive-scoped token. Upload/replace and real SMTP executions of this new flow still require local credential assignment and live testing; never claim the file exists from export generation alone.
