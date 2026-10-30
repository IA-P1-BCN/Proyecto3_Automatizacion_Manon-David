# Execution evidence — issue #21

**Issue:** #21 — Prueba y evidencias de ejecución.
**Assignees:** David (`davidlafuentem`) and Manon (`ManonChab`).
**Branch:** `docs/21-execution-evidence`, from current `dev`.

## Goal and scope

Capture one real, controlled reservation lifecycle: creation, partial payments
and settlement, with the corresponding confirmation/receipt/collection messages.
Supplement this with evidence mapped to the peer-audit worksheet. This delivery
collects evidence and prepares David's local integration using already-reviewed
workflows; it does not implement another story or change backend/frontend.

Audit source: the user-supplied Google document titled **Hoja de auditoría entre
parejas: proyecto n8n**. Its six blocks are functionality, naming/order, security,
errors/edge cases, efficiency and AI-agent process. The final half-page reflection
must describe what the team actually observed; do not fabricate the other team's
feedback or fill their audit as if they had performed it.

## Dependencies and local preparation

- Canonical flows 00, 01, 02, 04, 08 and 09 are existing shared deliverables.
  Reuse the local flow 08 and SMTP credential; add only missing inactive drafts.
- Router calls must point to local 01/02/04/09 IDs. Each draft needs the existing
  Error Workflow. Do not overwrite current workflows or their manual settings.
- `consentimientos`: text columns `email`, `estado`, `fecha`, `origen`.
- `migration_state`: `clave` text, `activa` boolean, `desde` text. It must not
  suppress live demo events. Do not run a migration or consent backfill as an
  incidental setup action. New demo consent is registered by the normal router.
- App/router shared authentication needs `TIENDA_WEBHOOK_TOKEN` and a matching
  token in the app target URL. Do not expose it in screenshots, chat or Git.
- Flow 03 on current dev has new HU-13 integration dependencies. Preserve David's
  existing tested local draft; resolve its deployment separately before claiming
  the remote-email recording uses the latest shared graph.
- Do not disturb the running HU-12 bridge or unrelated schedules, credentials,
  volumes or workflows. Coordinate test-mail consumption with Manon before IMAP
  tests so two environments cannot register the same payment.

## Proposed controlled fixture and expected results

Use one fictional customer and an explicitly confirmed controlled recipient.
Suggested price EUR 30: initial EUR 5 -> API active/paid 5/pending 25; partial
EUR 10 -> active/paid 15/pending 15; final EUR 15 -> settled/paid 30/pending 0.
These are planned expectations, not records already created. Preserve the same
reservation ID throughout the video. Obtain state/pending/deadline from the API;
never calculate individual balances inside a workflow or an AI model.

## Evidence package

1. Main video (about 4–6 minutes): app creation, actual confirmation received,
   partial payment and receipt, final payment and settled/collection message;
   show the actual router/handler execution linked to the same reservation.
2. Short doubtful-email clip: a controlled ambiguous/rejected notification,
   human-review notice and API evidence that no payment was registered.
3. Short empty-day closing clip: a verified empty date and successful zero
   totals; do not delete business data to manufacture it.
4. Selected screenshots: readable graph, API-to-message fields, Error Workflow
   association/execution, secret-safe credential references, ignored `.env`,
   AGENTS/specs/AI log and one documented agent error/correction.
5. Optional HU-12 clip demonstrates the two owner-only queries; it does not
   replace the reservation lifecycle required by issue #21.

Reuse existing reviewed captures where sufficient. File presence alone is not
proof that a capture is safe or that it covers the same lifecycle. Keep filenames
in English and redact private addresses, credentials, tokens and real customer
data before publication. Record date, environment, intended/actual result and
which actions were real, mocked, user-reported or independently checked.

## Permission and acceptance boundaries

Preparation may import only agreed missing inactive drafts and associate existing
local references. Publication, service recreation/restarts and tests that create
records, contact Groq or send emails need explicit authorization for their stated
effects. No commit/push/PR permission carries over from HU-12.

Ready for review only after real source media is supplied, reviewed for privacy,
and linked in the evidence index; an integration run without a recording is not
a captured video. Do not declare #21 complete until its lifecycle media and
supporting evidence are actually present and verified.

## Recorded delivery and scope boundary

The authorized #27 lifecycle was executed once (initial 5, partial 10, final 15),
verified through REST and actual integrated n8n executions, and supplied as three
real recordings. Publication copies remove browser context and mask visible mail
addresses, preserving private original sources and the financial/state evidence.
The evidence index records source/publication hashes and review limits.

Issue #21's stated lifecycle requirement is distinct from the wider peer-audit
worksheet. Black switching-window segments do not prove mailbox receipt; the
supplemental audit still benefits from safe captures of existing received emails.
Do not fabricate those captures, replay payments or claim all audit items passed.
Audio is preserved for the recording author's/human review, not claimed as
transcribed/audited by the agent. Combine into the existing shared PR #56,
preserving Manon's templates and dev's actual verification record; never force
push or merge the PR autonomously.
