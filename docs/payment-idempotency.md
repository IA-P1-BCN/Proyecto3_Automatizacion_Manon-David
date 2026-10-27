# Payment registration retry safety — HU-03

Issue #3 — HU-03 · Abonos por Bizum o transferencia sin apuntar nada a mano.

## API contract

`POST /api/apartados/{id}/abonos` accepts an optional `Idempotency-Key` header.
The shop's `X-API-Key` authentication is still required; the payment identifier
is not a secret or an authentication credential.

- Use an opaque identifier of 1–128 ASCII letters, digits, `.`, `_`, `:` or `-`.
- Assign one stable identifier to one bank payment and persist it before sending.
  Never generate a fresh identifier merely because the request is being retried.
- Send the same reservation, amount, payment method and submitted date on retry.
  Omitted date and explicit date are deliberately different requests. Omitting
  date stays identical on retries on another day.
- First success: HTTP 201 and the reservation snapshot after registration.
- Identical retry: HTTP 201 and that original snapshot, without another payment
  or another event. Fetch the reservation separately for its current balance.
- Same identifier with different inputs: HTTP 409; stop and investigate.
- Invalid identifiers or business-rule refusals: HTTP 422. Rejected payments do
  not reserve the identifier. Unexpected failures roll back both payment and key.
- Requests without a key remain supported, but do not gain retry protection.

## Persistence and deployment

HU-03 additionally sends `Payment-Notice-Fingerprint`, an optional 64-character
lowercase SHA256 hex digest scoped to the receiving account and notice text.
It requires an Idempotency-Key. The application persists it with a unique index:
identical content under a different key returns 409 for manual review. The same
key with a changed fingerprint also returns 409. Failed writes consume neither.
This flags possible duplicates, including potentially legitimate equal notices;
it does not prove bank-transaction identity. Different wording/IDs can bypass
content equality, so it is not a universal bank reconciliation mechanism.

The additive upgrade adds a nullable `notice_fingerprint` column if an earlier
version of the key table already exists, retaining old rows. Old rows with no
fingerprint retain key replay protection but cannot support content comparison.

The application creates `payment_idempotency` additively during normal schema
initialization. No existing records are removed or rewritten. The payment,
settlement update, fingerprint and response are committed in one SQLite write
transaction. The identifier is global to payment registration, not scoped to an
individual reservation. It is retained without automatic expiry. Preserve this
table in backups with the rest of the shop database.

Deploy/rebuild the application normally after review; merely importing an n8n
workflow does not install this backend extension. On 2026-10-27 the user authorized
the local rebuild of only `tienda`. The agent backed up the database first and
verified the new API capability plus unchanged business-record counts and state
summary afterwards. Schema changes ran through normal application initialization;
no financial POST was made and n8n was not restarted.

## Limits

This prevents duplicates only when the caller uses the same key for the same
payment. Different email identifiers for two notices about the same bank
transaction are not automatically proof of two different payments. HU-03 must
still define stable payment identity and its pending/manual-resolution tracking.
Manual app entries without the same key are not automatically reconciled.

The existing webhook remains best-effort. A crash after committing a payment
but before sending its event can still lose the receipt event. Retrying the
payment does not resend the event; this avoids duplicate receipts but is not
guaranteed delivery. Reliable event delivery would need a separate design.

Tests use a temporary database with real webhook delivery disabled. They do not
prove local n8n, Groq, mailbox or customer-receipt integration.

## Notice identity component

`workflows/code/03-payment-identity.js` is an independently tested pure helper,
not an imported or executed n8n workflow. A trusted adapter can supply a verified
bank operation reference; otherwise it uses the message's Message-ID, scoped to
the receiving account. Neither identifier is selected or invented by the model.
Keys are versioned SHA-256 digests; the raw reference and message text are not
embedded in the key. The account scope must remain stable across retries and
must not be chosen differently by consumers of the same receiving account.

A separate digest of subject/body flags identical content under different
message IDs as requiring review. It does not silently suppress a potentially
legitimate second payment. Reused identifiers with changed content also require
review. An existing identity routes back to its stored case; it does not imply
the case was successfully registered. Missing history is an error, not an empty
history. Durable storage, atomic claims, pending-case resumption and protected
Marisa approvals are not implemented by this helper.

All nine supplied `.eml` fixtures lack Message-ID headers and bank operation
references. The identity tests verify this and separately inject controlled
transport identifiers without editing the fixtures. Real IMAP identifiers must
still be inspected in the local editor. Raw fixture replay without an identifier
requires review. Content hashing normalizes only outer whitespace and line
endings; it is not a universal detector for reworded or forwarded bank notices.
