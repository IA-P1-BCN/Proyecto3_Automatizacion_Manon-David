# Design

## Context

Observed in the app (`backend/models/apartado.py`): `vencer` fails with a business-rule error (HTTP 422) when the reservation is not `activo` or when the real today is not after `fecha_limite`; otherwise it sets `vencido`, inserts the voucher (`VALE-<id>`, `importe` = `abonado`) and returns `{ apartado, vale }`. It also sends the `apartado.vencido` event, which the router (flow 00) currently ends silently ("unhandled event"). The app uses its own real date, so a manual run with a past `fecha` can only narrow what is expired, never widen it.

Patterns to follow: flow 06 (schedule in Madrid time, manual trigger with a date override, pure date helpers in `workflows/code/06-due-reminders.js`, Spanish formatter, missing-email rule) and flow 02 (SMTP, error output on Send Email).

## Goals / Non-Goals

**Goals:** late reservations are expired and notified without a person; Marisa knows which shoes return to sale; a re-run or a partial failure never duplicates a voucher email and never silently loses one.

**Non-Goals:** reminders (HU-06); expiring from the app screen; voucher redemption; catching up beyond what the next daily run already does; AI-written text; changing the app.

## Decisions

1. **Separate workflow `06b Expired Reservations`, same schedule idea as flow 06.** The README maps HU-06 and HU-07 to "flow 6", but they are different issues, owners of different PRs (#6, #7) and have different effects (reminders send mail only; this one changes state in the app). Keeping them apart means a failure expiring a reservation cannot block reminders, and each flow is simple to test. The file is `06b-expired-reservations.json`. Schedule `5 9 * * *` (Europe/Madrid), five minutes after flow 06 so the two executions do not overlap in the log. *Alternative:* one flow doing both; rejected for the blast-radius reason above.

2. **Selection in a tested Code node: `estado = activo` and `fecha_limite < run date`** (string comparison of `YYYY-MM-DD`, the date helpers from flow 06 reused by copy into the generator, as the other flows paste their pure code). Strictly before, matching the app's `today <= fecha_limite` rejection, so the deadline day itself is still valid. The flow never reads `abonado` or `pendiente`.

3. **Idempotency comes from the app, not from a record.** After a successful `vencer` the reservation is `vencido` and is no longer returned by `?estado=activo`, so a second run finds nothing. No kDrive file, unlike flow 06: expiry is a one-way state change, there is no "already sent" to remember. A concurrent double expiry is rejected by the app (422) and reported, never duplicated.

4. **One item per reservation, each call with the error output enabled.** `HTTP Request` `POST /api/apartados/{id}/vencer` (shop Header Auth, `onError: continueErrorOutput`) so a 422 or a network error on one reservation goes to a failure branch while the rest continue. Successful responses carry `{ apartado, vale }` and are the only source for the emails.

5. **Customer email from the response, not from the listing.** The Code node builds the email from `apartado` (producto, talla, email) and `vale` (codigo, importe) exactly as returned, with the formatter style of flow 02 (`5,00 €`). Subject: "Tu apartado ha vencido: aquí tienes tu vale". The text says the amount paid became a store voucher and is not refunded in cash (rule from the assignment and the ontology). *Assumption to confirm with Marisa:* the exact wording, and whether the voucher has an expiry date (the app has none, so none is mentioned).

6. **Missing or bad `email` (empty or no `@`, same rule as flows 01, 02 and 06): no customer email**; the reservation is listed in the shop summary under "avisar a mano" with its voucher code. A bounced customer email is treated the same way (it moves to that section) and also fails the run.

7. **One shop summary per run, built after all expiries.** An `Aggregate` of the successful expiries feeds a Code node that produces a Spanish email to `TIENDA_EMAIL_AVISOS`: a list "Zapatos que vuelven a la venta" (producto, talla, cliente, vale) and a second list "Clientes a avisar a mano". No summary when nothing expired. The shoes list is exactly the expired reservations; the flow does not touch stock because the app has none.

8. **Order and failure policy.** list → select → expire each → email each customer → summary → `Verify Result` Code node that throws when any expiry, customer email or summary failed (message names the reservation ids, no secrets) → flow 08 alerts. Because the expiry is committed before the emails, an email failure after a successful expiry cannot be retried by re-running (the reservation is no longer listed); that is why the summary always carries the voucher code of every customer who was not emailed, so Marisa can act.

9. **Router stays unchanged.** `apartado.vencido` is still ignored by flow 00, so the app's event after each expiry does not trigger a second email. Consequence: an expiry done by hand from the app screen sends no voucher email (see Open Questions).

10. **Testing data.** The seed data has one reservation already `vencido` and some `activo` ones; for a real run, create reservations with a past deadline using the `fecha` field (migration use) of `POST /api/apartados` or the demo-data flow, with your own email. The app's own date limits what a manual `fecha` can do (decision context above).

## Risks / Trade-offs

- [Expiry committed, then the customer email fails] → the customer is not re-emailed automatically. The failure fails the execution (flow 08 alert) and the summary lists the customer with the voucher code, so Marisa tells them. Accepted at Medium level, documented.
- [n8n down at 09:05] → nothing is lost: the next run expires everything still past its deadline (the selection is "before today", not "yesterday"). Only the delay differs.
- [Reservation expired by hand in the app] → no customer email from n8n. Documented; handling the event is the alternative in Open Questions.
- [Mass expiry on the first run with migrated data (HU-10)] → many emails at once. Accepted; the summary stays one email, and SMTP errors are surfaced per reservation.
- [App date versus flow date] → around midnight the flow's Madrid date and the app's date can differ by a day; the app then answers 422 and the reservation is expired the next day. Reported as a failure, harmless.
- [Consent is implied by giving an email (Essential decision)] → the voucher email concerns only that reservation and goes only to its own email.

## Open Questions

- Exact Spanish wording of the voucher message, to review with Marisa.
- Handle `apartado.vencido` in the router instead (one handler, covers expiries done from the screen, but loses the one-summary-per-run and the retry story)? Left for after Medium if Marisa expires by hand.
