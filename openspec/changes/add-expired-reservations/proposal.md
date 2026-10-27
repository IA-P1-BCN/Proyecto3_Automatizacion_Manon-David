# Proposal

## Why

When a reservation passes its deadline the app does **not** close it: it stays `activo` until someone calls `POST /api/apartados/{id}/vencer`, which is when the app creates the voucher (story HU-07, Medium level). Today Marisa would have to find the late reservations and expire them one by one, then tell each customer about the voucher and put the shoes back on sale by hand. Nothing in n8n does this yet.

## What Changes

- Add flow `06b Expired Reservations`, started by a Schedule Trigger every morning (09:05, Europe/Madrid) and by a manual trigger for tests.
- Read `GET /api/apartados?estado=activo` and select the reservations whose `fecha_limite` is **before** the run date (Madrid date).
- Expire each one with `POST /api/apartados/{id}/vencer`. The app creates the voucher and returns `{ apartado, vale }`; the flow never calculates the voucher or any amount.
- Send each customer a Spanish email with the voucher `codigo` and `importe` exactly as the app returned them, and a note that the voucher is store credit, not cash.
- Send Marisa **one** Spanish summary email per run with the list of shoes (`producto`, `talla`) that go back on sale, plus the reservations whose customer could not be emailed (no valid `email`, or a bounced email) with their voucher code, so she can tell them herself.
- Process the reservations one by one: a failure on one (the app refuses, the email bounces) does not stop the others; the run fails at the end so flow 08 alerts.
- Idempotent without a record file: once expired, a reservation is `vencido` and is no longer listed, so a re-run does nothing for it.
- Keep the router as it is: `apartado.vencido` is still ignored there, so the voucher email is sent only by this flow (no duplicate).
- Document the schedule and the manual run in the README changes and the AI log.

## Capabilities

### New Capabilities
- `expired-reservations`: reservations past their deadline are expired through the app, the customer is told the voucher code and amount, and Marisa gets the list of shoes back on sale.

### Modified Capabilities

None in `openspec/specs/` (it is still empty).

## Impact

- **New files:** `workflows/06b-expired-reservations.json` (no credentials), its generator, pure-logic code and tests under `workflows/code/`, and `workflows/tests/06b-expired-reservations.md`, following flows 02 and 06.
- **No router change and no app change.**
- **New config:** none. Reuses `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS`, the shop Header Auth and the SMTP credential. No kDrive: nothing needs a sent-record (see design).
- **Depends on:** flow 08 (merged) and the date helpers of flow 06 (`workflows/code/06-due-reminders.js`, on branch `feat/6-due-reminders` until PR #6 is merged into `dev`).
- **Rules kept:** the app is the source of truth for state, voucher and amounts; the flow only compares `fecha_limite` with today's date. No AI. Cash is never refunded; the amount paid only becomes a voucher.
- **Out of scope:** expiring from the app screen (the `apartado.vencido` event carries no email from this flow), reminders (HU-06), the monthly report count of expired reservations (HU-08), a customer-facing voucher redemption flow, per-customer consent (HU-14).
- **Owner:** Manon.
- **Issue · branch:** #7 · `feat/7-expired-reservations` (from `dev`, PR targets `dev`).
