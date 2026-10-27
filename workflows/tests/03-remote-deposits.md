# Flow 03 test contract

Issue #3 — HU-03 · Abonos por Bizum o transferencia sin apuntar nada a mano.

## Complete essential delivery checks (2026-10-27)

The user accepted manual resolution instead of an approval form and requested a
two-hour timebox. The canonical JSON now includes the full guarded financial path.

- Node helper/embedded-code checks: extraction, source identity, matching,
  eligibility, conflicts, candidate contacts, capability check and uncertain writes.
- Real temporary shop API: seeded all nine notices, clear registration, identical
  replay, overpayment refusal and duplicate-content conflict. Groq outputs are
  mocked and real webhook delivery is disabled.
- Disposable n8n: a test-ID copy imported successfully. The graph executed with
  actual Crypto/IF/Set/Code nodes and paired items, synthetic Carmen/Laura/advertising
  inputs, and mocked Groq/API/SMTP nodes, network disabled and no user's volumes.
  Exactly one item reached payment success, one reached the shop-notice endpoint
  and one reached ignore. This proves branch traversal, not live financial integration.

Run checks from repository root:

```sh
node --test workflows/code/03-extract-bank-payment.test.js workflows/code/03-payment-identity.test.js workflows/code/03-match-bank-payment.test.js
```

And from `backend/`, using an environment with its requirements installed:

```sh
python -m pytest tests -q -p no:cacheprovider
```

## Evidence boundaries

The user reported local IMAP connection success after using the device mailbox
password, correct accents in Resolved subject/body, a top-level `messageId`,
and positive/negative IF routing for allowed/disallowed test subjects. These
observations apply to the original two-node export, not the new generated draft.
No personal email headers or credentials are saved as test fixtures.

Local tests execute helper and embedded Code-node logic with mocked model output;
they do not call Groq, send mail, import a workflow or register payments. The
candidate model has not been evaluated on the sample emails.

## Extraction layer only

| Fixture | Expected extraction-layer outcome | Later matching/registration expectation, not tested here |
| --- | --- | --- |
| 01 | extracted | Match clear reservation |
| 02 | extracted | Resolve explicit reservation number |
| 03 | extracted | Validate exact settlement against current API balance |
| 04 | extracted | Reject overpayment; extraction alone cannot know the balance |
| 05 | review — missing concept | Ask Marisa |
| 06 | extracted | Reject overdue reservation after API lookup |
| 07 | extracted | Unknown payer goes to Marisa |
| 08 | ignored | No payment/notice |
| 09 | extracted | Match clear reservation |

Every extraction-layer result has `registration_allowed=false`.

Additional local cases: empty/missing/oversized inputs, missing Message-ID,
invalid JSON, wrong fields/types, truncated model response, invented amount,
invented payer/concept, nonpositive amount, excess precision, unsupported type,
pending operation, inconsistent nonpayment classification, HTTP failure, minimal
external data, safe defaults, valid connections and executable embedded code.

Identity tests separately cover same-message replay, changed content under one
identifier, identical content under different identifiers, receiving-account
isolation and all nine raw fixtures without identifiers. Synthetic transport
identifiers are injected only within tests; no real bank reference is fabricated.

## Pending local editor checks

- Import generated draft and associate local IMAP; configure controlled sender.
- Verify both filter outputs again after import.
- Execute preparation and inspect request with AI disabled.
- Associate Groq credential; explicitly enable only after inspecting data sent.
- Run all nine synthetic notices against the actual model and compare outcomes.
- Associate local flow 08 and verify technical-failure behavior separately.
- Final financial editor integration, duplicate behavior against the installed
  shop, actual SMTP notice, customer receipt and HU-05 dispatch remain pending.
  The approved scope has manual resolution, not an automated approval form.
