# Proposal

## Why

The assignment asks for "a test flow or script that creates example data in the app by API so the demo can be run" (deliverable 4, issue #20). The app's own seed data covers old activity, but a live demo needs a fresh, known story (create, deposits, settle, expire) that fires the app events through flows 01 and 02 on demand, and that can be rebuilt after the data is cleared.

## What Changes

- Add an n8n flow, `90 Demo Data`, started by hand (Manual Trigger). It creates five demo reservations through the app API and registers the deposits that tell the full story: a reservation with a partial deposit, one settled by a final deposit, one paid in full at creation, one without email, and one already past its deadline that is still `activo` (ready for the expiry flow to expire).
- Demo customers are recognisable by the suffix `(demo)` in `cliente`. The flow creates a demo reservation only if no reservation with that customer name exists, so running it twice duplicates nothing.
- Demo customers that have an email use the shop alert address `TIENDA_EMAIL_AVISOS`, so the confirmations and receipts of flows 01 and 02 land in the team's inbox and never reach a real customer.
- Calls the app at `http://tienda:8000` with the shared *Header Auth* credential (`X-API-Key`).

## Capabilities

### New Capabilities
- `demo-data-loading`: one manual run leaves the app with a known set of demo reservations covering every state and case the Essential flows react to, without duplicating them on a second run.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/90-demo-data.json`, without credentials; test notes in `workflows/tests/90-demo-data.md`.
- **Uses:** the app's `GET /api/apartados`, `POST /api/apartados` and `POST /api/apartados/{id}/abonos`; the Header Auth credential; `TIENDA_EMAIL_AVISOS`. No new variable and no change to `docker-compose.yml` or `.env.example`.
- **Side effects, by design:** every created reservation and deposit makes the app send its event to the router, so flows 01 and 02 send real emails to `TIENDA_EMAIL_AVISOS` when they are published.
- **Never activated:** the flow only runs on a manual trigger; it is not published and nothing schedules it.
- **No change** to `backend/` or `frontend/`.
- **Owner:** Manon (@ManonChab) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #20 · `feat/20-demo-data-flow` (PR targets `dev`).
