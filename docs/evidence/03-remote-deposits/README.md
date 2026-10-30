# Evidence · Flow 03 Remote Deposits (HU-03 / issue #3)

Test notes: `workflows/tests/03-remote-deposits.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

The recording checklist below is retained from Manon's evidence template. Its
`pending` cells describe missing captures, not the absence of implementation or
the outcome of later tests. The detailed verified record from current `dev` is
preserved below; use its explicit scope/limits when reporting actual results.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:**

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | 01 bizum_carmen | Send `data/correos/01_bizum_carmen.eml` | Registers | pending | pending |
| 2 | 02 bizum_jorge | Send `02_bizum_jorge.eml` | Registers by reservation number | pending | pending |
| 3 | 03 transferencia_lucia | Send `03_transferencia_lucia.eml` | Registers and settles | pending | pending |
| 4 | 04 bizum_laura | Send `04_bizum_laura.eml` | Asks Marisa (overpayment) | pending | pending |
| 5 | 05 bizum_romero | Send `05_bizum_romero.eml` | Asks Marisa | pending | pending |
| 6 | 06 bizum_paula | Send `06_bizum_paula.eml` | Asks Marisa (past deadline) | pending | pending |
| 7 | 07 transferencia_desconocido | Send `07_transferencia_desconocido.eml` | Asks Marisa | pending | pending |
| 8 | 08 publicidad_banco | Send `08_publicidad_banco.eml` | Ignored | pending | pending |
| 9 | 09 bizum_silvia | Send `09_bizum_silvia.eml` | Registers | pending | pending |
| 10 | Customer receipts | Check registered payments | Receipt from flow 02; flow 03 emails no customer | pending | pending |
| 11 | Idempotency | Run the same emails twice | No duplicate deposits in the app | pending | pending |
| 12 | App down | `docker compose -p paso-firme stop tienda`, send a payment email | Flow 08 alert; restart `tienda` | pending | pending |

**Notes / deviations:**
---

## HU-03 verification evidence preserved from dev

Issue #3 — HU-03 · Abonos por Bizum o transferencia sin apuntar nada a mano.

## Observed checks — 2026-10-27

- **28 Node.js tests passed** for extraction, identity, matching, graph structure,
  safe defaults and embedded code. **32 backend tests passed** across the full
  existing suite plus HU-03 additions. OpenSpec validation and whitespace checks
  passed. These counts describe executed checks, not live mailbox acceptance.

- Isolated seeded shop API plus actual matching code, with mocked Groq extraction:

| Notice | Decision |
| --- | --- |
| 01 Carmen | Eligible unique reservation |
| 02 Jorge | Eligible explicit reservation reference |
| 03 Lucía | Eligible exact settlement amount |
| 04 Laura | Review — overpayment |
| 05 Romero | Review — missing concept |
| 06 Paula | Review — overdue |
| 07 Unknown payer | Review — no clear match |
| 08 Advertising | Ignore |
| 09 Silvia | Eligible unique reservation |

- Real temporary API recorded Carmen once; repeating unchanged key/data returned
  the same successful response with no second abono or event. Another message key
  with the same content fingerprint returned 409. Laura's overpayment returned
  422 and created no event. These are not writes to the user's shop.
- Concurrent/rejected/conflicting/settlement replay, atomic rollback, authentication
  and additive schema upgrade are covered by backend tests.
- Disposable n8n CLI imported a copy with a test-only workflow ID. Direct CLI import
  without an ID initially failed because the CLI requires a database ID; the
  canonical editor-import file intentionally remains without instance ID.
- Disposable graph execution succeeded with network disabled, no user volumes,
  synthetic inputs and mocked HTTP/SMTP nodes. Actual Crypto, Code, IF and Set
  nodes ran, including multi-item pairing. Confirmed exactly one terminal item for
  Carmen success, Laura shop review and advertising ignore.

## Prior user-reported editor observations

IMAP connected with a device password; Resolved correctly decoded accented
subject/body and supplied Message-ID; test filter accepted/rejected subjects.
Groq extracted Carmen's payer/10 EUR/zuecos/bizum and ignored advertising.
Two-item branching was correct per message. A clean UNSEEN/Mark-as-Read test waited
for a new email and then emitted one item. Full headers and personal addresses
are not copied into evidence.

## Initial fixture checkpoint (superseded by later tests below)

User-authorized local fixture created later on 2026-10-27: reservation #25,
`HU03 Test Customer`, price EUR 20, initial EUR 5, pending EUR 15, active,
deadline 2027-01-25. GET verified one initial payment and no customer email.
This is fixture creation only, not HU-03's additional payment/replay test. Manual
cases 01–09 still target seeded examples; a notice explicitly referencing #25 is
required before testing writes on this fixture.

Actual customer-receipt delivery and automatic HU-05 dispatch from this final
flow were unverified at this checkpoint. Final editor payment/replay and review SMTP were subsequently
confirmed as recorded below. No screenshot or execution
evidence has been fabricated. This file does not declare issue completion.

## Authorized local deployment and manual entry (2026-10-27)

- Checked the running shop API key matches Compose without printing either value.
- Saved a consistent read-only SQLite backup outside Git with restricted file
  permissions before deployment. No customer details were printed in the baseline.
- Ran `docker compose up -d --build --no-deps tienda`; n8n was not restarted.
- Live API exposes both safety headers. Read-only baseline/after comparison showed
  unchanged reservation summary and counts: 24 reservations (16 active, 7 settled,
  1 expired), 83 deposits, 256 sales. No financial POST or notification performed.
- The actual n8n container reached `http://tienda:8000/openapi.json` and verified
  both header declarations.
- Added synthetic one-case manual input; **31 Node.js tests passed** (supersedes
  the earlier 28 count). All nine fixtures exercise stable manual payload creation.
- A disposable network-isolated n8n ran the actual Manual Trigger, selector,
  injection, configured-sender adapter and downstream graph with mocked services.
  One Carmen item reached preview; write/notice gates remained false. No live
  mailbox, shop writes or SMTP were involved in that graph test.

## Final editor checks and reviewed export (2026-10-27)

- User confirmed case 10 preview selected #25 and EUR 1, then enabled registration.
  The shop showed EUR 6 paid/EUR 14 pending. They explicitly confirmed a second
  execution of case 10 before refreshing the page; figures remained unchanged.
- Agent subsequently read #25 through the live REST API: active test reservation,
  EUR 6 paid, EUR 14 pending, payments `[5, 1]`, exactly one EUR 1 payment. No
  additional writes were made by the agent during verification.
- User confirmed case 04 reached review for overpayment and its SMTP notice arrived.
- The user supplied `03-remote-deposits-tested.json`: inactive, 39 rearranged nodes,
  all three effect gates false, no pinned data, local credential associations and
  Error Workflow setting present. This confirms configuration presence, not actual
  automatic error dispatch.
- Preserved originals outside Git before sanitization. Canonical JSON retains all
  39 positions/IDs and all connections, including user-pasted case 10. Credentials,
  instance metadata, local Error Workflow ID and personal addresses are removed;
  timezone explicitly Madrid. The user's local n8n workflow was not overwritten.
- **33 Node.js tests passed** after adding sanitizer checks. The supporting builder
  now retains canonical positions and tests run it in memory instead of overwriting
  the reviewed export. Final backend rerun is recorded separately in the log.

## Final minimum integration checks — 2026-10-27

### Receipt and automatic error delivery

- Read-only local inspection found only HU-05 and daily closing published. The
  running shop incorrectly targeted `http://n8n:5680/webhook/tienda`; host port 5680
  is not the container's listening port. With explicit user authorization, changed
  the ignored local `.env` to `http://n8n:5678/webhook/tienda` and recreated only the
  shop service, without clearing data or restarting n8n.
- Imported three separate temporary drafts: repository HU-02, repository event
  router bound to that receipt copy (other business handlers replaced with no-op
  for this scoped test), and repository 99 Error Test protected by existing Header
  Auth. Used existing local credential references, never exported secret values.
  No repository workflow owned by the teammate was modified.
- User explicitly published the three test copies in the editor. Created controlled
  reservation #26 with a test recipient, price EUR 20 and required EUR 5 initial
  payment, then registered exactly EUR 1 through the app API with a stable key.
  API verified EUR 6 paid/EUR 14 pending and one EUR 1 payment. User confirmed the
  actual receipt email and those figures. This is not a bank transaction; test
  records count in the local shop's reports and were not deleted.
- Sent authenticated curl POST through secure stdin to the temporary error
  webhook. HTTP 200 meant request acceptance, not proof of error delivery. User
  separately confirmed HU-05's email naming `TEST HU03 Automatic Error Integration`,
  `Throw Test Error`, and the controlled test message. No financial write in this test.
- User removed all three temporary publications. A subsequent CLI active listing
  independently showed only the original HU-05 and daily closing active. Test
  drafts remain for evidence; original HU-03 workflows were not changed/published.

### Actual Groq pass for remaining samples

Temporary unpublished HU-03 copy reused the tested Groq and shop credentials.
No IMAP listener, no payment registration and no SMTP; only synthetic subject/body
sent externally. Executed six single-case CLI runs against actual Groq and live
read-only API, using a separate runner broker port to avoid disturbing n8n.

| Case | Actual Groq extraction | Matching outcome | Source |
| --- | --- | --- | --- |
| 01 | Expected payer/10 EUR/zuecos/bizum | Eligible preview | Prior user editor confirmation |
| 02 | Exact expected four fields | Eligible #2 | Agent CLI, real provider |
| 03 | Exact expected four fields | Eligible #3, amount equals API pending | Agent CLI, real provider |
| 04 | Expected Laura/15 EUR/deportivas/bizum | Review overpayment; SMTP received | Prior user editor confirmation |
| 05 | Payer/10 EUR/bizum, empty concept | Review missing concept | Agent CLI, real provider |
| 06 | Exact expected four fields | Review past deadline | Agent CLI, real provider |
| 07 | Exact expected four fields | Review unknown payer | Agent CLI, real provider |
| 08 | Non-payment | Ignore | Prior user editor confirmation |
| 09 | Exact expected four fields | Eligible #24 | Agent CLI, real provider |

All six agent runs succeeded; sanitized summary in `groq-live-results.json`.
This is one real-model correctness pass, not a statistical reliability evaluation
or nine live financial writes. Cases 02/03/09 remained previews; isolated backend
tests cover settlement behavior, not live settlement of Lucía in this final pass.

### Delivery boundaries

No production-bank authenticity claim, automated approval form, continuous
operation or guaranteed event-delivery outbox. The original deployment still
needs its genuine event router/child IDs configured and published by the team
before unattended use; temporary test routes are intentionally unpublished.
No live HU-03 transport failure was induced; HU-05 was verified via a protected
automatic test using the same configured error handler. No Git publication or
issue closure is implied by passing these minimum checks.
