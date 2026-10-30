# Proposal

## Why

More customers pay their deposits by Bizum or bank transfer. Marisa has to read the bank notices, guess which reservation each payment belongs to and write it in by hand, and some payments slip through (story HU-03, flow 03). This is the most valuable and the riskiest Essential flow: a payment recorded against the wrong reservation is worse than one left for review.

## What Changes

- User-authorized extension to the application: optional `Idempotency-Key` support for payment registration, with atomic persistence, original-response replay, conflict rejection and no duplicate receipt event. Existing API callers remain compatible. This protects retries of the same identified payment, not different keys accidentally assigned to one bank transaction.

- Add an n8n workflow, `03 Remote Deposits`, that watches the shop's Infomaniak inbox for bank notices.
- Ignore emails that are not payments (such as bank advertising).
- Use a free AI model **only to extract** payer, amount, concept and type from the email text. Validate its output.
- Let the flow, not the AI, decide which reservation the payment belongs to (number in the concept, then payer-name matching) and call the app's API to register the deposit as `bizum`.
- When the payment is doubtful, or the app rejects it (overpayment, past deadline), register nothing and email Marisa with the payment details and the reason.
- Never send the customer a message from this flow: the app's `abono.registrado` event triggers the receipt flow (flow 02).
- Protect repeated payment registration with stable keys; explicitly report uncertain outcomes rather than claiming exactly-once mailbox delivery.

## Approved delivery cut (2026-10-27)

Subsequently authorized: a small Manual Trigger and single-case selector inject
existing fixture JSON without sending email. Stable case identifiers permit
replay checks; no new mailbox runner or all-cases financial batch is introduced.

The user explicitly deferred the protected approval form and a new mailbox test
runner, requesting a two-hour implementation timebox. Deliver manual-review SMTP,
conservative matching, guarded registration and minimal isolated tests. No
exactly-once mailbox processing, review-email delivery or manual-entry
reconciliation is claimed. Registration uses persistent application keys plus a
content fingerprint to flag identical notices under different message IDs.

## Capabilities

### New Capabilities
- `remote-deposit-registration`: bank notices for Bizum and transfers turn into correct deposits in the right reservation, or into a clear question to Marisa, without ever guessing.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/03-remote-deposits.json`, without credentials.
- **Credentials/config:** the shared SMTP and IMAP credentials, the Groq credential (already configured in n8n), a Header Auth credential `X-API-Key` for the app, `TIENDA_EMAIL_AVISOS`, and the bank sender filter.
- **App API used:** `GET /api/apartados?estado=activo`, `POST /api/apartados/{id}/abonos`. The app enforces the rules (positive amount, not above pending, active and within deadline) and answers 422 with a readable message.
- **Data sent to the AI model:** only the email text. No customer list, phones or emails.
- **Test data:** the nine sample emails in `data/correos/` (the README says eight; the folder holds nine files, one of them advertising).
- **Refines a recorded decision:** the payer-name matching rule (see `docs/decisions-clarify.md`, "Payer-name matching refinement").
- Depends on flow 02 (receipt) and flow 08 (error workflow).
- **Owner:** David (@davidlafuentem) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #3 · `feat/3-remote-deposits` (PR targets `dev`).
