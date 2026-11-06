# Layaway process map

**Issue:** [#19 — Mapa del proceso de apartado](https://github.com/IA-P1-BCN/Proyecto3_Automatizacion_Manon-David/issues/19).
**Owner:** David (`davidlafuentem`). **Snapshot:** 2026-10-28.

## View the maps

No BPMN application is required. Download the SVG and open it in a web browser;
zoom in to read the labels. GitHub previews may scale these large diagrams down.

| Process | Viewable diagram | Editable source |
| --- | --- | --- |
| Before the supplied app: notebook, Excel and manual checks | [AS-IS SVG](as-is.svg) | [AS-IS BPMN](as-is.bpmn) |
| With the shop app and n8n | [TO-BE SVG](to-be.svg) | [TO-BE BPMN](to-be.bpmn) |

The BPMN and SVG pairs describe the same processes. The `.bpmn` files are
non-executable documentation, not workflows to import into n8n. Their names in
David's Downloads folder are `asis.*` and `tobe.*`; repository names use English
kebab-case.

## Scope and reading guide

Issue #19 asks how the process works manually and how automation changes it.
The historical AS-IS is reconstructed from the assignment and sample CSVs, not
from direct observation of a real shop. It shows the original manual process,
not a claim that the supplied app is currently unused.

- Separate participant areas distinguish customer, bank, shop staff, app, n8n
  and Marisa. Solid arrows are sequences inside a participant; dashed arrows
  represent communication between participants.
- In AS-IS, pale red highlights manual pain points. In TO-BE, blue identifies
  automation, orange identifies app operations, and white identifies people.
- Each separate starting event introduces a related operational case: creating
  a reservation, receiving a payment, checking a deadline, producing a summary
  or handling an error. These are not successive steps in one nightly run.
- Branches and notes distinguish successful registration, business rejection,
  uncertain results and human review. An end event closes that case, not
  necessarily the customer's whole reservation.

Both maps cover initial and later payments, settlement/collection, expiry with
store credit, daily closing and monthly reporting. The initial deposit can pay
the full price. The deadline is exactly 90 days; an unpaid reservation may only
be expired after its deadline, not on that date. A voucher is store credit,
never a cash refund. Physical handling of shoes remains a staff task.

The automated map also captures:

- App-owned amounts, validation, state transitions and voucher generation.
  Invalid financial requests take an explicit rejection path without writing.
- One app-event entry point, bank-email extraction by Groq, deterministic
  identification, duplicate protection and manual review of uncertainty. The
  bank flow does not send a duplicate customer receipt.
- Closing history in kDrive `basedatos.csv`, initial deposits counted once,
  integer-cent totals and manual recalculation for transactions after 23:55.
  Email is attempted before history storage, not as a parallel requirement.
- Separate flow 06 reminders and flow 06b expiry. Reminder history uses
  `avisos.csv`; expiry vouchers come from the app. The router intentionally
  ignores `apartado.vencido` because 06b owns those notifications.
- HU-14 webhook authentication and flow 09 consent checks. Unreadable consent
  storage blocks customer sends and reports an error. No secret value is shown.
- The monthly report's current active debt, latest-payment settlement proxy
  among currently settled reservations and voucher-date expiry attribution.
  There is no claim of exact historical state transitions or month-end debt.
- Sanitized failure alerts, escalation to a technical maintainer and
  reconciliation before retrying any uncertain financial operation.

HU-08 and HU-14 are already integrated into `dev` at this snapshot (PRs #50
and #51). That is not evidence that either teammate has installed or published
the workflows locally. Telegram assistants (HU-11/12) and new input workflows
(HU-13) are outside this delivery. Migration and privacy controls are described
only where they affect the ordinary layaway process; their separate maintenance
workflows are not expanded here.

HU-13 (#13) is covered by its first option only, home reservation requests
(Option A). It is not drawn in the maps above: a customer asks through a form
(flow 11), the request waits in a Data Table, and the apartado is created when the
matching Bizum or transfer arrives (flows 11b and 03). See
`docs/decisions-clarify.md` (section "Home reservations from the web") and
`docs/README-changes.md` section 13.

## Acceptance and verification

The issue has a short description rather than a detailed checklist. The
delivery interprets it as two readable maps with editable sources, consistent
business rules, clear human/system responsibilities and documented boundaries.

Run the repeatable local checks from the repository root:

```sh
python3 scripts/verify-process-maps.py
```

Checks cover XML parsing, unique identifiers, reference integrity, sequence
ownership, node connectivity/reachability, diagram coverage, matching SVG labels
and absence of executable or externally loaded SVG content. They also check
selected agreed business labels. They do not execute any automation.

Additional checks actually performed on 2026-10-28:

- Both BPMN files validated with `xmllint` against the official
  [OMG BPMN 2.0 schema](https://www.omg.org/spec/BPMN/20100501/BPMN20.xsd)
  and its four dependencies, downloaded to a temporary directory outside Git.
- SVG render previews were inspected with macOS Quick Look, including the
  lower section of the automated map. No BPMN-editor import was performed;
  David has no BPMN viewer and accepted SVG as the display format.
- Contracts were compared with the assignment, app guide, decisions and current
  versioned workflows. No app records, customer messages or n8n workflows were
  created, changed or published to validate this documentation.

Keep BPMN and SVG together when making future changes. Re-run checks and
review the rendered diagram; schema validation alone does not establish
business correctness or layout readability.
