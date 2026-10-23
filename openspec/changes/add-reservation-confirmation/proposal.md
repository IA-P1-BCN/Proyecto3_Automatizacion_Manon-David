# Proposal

## Why

When a customer reserves a pair of shoes they should immediately know what they reserved, what they paid, what is left and until when (story HU-01, flow 01). Today nothing is sent, which causes disputes and forgotten reservations.

## What Changes

- Add an n8n sub-workflow, `01 Reservation Confirmation`, called by the event router for each `apartado.creado` event.
- Email the customer, in Spanish, with model, size, price, amount paid, amount pending and deadline, using the figures the app sends.
- If the customer has no usable email, do not fail: email the shop saying the confirmation could not be sent, with enough detail to contact the customer.
- If the reservation is already fully paid at creation, say the customer can pick up their shoes.

## Capabilities

### New Capabilities
- `reservation-confirmation`: a customer receives a clear, correct summary of a new reservation within a minute, and the shop is told when that is impossible.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/01-reservation-confirmation.json`, without credentials.
- **Uses:** the shared Gmail credential; the event router (`add-event-router`); the alert address `TIENDA_EMAIL_AVISOS`.
- **Customer-facing text** is Spanish; flow and node names are English.
- **No change** to `backend/` or `frontend/`. Flow 08 must be set as this flow's *Error Workflow*.
- Consent: a customer who gave an email is assumed to accept notices about their own reservation (decision recorded).
- **Owner:** Manon (@ManonChab) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #1 · `feat/1-reservation-confirmation` (PR targets `dev`).
