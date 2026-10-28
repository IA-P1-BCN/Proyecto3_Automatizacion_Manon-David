# Design

## Context

See `proposal.md` for the accepted scope and issue #8 — HU-08 · Informe mensual. The branch starts from `origin/dev` at `fa66350`, including PRs #38 and #47. The monthly workflow does not yet exist. Current host services are the shop at port 8001 and n8n at port 5680; container API requests must still use `http://tienda:8000`.

Observed API behavior in `backend/models/apartado.py`, `backend/models/abono.py` and controllers:

- `/api/ventas` and `/api/abonos` accept inclusive `desde`/`hasta` dates. Omitting `pagina` on sales/reservations returns a complete array; empty arrays must remain one response item in n8n.
- Reservation lists provide `fecha`, current `estado`, `abonado` and `pendiente`. There is no `fecha_liquidacion` or transition history.
- Payments carry a business date and reservation ID, may be backdated for migration, and remain readable after settlement. Initial full payment can create a settled reservation.
- `/api/vales` returns voucher dates and reservation IDs; expiry creates a voucher on the actual expiry operation date. The reservation's deadline is not the expiry-operation date.
- HU-04 already demonstrates cent-safe sums, complete-array HTTP responses, manual email opt-in and existing SMTP environment fields. Reuse its patterns without editing that flow or its historical CSV.
- Local n8n is 2.32.6. The standard Convert to File documentation does not list PDF conversion, and the running container has none of the checked browser/PDF converter executables. No Gotenberg instance exists in the observed stack. No authenticated n8n MCP management tooling is available in this session.

## Goals / Non-Goals

**Goals:** Isolate period selection, source validation, deterministic aggregation, presentation and delivery so an optional PDF cannot change monetary calculations. Preserve existing live workflows, positions, credentials and connections. Preview safely before sending one controlled report.

**Non-Goals:** Reconstruct actual state-change timestamps or historical month-end debt, create financial records, expire reservations, recalculate individual balances, change business date storage, build a dashboard or new business ledger, or add AI/PDF SaaS dependencies.

## Decisions

### 1. Build the email baseline before PDF

Implement `07 Monthly Report` with Manual Trigger and Schedule Trigger feeding a shared path. Cron is `0 9 1 * *` with workflow timezone Europe/Madrid. The manual selector uses a closed `YYYY-MM` month, `send_email=false` and later `include_pdf=false`. Scheduled input derives the previous month from Madrid-local time. Use calendar first/last dates, not 30-day subtraction or UTC conversions of bare API dates.

Editor discovery: the general Execute workflow button can select the schedule trigger. Manual-input flags do not protect that other branch. Therefore Scheduled Report Input derives `scheduled_execution` from the actual n8n `$mode === 'trigger'`; Prepare Monthly Period rejects a scheduled input without that true runtime marker before GETs/SMTP. List the Manual Trigger first as a client-default hint without changing node IDs/positions/connections; the runtime guard, not the ordering, is the safety control. CLI executions of the schedule entry are intentionally blocked too.

Alternative: build PDF infrastructure first. Rejected because it could consume the delivery budget before the mandatory business report works.

### 2. Read API records, not daily-close CSV totals

Use Header Auth GET requests with full-response JSON envelopes for monthly sales/deposits, all reservations, all vouchers and payment history needed to find settled reservations' latest payment dates. Do not send pagination parameters that truncate the lists. Aggregate only the monthly movements; payment history supports date attribution, not a competing balance calculation. Validate response status/body, IDs, dates, cent-safe amounts and necessary reservation/voucher relationships before output.

The additional all-payment-history read is proportionate for this small shop/demo. If volume makes it unsuitable, fetch detail for the relevant currently settled reservations instead, retaining identical observable counting rules. Do not silently infer an empty list from an error response.

Alternative: sum `basedatos.csv`. Rejected because missing/recalculated closes and late or migrated payments can diverge from current API data. API reads do not rely on webhook delivery.

### 3. Separate accounting dates from system timestamps

- New = reservation `fecha` inside the selected month, regardless of current state.
- Settled = current `estado=liquidado`, latest recorded payment date inside the month. Latest means the maximum valid payment business date, not array order or time of import. A missing usable date is an error, not a guessed metric.
- Expired = current `estado=vencido`, associated voucher `fecha` inside the month, distinct by reservation ID. Never substitute `fecha_limite`.
- Pending = sum current API `pendiente` only for `activo`, including overdue reservations still active in the app, labelled with Madrid consultation time.

The email explains the approved definitions in Spanish. Historical imports can change earlier-month reports; this is not immutable reporting or a stored transition audit. No claims about collection of the shoes or profit are made.

### 4. Pure calculations and one report model

Follow existing helper/generator/test patterns under `workflows/code/`. Use integer cents with safe-range checks, fixed payment methods plus visible `otros`, Spanish EUR formatting and HTML escaping. Validate dates without timezone-dependent rollover. The report model owns totals, counts, definitions and period; both HTML email and optional printable HTML consume it, never recalculate it.

Canonical JSON remains inactive, unpinned and without local credential/Error Workflow IDs. Once imported and arranged by David, targeted node edits and sanitized export preserve that layout; tests must not overwrite the reviewed JSON.

### 5. Safe delivery, reruns and failure boundaries

Manual previews make GET requests only and do not send mail. Existing `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS`, shop Header Auth and SMTP are reassociated locally. Check a valid recipient before any explicitly requested SMTP send. Use bounded retries only for reads; no automatic SMTP retries or financial writes.

For normal scheduled reruns, use the workflow's persisted static data to remember the successfully delivered period, writing the marker only after SMTP success and ending that execution successfully. Manual runs are previews by default; explicitly enabled manual sends are intentional resends. n8n does not reliably persist static data for manual tests, so do not present those as automatic deduplication evidence. Concurrent sends or a crash after SMTP acceptance but before state persistence are not exactly-once delivery; inspect history before recovery. Document these limits rather than adding a new delivery service or ledger.

Unexpected input/API/SMTP failures reach the selected flow 08 through normal execution failure. Missing optional PDF is a handled warning: attempt the one table email, retain the warning in its body and execution result, and do not turn a successful table delivery into a failing run that would invalidate the normal success marker.

### 6. Optional local PDF trial, after the baseline, at most 20 minutes

The initial feasibility inspection found local [Gotenberg](https://gotenberg.dev/docs/convert-with-chromium/convert-html-to-pdf) suitable in principle: POST an `index.html` multipart file to `/forms/chromium/convert/html`, receive PDF bytes. This is documented feasibility, not an executed integration.

If attempted, add a separate optional Compose file for a version-pinned Gotenberg service on the same private Docker network, with no host port or business-data volumes. Start only that service, never recreate the shop/n8n. Prefer Chromium-only conversion, disable unneeded routes/JavaScript and outbound network fetching; use inline styles/assets. Do not assume offline safety from merely running locally: verify the selected version's configuration. No external fonts, images, telemetry collector or PDF SaaS is required.

In the workflow, a PDF toggle gates HTML-to-file, HTTP conversion and binary validation before the existing email node. Attach only verified PDF output with a deterministic period filename. A failed conversion follows a handled no-attachment warning path into the same email stage; it never creates a second report send. Test accented Spanish, EUR symbols, page breaks, identical figures and converter failure with synthetic input.

Record elapsed PDF trial time and actual outcome. If it exceeds 20 minutes or needs broader infrastructure changes, stop, leave `include_pdf=false`, preserve the tested email baseline, and document PDF as deferred. The two-hour overall budget is an effort limit, not a reason to conceal unverified acceptance.

## Risks / Trade-offs

- [No settlement timestamp] → State the approved last-payment accounting rule and show imported historical examples in tests; do not claim actual transition timestamps.
- [Current debt differs from month-end debt] → Clearly separate current pending consultation time from the previous-month period.
- [API reads are not one atomic snapshot] → Record the consultation window and fail on inconsistent required relationships; no point-in-time ledger guarantee.
- [Wrong/truncated arrays or empty n8n item streams] → Full-response envelopes, strict validation and empty-array tests.
- [SMTP uncertainty/static-data limits] → No blind resend; document normal duplicate suppression versus crash/concurrency gaps.
- [Late payments change historical results] → Manual previews recalculate from the API; no immutable report promise.
- [PDF dependency, memory and startup cost] → Optional isolated service, no public port, no baseline restarts, strict 20-minute trial, email fallback.
- [Local fixture records affect totals] → Keep HU-03 and demo fixture movements in API-based comparisons; never delete them to make totals match.

## Deployment and rollback

Import only the new inactive workflow, reassociate existing credentials and select the local Error Workflow. Preview a closed month and contrast with an independent API-only calculation. Before a real test email, confirm the intended instance, controlled recipient and single-message effect. Publication needs separate permission. Rollback means leaving this new workflow inactive and, if needed, stopping only the optional converter; never reset volumes or modify existing workflows.
