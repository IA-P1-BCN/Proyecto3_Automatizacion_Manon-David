# Design

## Context

Issue #3 — HU-03 · Abonos por Bizum o transferencia sin apuntar nada a mano.
The user approved a two-hour timebox and explicitly deferred automated approval
forms and new automated mailbox tooling. They subsequently authorized a small
manual synthetic-input branch using existing fixtures, not an email test runner.
Doubtful payments are emailed to Marisa
for manual resolution. The authorized backend exception is limited to safe
payment registration and content-duplicate protection. See proposal and specs.

## Goals / Non-Goals

**Goals:** an importable complete essential workflow with guarded registration,
manual-review notices, isolated minimum checks and honest evidence boundaries.

**Non-Goals:** approval form, reading email replies, automatic reconciliation of
manual app entries, universal bank formats, customer messaging from this flow,
guaranteed event delivery or unattended production readiness.

## Decisions

1. **IMAP and controlled test scope.** Resolved format avoids the observed Simple
   encoding corruption. Read UNSEEN and mark received notices read to keep guided
   tests manageable. This is not duplicate protection. Retain the tested sender
   and TEST HU03 subject filter; publication and any real-bank sender/authentication
   policy remain separate authorized work. Configured senders are placeholders.

2. **Data and model.** Send only subject/body to Groq with extraction-only,
   untrusted-input instructions and a strict four-field nullable schema. The
   candidate `openai/gpt-oss-20b` extracted Carmen and classified advertising in
   user-reported editor tests of the previous extraction draft. This does not
   prove all nine actual-model cases. Validate labelled amount/payer/concept,
   precision, type and complete model response before matching. Technical failures
   stop; semantic doubt routes to Marisa.

3. **Identity.** Two built-in Crypto SHA256 nodes produce an account-scoped
   Message-ID key and a separate subject/body fingerprint. Account scope must be
   stable. The adapter does not invent bank references or identify payments from
   amount alone. The standalone identity helper remains supporting test material;
   the workflow uses Crypto nodes rather than requiring crypto in Code sandboxes.

4. **Matching.** Read all reservations without pagination and check X-Total-Count
   when present. Explicit apartado reference takes priority but an incompatible
   payer requires review. Otherwise use normalized contained full-name tokens;
   abbreviated first name and surname initial additionally require product
   confirmation. A small explicit singular/plural dictionary supports fixture
   product names, not fuzzy scoring. Multiple matching reservations, including
   final/overdue ones, require review: eligibility never manufactures identity.
   Balance, state and deadline come from the API. Overpayment and overdue cases
   route to review; refresh selected detail immediately before writing. The API
   validates again atomically. No reassigning explicit-reference overpayments.

5. **Application retry safety.** Optional Idempotency-Key persists request hash and
   original response in the payment transaction. Replay returns that snapshot
   without another event; different inputs return 409. Optional
   Payment-Notice-Fingerprint stores the account-scoped content digest with a
   unique index: identical content under another key returns 409 for review, not
   silent suppression. Changed content under one key also conflicts. Both headers
   are sent by HU-03. An OpenAPI capability check blocks registration if the
   running app does not expose both headers. Rebuild is required; the agent does
   not mutate the live database. Additive schema initialization preserves records.

6. **No blind financial retries.** No automatic POST retry. 404/409/422 route to
   review. Network/other failures are uncertain: try to notify Marisa, instruct her
   to inspect before manual entry, and fail for HU-05. A retry must retain the same
   message, key, content and POST data. A final-state reservation may instead go
   to manual review on replay; that is safe and is not proof of another payment.

7. **Manual review.** Spanish SMTP notice includes payer, amount, real payment
   type, reason and up to 20 candidate contacts. No customer receives this notice.
   Missing concept preserves extracted payer/amount for candidate review. No
   approval link or interpretation of replies exists. After manual registration,
   the notice must not be automatically reprocessed: manual UI entries do not
   share its key. That limitation is explicit, not a false exactly-once claim.

8. **Gates and errors.** Export inactive and credential-free, Groq node disabled;
   external AI, financial writes and shop notices each default false. Associate
   IMAP, Groq, shop Header Auth and SMTP locally, and select local 08 Error Workflow
   in settings. No portable error-workflow ID can be assumed. HTTP read failures
   stop safely. Registration success relies on the app event for HU-02 and never
   sends another receipt itself. Original personal export is left untouched.

## Risks / Trade-offs

- **Different genuine payments with identical text:** conservative 409/manual
  review. A content hash does not establish banking identity.
- **Reworded duplicate notices with different IDs:** not detected universally;
  verified bank transaction references would be needed for stronger identity.
- **Lost receipt event after commit:** existing best-effort webhook still lacks
  an outbox; idempotent replay deliberately does not resend events.
- **Mark-read followed by failure:** HU-05 and saved execution/manual review are
  required. No durable case/approval queue was delivered in the cut scope.
- **Repeated review notices:** possible on manual reprocessing; no one-time SMTP
  guarantee is claimed.

## Migration Plan

Review/rebuild only the shop service to install authorized backend changes; never
reset volumes. Import the generated workflow as a draft, reassociate credentials,
choose local Error Workflow, configure controlled addresses and retain false
write/notice gates until the intended test effects are approved. Verify first in
preview, then a controlled eligible payment, rejection and replay. Roll back by
disabling the workflow; do not delete payment records or deduplication history.
