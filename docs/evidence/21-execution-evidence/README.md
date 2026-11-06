# Execution evidence index — issue #21

**Issue:** #21 — Prueba y evidencias de ejecución.
**Environment:** David's independent local Docker project; shop host port 8001,
n8n host port 5680. No connection to Manon's instance.

## Preparation checkpoint — 2026-10-29

- Created `docs/21-execution-evidence` from fetched `dev` at `460c7d8`.
  Preserved both unrelated untracked `.DS_Store` files.
- Read the peer-audit worksheet through its text export. The issue is assigned
  to both teammates and remains open/In Progress; no remote status was changed.
- Read-only n8n metadata inspection found one SMTP credential, the existing flow
  08, no Data Tables, and no canonical flows 00/01/02/04/09. Credential values,
  personal addresses and account IDs were not printed or extracted.
- The current app target is the production `/webhook/tienda` path but has no
  token, and the running n8n environment has no app/router token configured.
  This is a setup blocker, not a failed recorded acceptance test.
- Existing evidence is available under `docs/evidence/01-reservation-confirmation`,
  `02-deposit-receipt`, `03-remote-deposits`, `05-daily-close`, `08-error-workflow`
  and `90-demo-data`. Review sources/privacy before reuse; none has been renamed,
  deleted or presented as a newly recorded end-to-end run.

## Local inactive draft preparation — 2026-10-29

Official CLI import added only the missing 00/01/02/04/09 drafts to the verified
port-5680 instance. Assigned local IDs for this setup are `hu21EventRouterDavid`,
`hu21ReservationConfirmationDavid`, `hu21DepositReceiptDavid`,
`hu21LargeSaleAlertDavid` and `hu21ConsentCheckDavid`. SMTP references reuse the
one existing SMTP credential; the five drafts select the existing Error Workflow,
and all five router sub-workflow calls select the appropriate local IDs.

Official re-export verified all nodes/connections and inactive state. Read-only
metadata digests before/after confirmed every pre-existing workflow unchanged,
including HU-12. The temporary import file was removed. No table, app record,
consent entry or email was created; no draft published or service restarted.
These checks establish configuration presence, not integration success.

### Table setup verified — 2026-10-30

David created `consentimientos` with four string columns (`email`, `estado`,
`fecha`, `origen`) and `migration_state` with `clave` string, `activa` boolean,
`desde` string. Read-only metadata verification confirmed both schemas. He then
selected `consentimientos` in **Read Consent Register** and **Record Consent**
of flow 09, and `migration_state` in **Read Migration Flag** of flow 00.
Read-only verification confirmed all three selectors resolve to the expected
local tables and both workflows remain inactive. Table contents were not read
or altered by the agent; no evidence of customer consent is inferred from schema
presence. No workflow executed, published or message sent by this setup.

App/router authentication is still blocked: a sanitized recheck confirms no
`TIENDA_WEBHOOK_TOKEN` in ignored local `.env` or the running n8n environment.
Next: prepare that distinct shared secret without exposing it and obtain explicit
permission for the necessary service recreation/interruption. Keep publication,
record creation, controlled recipients and email sends separately authorized.

### Authorized local app/router authentication applied — 2026-10-30

David explicitly approved private secret setup, temporary bridge interruption,
same-version shop/n8n recreation and bridge resumption. Preflight found only
existing Error Workflow, daily closing, monthly report and HU-12 published; no
IMAP consumer was active, and the current time was outside their scheduled runs.

The bridge was **already stopped before this change**, exit code 1 with the fixed
diagnostic `network_or_response_failure` from the previous afternoon. This was
not caused by the issue #21 recreation. Its restart policy remains `no`; no
automatic-restart/always-on improvement was implemented incidentally.

A distinct random app/router token was saved only in ignored local `.env`
(0600), with a matching shop webhook URL. Added `.env.hu21-*` to `.gitignore` for
safe atomic updates. A restricted recovery copy and temporary same-image/env
override were kept outside the repository; no secret values were printed.

Recreated only shop and n8n with their exact running image IDs, no builds/pulls,
the same named volumes and preserved unrelated running environment values.
Both host health checks passed. Read-only REST fingerprints of reservations,
payments and sales matched before/after; read-only n8n workflow-configuration
fingerprints also matched. This verifies preservation, not a recorded lifecycle.
The app URL token and running n8n token now match. Resumed the existing bridge
with its prior production URL/send gate and verified it running.

Flows 00/01/02/04/09 remain unpublished. No business POST, workflow execution,
test email or model call was requested by the setup. Next approval needed:
publish only those dependent workflows; separately agree the controlled test
recipient and authorize actual demo writes/messages before recording.

### Published local versions verified — 2026-10-30

David explicitly approved publication of only flows 09/01/02/04/00 and published
them through the editor. Read-only checks inspected the actual active-version
nodes, not just draft parameters. All five are published, all five router calls
resolve to published local targets, the three Data Table selectors resolve to
the intended tables, SMTP references are present on mail nodes, and each workflow
selects the existing Error Workflow. No service restart was required for this
publication. This is configuration verification; SMTP delivery, router execution
and the reservation lifecycle still need real controlled tests and source media.

Before the first demo write, confirm that the configured shop-notification
recipient is controlled by the team and authorize the proposed fixture/messages.
Do not copy a mailbox address, webhook headers or token-bearing URL into evidence.

## Authorized recorded lifecycle — 2026-10-30

David confirmed the configured shop-notification mailbox is controlled and
authorized one fictional EUR 30 reservation, initial EUR 5 and later EUR 10/EUR 15
payments with their notifications. Before each POST the agent waited for David's
recording confirmation. Shop API writes, not simulated webhook injections,
produced the normal application events. No workflow was manually executed by
the agent to manufacture the lifecycle.

| Step | Independently read from the API | Execution evidence |
| --- | --- | --- |
| Creation of reservation #27 | EUR 30 price, EUR 5 paid, EUR 25 pending, active; exactly one initial payment | Router, consent and flow 01 succeeded |
| Partial payment | One new EUR 10 payment; EUR 15 paid, EUR 15 pending, active | Normal integrated flow-02 execution succeeded |
| Final payment | One new EUR 15 payment; EUR 30 paid, EUR 0 pending, settled | Router, consent and integrated flow 02 succeeded |

Read-only final recheck confirms exactly three payments `[5, 10, 15]`; no financial
POST was retried. The initial post-write verification mistakenly used an
undocumented nested payment-read endpoint; corrected the read to `/api/abonos`
and selected this reservation's records, without repeating the creation.

n8n history contains three successful router executions, three successful consent
executions, one successful confirmation and two successful **integrated** receipt
executions. A separate **manual** receipt execution failed before this lifecycle;
it is not counted as a successful demo or presented as a lifecycle error.
David reported showing the initial mailbox confirmation and supplied three source
screen recordings. Agent-observed SMTP-node success is not independently observed
mailbox delivery; media review will distinguish what is actually visible.

The user had opened new unpublished copies by reimporting repository JSONs;
verified that the intended configured local IDs were published with no pending
changes and supplied their exact editor links. No duplicate was deleted or
published automatically.

## Lifecycle media — ordered, with redacted publication copies

The three source `.mov` files were initially renamed after native offline frame/OCR review
and selected-frame visual inspection, not just from timestamps. Before/after
SHA-256 checks confirm source bytes unchanged: no crop, re-encoding, replacement
or deletion was performed during that rename. Originals were timestamped 08:04:04, 08:09:54 and
08:14:43 respectively. Total size is about 62.8 MiB; each is below GitHub's
100 MiB single-file limit. They are now preserved privately outside Git; the
linked files below are the subsequently authorized redacted copies, not raw
sources. No Git LFS configuration was introduced.

| Ordered file | Duration | Size | Verified visible coverage |
| --- | --- | --- | --- |
| [01-reservation-creation.mov](01-reservation-creation.mov) | 2:13.10 | 26.46 MiB | Reservation #27 active, price 30, paid 5, pending 25; router execution routes the creation toward flow 01 |
| [02-partial-payment.mov](02-partial-payment.mov) | 1:24.37 | 16.04 MiB | Same reservation after the partial payment: paid 15, pending 15; application lists initial 5 and added 10 |
| [03-reservation-settlement.mov](03-reservation-settlement.mov) | 2:01.26 | 22.41 MiB | Same reservation settled, paid 30, pending 0, three payments; successful flow-02 collection branch and generated collection text |

Private original-source integrity hashes (not hashes of the edited linked files;
these are media checksums, not credentials):

- `01-reservation-creation.mov`: `9cec01e706cb238989e82a93de628e4eca46376e9b866a5df86776b35d6445b7`
- `02-partial-payment.mov`: `a57584b5bf11162a9dce8e722664446ed799dd7a36e24f99295927fd82eaac31`
- `03-reservation-settlement.mov`: `9168402e93cad8ada4383089dd6b32805d9b53a17ce135e29197965c17b6688a`

### Original-source findings and remaining coverage limits

- Offline sampling extracted and OCR-reviewed **341 frames at one-second
  intervals**, with no extraction/OCR errors; selected frames were also visually
  inspected. No token/header-secret pattern was detected in those samples.
  This is not exhaustive frame-by-frame secret clearance or an audio audit.
- **Original sources exposed email addresses and browser/tab/bookmark context.**
  Those visual fields were subsequently redacted as described below. The audio
  was retained, not transcribed/audited by the agent; the recording author and
  human reviewer should listen before merging. No audible-content claim is made.
- **Some switching-window segments are black** (visually confirmed, for example,
  around 1:50 in clip 01 and 1:00 in clip 02). Do not present those segments as
  visible receipt delivery. In sampled footage the actual received mailbox
  messages were not established, even though generated text/successful sends are
  visible in n8n and David reported the messages received/shown.
- Clip 02's sampled n8n view shows the earlier creation router execution, not
  proof of the partial-payment receipt execution. Independent read-only metadata
  verifies the successful integrated receipt run; an additional screenshot of
  that **saved** execution can show it without repeating any payment.
- To close the mailbox coverage gap, provide safe screenshots or a short capture
  of the **existing** confirmation, partial receipt and collection email for #27.
  No new reservation, payment or resend is needed. This can supplement rather
  than replace the supplied lifecycle videos.
- Original sources were held uncommitted during review and then preserved outside
  Git under explicit permission. Only redacted copies are prepared for publication.
  Private frame/OCR artifacts remain outside Git.

### Authorized publication edits and validation

David authorized creating private-original-preserving redacted copies, combining
this evidence with Manon's existing PR #56, committing and pushing the shared
branch, and requesting human review/merge. No autonomous PR merge or direct issue
closure was authorized by this preparation.

- Removed the upper 180 pixels containing browser tabs, address/profile controls
  and bookmarks. Opaque masks cover recognized address/possible-secret lines
  within the content, with two-second neighboring-frame padding for transitions.
- Preserved order, financial figures, state changes, source audio and black
  switching-window sections. Copies are 1920x900; source duration is retained to
  within 0.01 seconds. Edits anonymize, not fabricate or reconstruct evidence.
- Re-extracted/OCR-reviewed **340 frames** at one-second intervals from publication
  copies: no email, long-hex/token or token-query pattern hits. One final sample
  of clip 03 was unavailable; no broader zero-risk or full audio-audit claim.
  Selected edited frames independently show 5/25, 15/15 and 30/0 plus `Liquidado`
  and the successful collection branch still legible.
- Each publication file remains under 100 MiB (about 64.9 MiB total). Its SHA-256
  is recorded below; original-source hashes above still match the private backups.

Publication-copy hashes:

- `01-reservation-creation.mov`: `1d9404bdc7a2bc897b7c12e06f890737d80e916cec7ef40a6158ba0f2396fc2d`
- `02-partial-payment.mov`: `ffbdf38157e3ed3a49068a107c7ced3758694213f5211a62018c6fe781d020e8`
- `03-reservation-settlement.mov`: `bfebe117ee08fc51043fe247379507b52636d8b4b7de140f16308d06e25d29fb`

The core #21 deliverable is evidence of creation, payments and settlement of one
reservation. These clips plus the independently verified API/n8n record address
that lifecycle. They do not assert that every peer-audit checkbox or each received
mailbox message is visibly recorded. Those supplemental gaps remain explicit for
human review; issue closure follows reviewed integration, not this local index.

## Supplemental audit manifest — not required to invent extra media

| Planned file | Content / expected result | Current evidence |
| --- | --- | --- |
| Lifecycle clips listed above | One reservation: initial payment, partial payment, settlement | Three ordered, visually redacted copies; API/n8n and capture limits documented above |
| `ambiguous-payment-review.mp4` | Review notice and no financial write for the selected uncertain input | Not recorded in this delivery |
| `empty-day-closing.mp4` | Verified empty date, successful zero totals | Live capture pending |
| `workflow-overview.png` | Readable routing/handler graph | Capture pending |
| `api-message-consistency.png` | API-provided balance/state used in the message | Capture pending |
| `error-handling.png` | Error Workflow linkage and clearly classified execution evidence | Source review/capture pending |
| `security-and-ai-process.png` | Secret-free configuration and AGENTS/spec/log evidence | Capture pending |
| `shop-telegram-queries.mp4` | Optional owner-only queries without editor listening | Prior live confirmations exist; no video supplied |

The names above are proposed destinations, not claims that files exist. Use the
minimal sufficient package; do not produce redundant screenshots just to fill
the table. See `specs/21-execution-evidence.md` for the agreed preparation scope,
fixture proposal, audit mapping and authorization boundaries.
