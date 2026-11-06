# Design

## Context

The app exposes `GET /api/apartados?estado=activo`; without `pagina` it returns every match as a list, one n8n item per reservation, each with `estado`, `fecha_limite`, `abonado`, `pendiente`, `email` (see `docs/guia-de-la-app.md`). Nothing marks that a reminder was sent, and the app has no field for it. The reminder cannot hang off a webhook: the app emits no event before a deadline, and events are never retried.

Existing patterns to follow: flow 02 (generated JSON, tested Code node, SMTP, missing-email branch to the shop) and flow 05 (schedule with Madrid time, manual trigger with a date override, kDrive CSV read/write with ETag, `basedatos.csv` semicolon format; see `docs/daily-close-setup.md`).

## Goals / Non-Goals

**Goals:** each reminder goes out once, on the right day, with the app's figures; a failed run can be repeated without duplicates and without losing a reminder.

**Non-Goals:** expiring reservations and the voucher email (HU-07, a separate change on the same schedule idea); catching up after a day when n8n was down; AI-written text; changing the app.

## Decisions

1. **Own workflow `06 Due Date Reminders` with a Schedule Trigger (`0 9 * * *`, Europe/Madrid) and a Manual Trigger.** A `Choose Date` node holds `fecha` (default: today in Madrid, expression) so tests can run any day, like flow 05. *Alternative:* extend flow 05 or the router; rejected, the cause (time) and the owner differ. HU-07 will get its own change and may share the schedule or live in a sibling flow; that is decided there.

2. **Exact-day match, computed in a Code node.** The pure function takes the reservations, the run date and the sent-records and returns `{ send: [...], shopAlerts: [...] }`. A reservation is due when `estado = activo` and `fecha_limite` equals run date + 7 or + 1, comparing `YYYY-MM-DD` strings after adding days in UTC calendar arithmetic (no time zones inside the function; Madrid is applied only when producing "today"). The function never touches `abonado` or `pendiente`. *Alternative:* "7 days or fewer left and not yet reminded" (a catch-up that also covers reservations created with a short deadline); rejected for now: it changes what "7 days" means, and the README criterion is the exact wording. Revisit if missed runs prove a problem.

3. **Sent-record in kDrive, `avisos.csv`, separate from `basedatos.csv`.** Columns `apartado_id;umbral;resultado;fecha_envio` with `umbral` ∈ `7|1` and `resultado` ∈ `enviado|sin_email`; unique on (`apartado_id`, `umbral`). Same folder, credential and ETag/`If-Match` handling as flow 05. Marisa can open it. *Alternatives:* workflow static data (invisible, lost with n8n data, hard to reset for tests); no record (a manual re-run or an n8n retry sends twice, which breaks "once"); an n8n Data Table (invisible to Marisa, same objection as in the daily-close decision). The file is only written by this flow, one run at a time.

4. **Read the record before sending, write it after, never in between runs.** Order: read reservations → read `avisos.csv` (create when absent, fail when the columns are wrong) → compute → send each email with the error output enabled → append rows only for emails the SMTP accepted and for shop alerts accepted → a final check fails the execution if any send failed, so flow 08 alerts. A reminder is therefore never recorded without being sent; the opposite gap (email sent, then the save fails) is the one remaining risk, below.

5. **Missing email: shop alert, recorded as `sin_email`.** Same rule as flow 01/02 (`email` empty or without `@`). The row stops the shop being alerted again on a re-run. The execution still succeeds.

6. **Sending directly, no shared notification sub-workflow.** Same stance as flows 01 and 02 (shared formatter deferred); the Spanish text lives in the tested Code node. One email per item through Send Email (SMTP), sender `TIENDA_EMAIL_FROM`, shop alerts to `TIENDA_EMAIL_AVISOS`. Subject: "Tu apartado vence en 7 días" / "Tu apartado vence mañana".

7. **Message content from the API only.** Model, size when present, `pendiente`, `abonado`, `fecha_limite` formatted `dd/mm/yyyy`, amounts formatted as in flow 02 (`59,90 €`). One closing line says what happens at the deadline: the amount paid becomes a store voucher, never cash (rule from the assignment and the ontology). *Assumption to confirm with Marisa:* the exact wording of that line.

8. **Errors.** HTTP nodes and the CSV steps fail the execution; flow 08 is the Error Workflow. No retry on SMTP beyond n8n's default, so a bounce is visible, not hidden.

9. **Testing data.** Seed data and flow 90 create reservations with a deadline in 7 days and tomorrow relative to the day the stack starts; on other days run the manual trigger with `fecha` set to the right day.

## Risks / Trade-offs

- [Email sent, then the record cannot be saved] → the next run would send it again. The save is the last step and fails the execution so flow 08 alerts; fixing the CSV by hand before the next morning prevents the duplicate. Accepted at Medium level, documented.
- [n8n down at 09:00] → that day's reminders are lost (events and schedules are not replayed). Documented in the README; a manual run with the date fixes it the same day. A catch-up rule is the alternative in decision 2.
- [Reservation created already inside the window, e.g. deadline in 3 days] → it gets only the 1-day reminder. Accepted; the app always sets 90 days, so it happens only with migrated data (HU-10).
- [kDrive is shared with HU-04] → a separate file and the same ETag rule keep the two flows from overwriting each other; a run overlapping the daily close at 23:55 is not expected at 09:00.
- [Two reservations of one customer on the same day] → two emails, one per reservation, each with its own model. Accepted; the app has no customer id to group by.
- [Consent is implied by giving an email (Essential decision)] → reminders concern only that reservation and go only to its own email.

## Open Questions

- Exact Spanish wording of the "what happens at the deadline" line, to review with Marisa; the email works without changing the flow if the text changes.
