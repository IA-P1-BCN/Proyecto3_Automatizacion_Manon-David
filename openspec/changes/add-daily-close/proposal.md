# Proposal

## Why

Marisa closes the till every day by adding up sales and deposits with a calculator, late and with mistakes (story HU-04, flow 05). The app already knows every sale and deposit; n8n can add them up each night by payment method and keep a history she can open.

## What Changes

- Add an n8n workflow, `05 Daily Close`, scheduled at 23:55 Europe/Madrid, covering the current day.
- Read the day's direct sales and deposits (initial deposits included) from the app's API.
- Total them per payment method (cash, card, Bizum) and overall, and email Marisa a Spanish summary. Bizum includes bank transfers.
- A day with no movements produces a summary that says so, not an error.
- Save the close to `basedatos.csv` in an existing kDrive folder. Create once, then update by file ID with an ETag precondition; one row per date, updating on rerun. CSV uses UTF-8 BOM, semicolons, decimal commas and CRLF.
- Allow a manual close for a chosen date; email is opt-in for manual runs and enabled for the schedule.

## Capabilities

### New Capabilities
- `daily-close`: every night Marisa gets a correct cash summary by payment method and a history of closes she can inspect.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/05-daily-close.json`, without credentials.
- **Credentials/config:** shared SMTP, shop Header Auth `X-API-Key`, kDrive Header Auth `Authorization: Bearer ...` (local name `token_n8n`), `KDRIVE_DRIVE_ID`, `KDRIVE_DIRECTORY_ID`, `TIENDA_EMAIL_FROM`, and `TIENDA_EMAIL_AVISOS`. No secrets or real addresses in exports.
- **App API used:** `GET /api/ventas?desde&hasta` and `GET /api/abonos?desde&hasta`, with dates `YYYY-MM-DD`, both bounds inclusive.
- **Boundary:** transactions dated that day but registered after 23:55 require a manual recalculation of that date. Date-filtered API calls do not automatically move them into the next day's close.
- Depends on flow 08 (error workflow). Unlike event flows, it does not depend on webhooks: it reads the API, so a missed event never affects it.
- Customer-facing (Marisa's) text is Spanish.
- **Owner:** David (@davidlafuentem) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #4 · `feat/4-daily-close` (PR targets `dev`).
