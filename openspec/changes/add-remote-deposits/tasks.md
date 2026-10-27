# Tasks

## 0. Authorized application payment safety extension

- [x] 0.1 Add optional Idempotency-Key support: atomic payment/key/response persistence, identical replay, conflicting-key rejection, no duplicate event and backward compatibility.
- [x] 0.2 Verify replay after settlement and database reinitialization, concurrent requests, changed inputs, invalid keys, rejected payments and transaction rollback with isolated tests; document usage and remaining webhook-delivery limitations.
- [x] 0.3 Implement and locally test deterministic source identity and possible-duplicate classification, separating stable identifiers from email-content fingerprints. This does not complete durable workflow tracking or IMAP integration.
- [x] 0.4 Generate and test the initial credential-free extraction draft. User later imported it and verified Carmen extraction and advertising classification with actual Groq; those observations are not final financial-path integration.
- [x] 0.5 Complete the approved essential workflow: matching, refreshed eligibility, installed-capability guard, keyed registration, content-duplicate review, manual SMTP notice and uncertain-write escalation. Verify locally with seeded API smoke and a disposable n8n graph with mocked external services; retain safe default gates.
- [x] 0.6 With explicit authorization, back up and rebuild only the local shop service; verify installed API capability, unchanged API counts/state summary and connectivity from n8n without financial writes.
- [x] 0.7 Add Manual Trigger and single-case selector, later extended to case 10 without changing the user's canvas. User-editor preview, financial write and replay were verified for the dedicated fixture.

## 1. Inputs and credentials

- [x] 1.1 User verified Resolved IMAP reception, controlled sender/subject true/false routing and clean new-message reception. Final tested export retains these nodes and configuration; no real-bank authenticity claim.
- [x] 1.2 Verify actual Groq `openai/gpt-oss-20b`: user-editor cases 01/04/08 plus agent-executed real-provider cases 02/03/05/06/07/09 all produced expected extraction/classification. No second-model comparison claimed.
- [x] 1.3 Associate shop Header Auth and verify reservation lookup from n8n: user-confirmed case 10 preview/registration demonstrates successful all-reservation and detail GETs with the selected credential.

## 2. Extraction and validation

- [x] 2.1 Wire stable Message-ID key and content fingerprint independently of mark-as-read; verify persistent registration replay/conflicting-content protection in isolated API tests. Mark-as-read only manages inbox reception; no exactly-once delivery claim.
- [x] 2.2 Prompt sends only subject/body; all nine examples checked with actual Groq across user-editor and temporary CLI tests. Six remaining cases passed exact payer/amount/concept/type comparisons; advertising was ignored, missing concept requires review.
- [x] 2.3 Write the validation Code node (non-empty payer, numeric amount > 0, allowed type, amount present in the email text) and verify it against good output, invented amount, non-JSON output and an advertising email; keep cases in `workflows/tests/03-remote-deposits.md`. Verified with local mocked/embedded-code tests, not real Groq or editor execution.

## 3. Matching and registration

- [x] 3.1 Write the matching Code node (number in concept, contained name, abbreviated payer plus product, exactly-one rule, normalisation) and verify all nine cases against an isolated seeded API snapshot with mocked extraction. Real mailbox evaluation remains under 4.1.
- [x] 3.2 User verified case 10 registered EUR 1 on dedicated local #25. Agent read-only API check confirmed exactly one EUR 1 abono, EUR 6 paid and EUR 14 pending.
- [x] 3.3 User confirmed case 04's overpayment review email arrived. Other refusal/ambiguity templates and routing have isolated coverage, not all-case real SMTP execution.

## 4. Test against all sample emails

- [x] 4.1 Approved minimal test substitution: IMAP reception checked separately; all nine examples passed real-Groq extraction and matching via editor/manual injection. Cases 02/03/09 are eligible previews, not nine live financial writes. Dedicated #25 registration/replay and isolated API tests cover the financial operation; see evidence table and `groq-live-results.json`.
- [x] 4.2 Actual app API abono on controlled reservation #26 triggered a temporary copy of the repository router/HU-02; user confirmed receipt with EUR 1 and EUR 14 pending. HU-03 sends no customer receipt. This is the shared app-event receipt integration, not a second HU-03 financial write.
- [x] 4.3 Approved minimum replay test: user explicitly ran case 10 twice and verified unchanged EUR 6 paid/EUR 14 pending; agent independently confirmed one EUR 1 payment via API. This does not claim real replay testing of all nine sample emails.
- [x] 4.4 Approved minimal automatic-error test: authenticated curl POST to a temporary protected copy of 99 Error Test triggered the existing published HU-05; user confirmed expected workflow/step/message. Did not stop the shop or claim a live HU-03 transport-failure test. All temporary test publications were removed afterwards.

## 5. Export and docs

- [x] 5.1 Local tested export references the same Error Workflow used in the successful automatic test. Canonical sanitized export retains tested layout/code, no local credentials/addresses/pinned data, and documents per-instance Error Workflow reassociation.
- [x] 5.2 Document IMAP, Groq, shop Header Auth, SMTP and local configuration field names in the README/setup; document subject/body-only external AI data and false-by-default write/notice gates.
- [ ] 5.3 Log prompts, model comparison and agent errors in `docs/ai-log.md`, open the PR and verify the other teammate reviewed it.

## Workflow follow-up

- Archive this change after the PR is merged.
