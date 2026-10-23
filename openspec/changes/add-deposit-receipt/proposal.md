# Proposal

## Why

A customer who pays a deposit should get proof of it and know what is still owed, and a customer who finishes paying should be told they can collect their shoes (story HU-02, flow 02). It is also the step that closes the loop for remote payments: flow 03 registers a deposit in the app, the app announces it, and this flow sends the receipt.

## What Changes

- Add an n8n sub-workflow, `02 Deposit Receipt`, called by the event router for each `abono.registrado` event.
- Email the customer, in Spanish, a receipt with the amount just paid and what remains pending.
- When the reservation became settled (`liquidado`), send a different message saying the shoes can be collected.
- If the customer has no usable email, email the shop instead and finish successfully.
- Do not send receipts from flow 03 itself; every deposit, wherever it came from, produces its receipt through this flow.

## Capabilities

### New Capabilities
- `deposit-receipt`: every registered deposit gives the customer a receipt, and a settled reservation tells them they can collect their shoes.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/02-deposit-receipt.json`, without credentials.
- **Uses:** the shared SMTP credential, the event router, and `TIENDA_EMAIL_AVISOS`.
- **Event source:** `abono.registrado` is sent by the app for deposits made from its screen and from the API alike. The initial deposit of a new reservation does **not** produce this event (it is part of `apartado.creado`, flow 01).
- Flow 08 must be set as this flow's *Error Workflow*. Customer-facing text is Spanish.
- No change to `backend/` or `frontend/`.
- **Owner:** Manon (@ManonChab) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #2 · `feat/2-deposit-receipt` (PR targets `dev`).
