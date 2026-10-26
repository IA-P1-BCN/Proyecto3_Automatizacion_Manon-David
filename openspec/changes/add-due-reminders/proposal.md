# Proposal

## Why

A customer who forgets the deadline loses the shoes and gets only a voucher for what was paid (story HU-06, Medium level). The app never warns anyone before `fecha_limite`; it only exposes the reservations. Nothing in n8n reads them on a schedule yet.

## What Changes

- Add flow 06, `06 Due Date Reminders`, started by a Schedule Trigger every morning (09:00, Europe/Madrid) and by a manual trigger for tests.
- Read `GET /api/apartados?estado=activo` and select the reservations whose `fecha_limite` is exactly 7 days or exactly 1 day after today (Madrid date).
- Send each of them a Spanish email with the model, size, amount still pending, amount paid and the deadline, all taken from the API as sent. The 1-day email is worded as "mañana".
- Send each reminder **once**: a sent-mark per reservation and threshold (`apartado_id`, `umbral`) is kept in a CSV in kDrive, next to the daily-close history, and checked before sending.
- When a reservation has no valid `email`, send nothing to the customer, email the shop instead and mark it as handled, so a re-run does not alert twice.
- Wire flow 08 as the Error Workflow; an API, kDrive or SMTP failure fails loudly.
- Document the kDrive file and the schedule in the README changes and the AI log.

## Capabilities

### New Capabilities
- `due-date-reminders`: customers are warned 7 days and 1 day before their reservation's deadline, once each, with the amounts the app gives.

### Modified Capabilities

None in `openspec/specs/` (it is still empty).

## Impact

- **New files:** `workflows/06-due-reminders.json` (no credentials), its generator, pure-logic code and tests under `workflows/code/`, and `workflows/tests/06-due-reminders.md`, following flows 02 and 05.
- **No router change:** the flow is time-driven and does not depend on a webhook event (the app never retries events, see `docs/guia-de-la-app.md`).
- **New config:** none. Reuses `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS`, `KDRIVE_DRIVE_ID`, `KDRIVE_DIRECTORY_ID`, the shop Header Auth, the kDrive Header Auth and the SMTP credential (flow 05 and 02).
- **Shared with David:** the kDrive folder and credential belong to HU-04. This flow writes a separate file (`avisos.csv`), never `basedatos.csv`.
- **Depends on:** flow 08 (merged) and the kDrive setup from `docs/daily-close-setup.md`.
- **Rules kept:** the app is the source of truth for amounts and dates; the flow only compares `fecha_limite` with today's date and never recalculates `pendiente`. No AI is used.
- **Out of scope:** expiring overdue reservations and the voucher email (HU-07), AI-written reminders (Advanced), reminders by Telegram, catching up on a day when n8n was down, per-customer consent tracking (HU-14).
- **Owner:** Manon.
- **Issue · branch:** #6 · `feat/6-due-reminders` (PR targets `dev`).
