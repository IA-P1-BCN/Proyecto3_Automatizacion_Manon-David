# Flow 03 — essential remote payments

Issue #3 — HU-03 · Abonos por Bizum o transferencia sin apuntar nada a mano.

## Importable delivery

Use **`workflows/03-remote-deposits.json`**, internal name **03 Remote Deposits**.
This replaces the extraction-only canonical draft, not the user's original
`workflows/03 Remote Deposits.json`, which remains untouched and contains local
credential/instance references and a personal sender. Do not commit that original
as-is. Both original and tested local exports are ignored by Git. The canonical
delivery is sanitized from `03-remote-deposits-tested.json`, preserving all 39
tested node positions, IDs and connections. It is inactive, with all three effect
gates false, without credentials, pinned data or local Error Workflow ID. Import into
a new draft, or deliberately replace only your own assigned draft. Do not publish
or leave two IMAP consumers listening at the same time.

The user explicitly deferred approval forms and automated mailbox-test tooling.
The complete essential path is: IMAP → test-sender/subject filter → minimal Groq
extraction → evidence validation → API reservation matching → refreshed API
eligibility → duplicate-safe registration OR SMTP review notice to Marisa.
HU-02 handles customer receipts through the app event, not this workflow.

## 1. Install the authorized application protection

The new payment registration requires **both** optional headers documented in
OpenAPI: `Idempotency-Key` and `Payment-Notice-Fingerprint`. The workflow checks
the installed API and stops before POST if this version is not installed.

After review and explicit agreement to restart the intended local shop, rebuild
only that service from the issue branch:

```sh
docker compose up -d --build tienda
```

On 2026-10-27 the user authorized and the agent performed the local deployment
using `docker compose up -d --build --no-deps tienda`. A consistent backup was
saved outside Git first. Read-only API checks confirmed both safety headers and
unchanged business counts/state summary: 24 reservations, 83 deposits, 256 sales.
The n8n service was not restarted. The command above is for teammate reproduction.
Never use `down -v` or reset data. Schema initialization creates/updates the key
table additively. No existing payment is rewritten. Confirm the running API key
still matches the selected n8n Header Auth credential.

## 2. Reassociate local credentials

| Nodes | Credential |
| --- | --- |
| Receive Bank Payment Notices from Shop Mailbox | Existing tested IMAP |
| Extract Payer Amount and Concept from Bank Notice with Groq | Existing tested Groq (`groqApi`) |
| All shop API HTTP nodes, including OpenAPI capability check | Header Auth, **Name `X-API-Key`**, value your shop key without Bearer |
| Email Marisa the Review Reason and Available Candidate Contacts | Existing tested SMTP |

In workflow **Settings → Error Workflow**, select your local **08 Error Workflow**.
The export cannot know its local ID; this reassociation is required before
automatic operation. Manual editor executions do not automatically dispatch the
error workflow. No secret values should be placed in nodes or repository files.

## 3. Configure the first Set node

`Configure Authorized Test Sender and Groq Access` contains:

| Field | Setup |
| --- | --- |
| `authorized_test_sender` | Controlled test sender; replace `test-sender@example.invalid` |
| `allow_external_ai` | Initially false; true to intentionally send synthetic subject/body to Groq |
| `allow_payment_registration` | Initially false; true only after agreeing to test writes |
| `allow_shop_notices` | Initially false; true only to send review emails to your controlled recipient |
| `receiving_account_scope` | Stable unique label for the receiving bank account/mailbox. Do not change it to bypass a duplicate |
| `shop_notice_to` | Controlled recipient representing Marisa |
| `shop_notice_from` | Address permitted by your SMTP credential |

Addresses ending `.invalid` are placeholders and block sending. The tested
Groq node's enabled state is preserved; the false AI gate still blocks requests.
If rebuilding from the generator, enable Groq only when ready. The `TEST HU03` prefix and exact
sender whitelist are deliberately retained; this is a controlled-demo workflow,
not proof of bank authenticity. Do not simply remove the filter for real-world
operation without a separate sender/authentication and consent review.

IMAP uses Resolved, **Mark as Read** and explicit `["UNSEEN"]`. Clear old test mail
by marking it read, not deleting it. One execution may receive several messages;
each item keeps its own paired context. Stored editor results are not evidence
that the messages were received again.

## 4. Minimal editor verification

### Manual synthetic input (no mailbox waiting)

The additional `Start One Synthetic Bank Notice Test Without Sending Email`
Manual Trigger feeds `Choose Bank Notice Test Case 01 to 09`, then
`Inject the Selected Example as a Resolved Bank Notice`. Choose one string `01`
through `10`; `01` is Carmen, `04` is overpayment, `08` is advertising and `10`
is a EUR 1 payment explicitly referencing local test reservation #25. The old
selector name is only a label: its string field accepts 10. Tested export retains
the selected case 04. Case 10 requires creating the corresponding test reservation
on another teammate's instance; #25 is not guaranteed to identify their fixture.
Run from this manual trigger instead of the IMAP trigger. There is deliberately
no loop or all-cases mode: one click processes one selected notice, preventing an
accidental nine-payment batch. The normal matching and extraction path is shared.

The Code node contains the nine supplied synthetic fixtures plus the local test
case, not mailbox
credentials or personal headers. It supplies the same Message-ID for each case
on every run and uses the configured authorized sender for that artificial input.
Actual IMAP senders are left unchanged. It adds an explicit simulation notice.
Do not change identity/account scope to bypass a replay; financial gates and
recipient checks still apply. Enabling AI sends the fixture subject/body to Groq;
the entry alone sends no email and performs no bank operation.

### Test sequence

1. **Preview:** enable AI, keep registration and notices false. Send one synthetic
   eligible payment. It must reach `Show the Proposed Payment Without Writing to
   the Shop`, with the intended reservation, API balance and stable hashes.
2. **Controlled write:** first confirm intended recipient effects: a successful
   registration emits HU-02's event and may send a customer receipt. Use a
   dedicated test reservation with controlled contact data. Then enable writes,
   send a clearly referenced notice and verify exactly one new abono via the API.
3. **Rejection:** enable notices with controlled SMTP recipient. Test overpayment
   or overdue reservation; expect Marisa's reason and no new abono. Unknown or
   ambiguous payers also go to manual review with available candidate contacts.
4. **Replay:** rerun the same saved input with unchanged Message-ID, account scope,
   subject/body and financial data. The app must not add another abono or event.
   If registration already settled the reservation, it may instead go to review
   without another write. Another message with identical subject/body is held by
   the fingerprint guard (409), not automatically treated as a new payment.

Sending a fresh copy with a different Message-ID is not a same-message retry.
Never change keys/subject/body to force an uncertain financial write through.

## Behavior and known limits

- Amounts and balance come from the API; n8n does not compute reservation balances.
- Full-name containment is normalized by tokens; abbreviation requires product
  confirmation. Explicit-reference/name conflicts and multiple candidates go to
  review. Eligibility does not eliminate identity ambiguity.
- Transfers use `bizum` in the API, with the actual type in review notices.
- 404/409/422 refusals are review cases. Unknown/network POST failures are uncertain:
  attempt a shop notice and then fail for HU-05. Never automatically retry POST.
- Content fingerprints are conservative: legitimate repeated equal notices may
  require review. Different IDs with reworded content are not universally detected.
- Manual UI payments do not share the email key: after manual resolution, do not
  automatically replay that notice. There is no automatic reconciliation/approval
  queue in this approved scope, and review emails may repeat on reprocessing.
- The existing webhook is best-effort. A committed payment may lose its receipt
  event if the application crashes; replay does not resend it.
- Mark-as-read is not idempotency and is not payment confirmation. Failed
  executions must be inspected and handled, not silently discarded.

## Checks performed versus remaining

- User-reported previous editor checks: IMAP/encoding, positive/negative subject
  routing, real Groq extraction for Carmen, advertising ignored and reception of
  one new message after inbox cleanup. This does not prove the new financial path.
- Local helper/Code-node tests, temporary API tests, seeded nine-notice smoke,
  successful registration, rejection, replay, content-duplicate conflict and
  concurrent safety checks are documented in `workflows/tests/03-remote-deposits.md`.
- A disposable network-isolated n8n imported a test-ID copy and executed the real
  graph with synthetic inputs and mocked Groq/API/SMTP nodes. This is a graph
  execution check, not live credential-backed integration.
- Application changes are installed. User confirmed final-editor case 10 preview,
  EUR 1 registration on #25 and a second execution without another payment. A
  read-only agent API check independently found EUR 6 paid, EUR 14 pending and
  exactly one EUR 1 payment. User also confirmed case 04's overpayment SMTP notice.
- Final minimum integration: controlled #26 API abono produced a receipt with
  expected figures, confirmed by the user; protected curl-triggered error test
  produced the expected HU-05 email. Shared router/receipt test copies were used,
  not modifications to the teammate's source workflows. All temporary publications
  were removed and independently checked.
- All nine examples now have actual Groq extraction/classification coverage:
  user editor tests for 01/04/08, real-provider CLI previews for 02/03/05/06/07/09.
  These are not nine mailbox-to-financial-write executions. Details and remaining
  operational boundaries are in `docs/evidence/03-remote-deposits/README.md`.
- Correct app target inside Docker is `http://n8n:5678/webhook/tienda`, not the
  editor's host port 5680. The ignored local .env was corrected with permission.
  Before unattended use, the team must configure and publish its genuine router
  and child workflow IDs. Tests leave their temporary routes unpublished.

Do not reimport into the user's tested editor just to publish the sanitized file.
To sanitize a newly exported local tested copy while preserving its layout:

```sh
node workflows/code/sanitize-03-tested-export.js
```

For deliberate implementation changes, the supporting generator is still available
via `node workflows/code/build-03-remote-deposits.js` and preserves canonical node
positions by name. Tests generate in memory and never overwrite the reviewed JSON.
See `docs/payment-idempotency.md` for retry and persistence details.
