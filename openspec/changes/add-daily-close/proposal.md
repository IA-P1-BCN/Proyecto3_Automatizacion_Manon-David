# Proposal

## Why

Marisa closes the till every day by adding up sales and deposits with a calculator, late and with mistakes (story HU-04, flow 05). The app already knows every sale and deposit; n8n can add them up each night by payment method and keep a history she can open.

## What Changes

- Add an n8n workflow, `05 Daily Close`, scheduled at 23:55 Europe/Madrid, covering the current day.
- Read the day's direct sales and deposits (initial deposits included) from the app's API.
- Total them per payment method (cash, card, Bizum) and overall, and email Marisa a Spanish summary. Bizum includes bank transfers.
- A day with no movements produces a summary that says so, not an error.
- Save the close to a Google Sheet, one row per date, updating the row when the close is rerun.
- Allow the close to be run by hand for a chosen date, to recover a night the flow did not run.

## Capabilities

### New Capabilities
- `daily-close`: every night Marisa gets a correct cash summary by payment method and a history of closes she can inspect.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/05-daily-close.json`, without credentials.
- **Credentials/config:** the shared Gmail credential, a Header Auth credential `X-API-Key`, a Google Sheets credential, the sheet ID (configuration, not in the JSON), and `TIENDA_EMAIL_AVISOS` for the recipient.
- **App API used:** `GET /api/ventas?desde&hasta` and `GET /api/abonos?desde&hasta`, with dates `YYYY-MM-DD`, both bounds inclusive.
- **Boundary:** anything registered after 23:55 falls in the next day's close (decided).
- Depends on flow 08 (error workflow). Unlike event flows, it does not depend on webhooks: it reads the API, so a missed event never affects it.
- Customer-facing (Marisa's) text is Spanish.
- **Owner:** David (@davidlafuentem) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #4 · `feat/4-daily-close` (PR targets `dev`).
