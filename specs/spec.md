# General spec · Paso Firme automations (Essential level)

> What must be achieved and why, without saying how. The per-flow specs detail each automation; this one ties them together.
> Sources of truth: [README](../README.md) (assignment), [constitution](../docs/constitution.md), [ontology](ontologia.md), [decisions](../docs/decisions-clarify.md). If anything here contradicts the README, the README wins.
> Note: this draft predates the OpenSpec adoption and will be redone under OpenSpec ([decision](../docs/decisions-clarify.md#spec-tooling-openspec)).

## 1. Problem
Zapatería Paso Firme keeps reservations in a notebook and the accounts in an Excel sheet. Figures don't add up, nobody watches deadlines, the daily cash close is done with a calculator, and Bizum or transfer payments have to be tracked down and written in by hand by Marisa, and some slip through. The shop already has an app where reservations, deposits and sales are registered; what is missing is for **everything else to happen on its own**.

## 2. Goal
Connect the app to automations that notify customers and Marisa, register remote payments and produce the daily cash close, **with nobody adding up or writing anything by hand and no amount errors**.

## 3. People
| Person | What they need |
|---|---|
| **Customer** | To know what they reserved, how much they paid, how much is left and until when |
| **Marisa** (owner) | To stop checking bank notices, close the till without a calculator, and be told what fails or what needs a decision |
| **Shop assistant** | To keep using the app as today; the automations add no steps |

## 4. Scope
**In (Essential level):** flows 1, 2, 3, 5 and 8 of the README, and the deliverables.
**Out for now:** flows 4, 6, 7, Excel migration, Telegram, dashboard, cloud, CI. Medium is reassessed when Essential is done ([decision](../docs/decisions-clarify.md#target-level)). The app's code is not modified either.

## 5. Stories and flows
| Priority | Story | Flow | Spec | Depends on |
|---|---|---|---|---|
| 1 | HU-05 Error alerts | 08 Error Workflow | [08](08-error-workflow.md) ✅ draft | — |
| 2 | HU-01 Confirmation on reserving | 01 Reservation confirmation | 01 (pending) | 08 |
| 3 | HU-02 Receipt for each deposit | 02 Deposit receipt | 02 (pending) | 08 |
| 4 | HU-03 Deposits by Bizum or transfer | 03 Remote deposits | 03 (pending) | 02, 08 |
| 5 | HU-04 Automatic cash close | 05 Daily close | 05 (pending) | 08 |

Order: 08 first because every flow connects to it; 03 after 02 because a registered deposit triggers the receipt. Flows 01, 02 and 05 are independent of each other and can be built in parallel.

## 6. Functional requirements
**Common**
- **FR-01** App events reach n8n through a single webhook that routes on the `evento` field (`apartado.creado`, `abono.registrado`, `venta.registrada`, `apartado.vencido`).
- **FR-02** Every amount, state and deadline shown to anyone is the one the app gives; no flow or AI model recalculates them.
- **FR-03** Every flow fails visibly: an error reaches the shop (FR-30).

**Flow 01 · Reservation confirmation**
- **FR-10** When a reservation is created, the customer receives within one minute an email with model, size, price, amount paid, amount pending and deadline.
- **FR-11** If the customer has no email, the flow does not fail: it tells the shop the message could not be sent.

**Flow 02 · Deposit receipt**
- **FR-12** Every registered deposit produces a receipt with the amount paid and what remains pending.
- **FR-13** If the reservation becomes settled, the message says they can pick up their shoes.

**Flow 03 · Remote deposits**
- **FR-20** Emails that are not a payment are ignored.
- **FR-21** Payer, amount and concept are extracted from each payment (the AI only extracts; the flow decides).
- **FR-22** The reservation is found by the number in the concept and otherwise by exact normalised name ([decision](../docs/decisions-clarify.md#how-a-payment-finds-its-reservation-flow-3)).
- **FR-23** A single clear reservation → the deposit is registered (Bizum and transfer as `bizum`) and the customer gets their receipt (FR-12).
- **FR-24** Doubtful payment (several possible reservations, no concept, unknown customer) → nothing is registered and Marisa is asked.
- **FR-25** Amount greater than what is pending, or reservation past its deadline → nothing is registered and Marisa is told the reason.
- **FR-26** Correctly resolves the 9 emails in `data/correos/` (table in the README).

**Flow 05 · Daily close**
- **FR-27** Every night Marisa receives a summary with direct sales, deposits (initial ones included) and total, split by cash, card and Bizum (which includes transfers).
- **FR-28** The amounts match the app's.
- **FR-29** A day with no movements produces a summary saying so, not an error.
- **FR-31** The close is saved in a history, one row per day.

**Flow 08 · Error Workflow**
- **FR-30** Any flow that fails sends an alert with the flow name, step and error, with no passwords or keys.

## 7. Non-functional requirements
- **Security:** no secrets in Git or in the flow JSON; credentials only in n8n; the webhook and messages follow [constitution §3](../docs/constitution.md).
- **Privacy:** an AI model receives only the text of the bank email.
- **Idempotency:** repeating an execution does not duplicate deposits, notices or close rows.
- **Speed:** event-driven notices arrive within one minute.
- **Traceability:** relevant prompts, agent errors and decisions in `docs/ai-log.md`.
- **Language:** everything in English except customer-facing messages, which are in Spanish ([decision](../docs/decisions-clarify.md#language-policy)).

## 8. Essential success criteria
- [ ] The app and n8n start with `docker compose` and events reach n8n.
- [ ] A full reservation (creation → deposits → settlement) produces all the right messages, with amounts equal to the app's.
- [ ] The 9 bank emails give the expected result.
- [ ] One night's close matches the app's sums.
- [ ] Forcing a failure sends the alert, with no secrets.
- [ ] Flows exported as JSON in `workflows/`, without credentials; the agent instructions and the AI log exist.
- [ ] Every flow meets the [definition of done](../docs/constitution.md#6-definition-of-done-per-flow).

## 9. Essential deliverables
Reservation process map · repo with `workflows/` and an import README · list of credentials and variables per flow (no values) · test flow that creates sample data · execution evidence · Kanban board · agent instructions and specs · AI log · PR history with reviews · retrospective.

## 10. Assumptions
- The app and its rules (minimum deposit €5, 90-day deadline, payment methods `efectivo|tarjeta|bizum`) don't change.
- One Gmail account both reads (flow 03) and sends (the rest) ([decision](../docs/decisions-clarify.md#n8n-email-account)).
- Active reservations are identified by number or exact name; there is no customer table.
- Consent is implied by giving an email ([decision](../docs/decisions-clarify.md#consent-to-receive-messages)).

## 11. Decisions made and open questions
Resolved in the clarification phase ([decisions](../docs/decisions-clarify.md)):

| Topic | Decision |
|---|---|
| Email account | A single Gmail account to read and send |
| AI model in n8n (flow 03) | Groq model, chosen by testing the 9 emails |
| Close history (FR-31) | Google Sheets, one row per date (upsert) |
| Daily close (FR-27) | 23:55 Europe/Madrid, covers the current day |
| Alert email fails (flow 08) | Accepted and documented; no backup channel |
| Repeated alerts (flow 08) | One per failed execution, no limit |

Flow split decided: Manon owns flows 08, router, 01, 02; David owns flows 03 and 05 ([decision](../docs/decisions-clarify.md#flow-split-between-manon-and-david)). Branches, PR target and issue per flow: [decision](../docs/decisions-clarify.md#branching-model-and-issues-per-flow). Open: the event router has no GitHub issue yet.
