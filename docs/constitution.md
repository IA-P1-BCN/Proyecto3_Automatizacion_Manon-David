# Project constitution · Paso Firme automations

> Principles that don't change from one automation to the next. If this file is edited every week, it was really a spec: move that content down into the specs.
> Sources of truth: the assignment is the [README](../README.md) (not rewritten here), the app is the [app guide](guia-de-la-app.md), the vocabulary is the [ontology](../specs/ontologia.md).

**Team:** Manon (@ManonChab) and David (@davidlafuentem) · **Fictional client:** Marisa, owner of Zapatería Paso Firme
**Target level:** 🟢 Essential (flows 1, 2, 3, 5, 8); reassess 🟡 Medium once it is done ([decision](decisions-clarify.md#target-level))

## 1. Mission

What Marisa does today with a notebook, a calculator and her memory should happen on its own, with correct amounts and no lost payment or missed deadline. **We don't program the app: we automate what happens around it with n8n.**

## 2. Non-negotiable principles

1. **The app is the single source of truth.** Amounts, states, deadlines and vouchers are calculated and validated by the app. n8n reads and displays them; it **never recalculates** or invents them. Neither does the AI.
2. **The AI extracts, the flow decides.** A model only turns free text into data (e.g. payer, amount, concept of an email). Which reservation it is, and whether it gets registered, is decided by the flow with rules and the API.
3. **When in doubt, register nothing and ask Marisa.** A wrongly assigned payment is worse than a payment waiting for review. Never guess.
4. **Business rules live in the app** (`backend/config.py`) and are not duplicated in the flows, except to decide *what to do* with the error the app returns. Current values: minimum deposit €5, 90-day deadline, payment methods `efectivo | tarjeta | bizum`.
5. **No flow fails silently.** Every flow has an error branch and is connected to the Error Workflow (flow 8).
6. **Idempotency.** Retrying or running a flow twice does not duplicate deposits, notices or sales.
7. **One notice, once.** A customer never gets the same reminder twice.

## 3. Security and personal data

- **Zero secrets in Git:** not in the flow JSON, not in the agent instruction files, not in specs, not in a versioned `.env`. Credentials live only in n8n; `.env.example` has variable names only, no values.
- Flows are exported **without credentials** and the diff is reviewed before every commit.
- The n8n webhook requires authentication (header) and validates the body before acting.
- **Minimisation:** an AI model receives only what is strictly needed (the text of the bank email; never the customer list or phone numbers). What data leaves is documented in the AI log.
- Error alerts contain no keys or unnecessary personal data.
- Messages go only to customers who consented (consent is implied by giving an `email`, only for their own reservation; [decision](decisions-clarify.md#consent-to-receive-messages)).

## 4. How we work with the AI agent

- **Spec before flow.** No flow is requested from the agent without its stable spec (trigger, inputs, outputs, errors, acceptance criteria) and no open questions.
- **The agent proposes, we decide.** Every generated flow is imported, tested and reviewed in the PR before merging. The agent does **not** activate flows in production or write credentials.
- **Tests are the contract.** Each flow has sample payloads and an expected result. If a test fails, fix the flow, not the test.
- **One vocabulary:** use the names in the ontology (`Apartado`, `Abono`, `Vale`…). No invented synonyms.
- **Traceability:** relevant prompts, agent errors/hallucinations and decisions go to `docs/ai-log.md` at the time, not afterwards.
- **Two agents, one set of rules:** Manon uses **Claude Code**, David uses **OpenCode with a paid GPT model**. Everything we create must work with both ([decision](decisions-clarify.md#agent-tooling-claude-code-and-opencode)). Each agent edits only its owner's spec and flow files, on the branch of the assigned issue (`feat/<issue#>-…`); never the partner's files, `main`, `backend/` or `frontend/`.

## 5. Conventions

| Topic | Rule |
|---|---|
| Language | Everything in **English**, except customer-facing messages (emails to customers and to Marisa), which are in **Spanish**. App field and event names stay as the app defines them ([decision](decisions-clarify.md#language-policy)). |
| Flows | One flow = one JSON file in `workflows/`, named `NN-name-in-kebab.json` (e.g. `01-apartado-confirmation.json`). Descriptive node names, not `HTTP Request1`. |
| Specs | Written with OpenSpec under `openspec/` ([decision](decisions-clarify.md#spec-tooling-openspec)). The flow number `NN` matches the workflow file. |
| Git | One issue = one branch = one PR with the exported JSON. Branches `feat/<issue#>-<desc>`, `docs/<issue#>-<desc>`, `fix/<issue#>-<desc>`, created from `dev`. PRs target `dev` (with `Closes #N`); `dev` → `main` through a reviewed PR. Nobody pushes to `dev` or `main` directly ([decision](decisions-clarify.md#branching-model-and-issues-per-flow)). |
| Commits | Conventional Commits, message in **English**: `feat: add apartado confirmation flow` ([decision](decisions-clarify.md#commit-language)). |
| Ownership | Each person owns their flows; the other reviews the PR. |
| Board | [Project 43](https://github.com/orgs/IA-P1-BCN/projects/43): one card per story, status updated when the PR is opened/closed. |

## 6. Definition of done (per flow)

A flow is done when:

- [ ] It has a stable spec with no open `[NEEDS CLARIFICATION]`.
- [ ] It meets every acceptance criterion of its story (HU-xx).
- [ ] Tested with sample data, including error cases and the 9 emails in `data/correos/` where relevant.
- [ ] Error branch connected to the Error Workflow; running it twice duplicates nothing.
- [ ] JSON exported in `workflows/`, **without credentials**.
- [ ] Required credentials and variables listed (without values) in the README.
- [ ] PR reviewed by the other person; relevant prompts and agent corrections noted in `docs/ai-log.md`.
- [ ] Execution evidence (screenshot or video) saved.
- [ ] Board card moved to *Done*.

## 7. Out of scope (for now)

Changing the app's code (`backend/`, `frontend/`) unless explicitly agreed with the teacher. Refunding cash (what was paid on an expired reservation only becomes a voucher). Advanced and Expert levels until Essential is done.
