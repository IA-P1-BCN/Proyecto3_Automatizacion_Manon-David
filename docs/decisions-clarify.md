# Decisions · Clarify phase

> One decision per section, written at decision time. Format: decision · why · rejected alternatives. All dates 2026-10-22.

## Target level

**Decision:** we commit to the 🟢 Essential level (flows 1, 2, 3, 5 and 8 + deliverables). We reassess 🟡 Medium once the Essential flows pass their tests.

**Why:** the 5 Essential stories and the deliverables are already a lot of work, and no story is assigned or started. Widening scope before anything works is the main risk.

**Rejected:** Essential + Medium from the start (more specs up front, risk of leaving things half done); Advanced (unrealistic for now).

## Notification channel

**Decision:** email (Gmail) for all notices, to customers and to Marisa. Telegram is left for later (Advanced level).

**Why:** the app already stores the customer's `email`; one credential; easiest to test with the emails in `data/correos/`. Marisa answers a doubtful case by email.

**Rejected:** email + Telegram for Marisa (an extra bot and chat ID with no need at Essential); Telegram for everyone (the customer has no Telegram link in the app).

## Bank transfers

**Decision:** a transfer is registered in the app with `forma_pago = bizum`. The real type (transfer) is kept in the flow's notice/log.

**Why:** the app only accepts `efectivo | tarjeta | bizum` and we don't change its code. Both are remote bank payments that don't go through the card terminal or the till.

**Rejected:** asking the teacher to add `transferencia` (touches `backend/config.py`, out of scope); registering as `tarjeta` (falsifies the daily close).

**Consequence:** in the daily close the "bizum" column includes transfers; the summary to Marisa must say so.

## How a payment finds its reservation (flow 3)

**Decision:** 1) if the concept has a reservation number, use it; 2) otherwise normalise the payer's name (case, accents, spaces) and compare it with `activo` reservations: **one** exact match → register; **zero or several** → register nothing and ask Marisa. Never match on a partial name.

**Why:** the app has no customer table; mismatching a payment is worse than reviewing it by hand (constitution principle 3). Covers emails 01, 03 and 09 (unique name), 02 (number in concept), 05 and 07 (ask).

**Rejected:** approximate matching (risk of assigning to someone else); always asking unless the number is in the concept (removes almost all the automation).

**Pending:** how HU-11 (Telegram, Advanced level) identifies the customer; decided if we reach that level.

## Monthly report: settled and expired

**Decision:** postponed to the Medium level. Details in [future-implementation-ideas.md](future-implementation-ideas.md).

**Why:** flow 7 is not in Essential.

## Consent to receive messages

**Decision:** at Essential, consent is implied: whoever gives their `email` on the reservation receives notices **only about that reservation**. Real consent tracking is postponed to HU-14 (Advanced).

**Why:** the app doesn't store consent and flows 1 and 2 already need to write to the customer. A separate register would add logic to every message.

**Rejected:** a consent list in Google Sheets from the start.

## Agent tooling: Claude Code and OpenCode

**Decision:** the two teammates use different agents: Manon uses **Claude Code**, David uses **OpenCode with a paid GPT model** (stated as "GPT 6.1"; confirm the exact model name for the AI log). Everything we create must work with **both**. The same scope rules apply to both: each agent edits only the owner's spec and flow files on the branch of the assigned issue (`feat/<issue#>-…`); never the partner's files, `main`, `backend/` or `frontend/`.

**How we keep it agent-neutral:**
- David owns `AGENTS.md` (deliverable #17). Claude-specific needs are documented in the project's **`CLAUDE.md`**; `AGENTS.md` can point to it if needed. We don't duplicate the rules.
- Specs, ontology and decisions are plain Markdown; no agent-specific syntax.
- OpenSpec is initialised for both tools (`claude` and `opencode`).

**Why:** the README allows paid AI if its scope is delimited; two different agents only stay consistent if the rules live in one place.

**Rejected:** Claude Code for both (not what David uses); a full rules file per agent (they would drift); creating an `AGENTS.md` ourselves (David is writing it).

## Language policy

**Decision:** everything in the repo is written in **English** (docs, specs, ontology, decisions, agent instructions, workflow and node names, commit messages, PR text). Only **customer-facing content** is in **Spanish**: emails and messages sent to customers and to Marisa. App field and event names (`apartado`, `abono`, `fecha_limite`, `apartado.creado`) stay as the app defines them.

**Why:** the team works in English; the shop's customers and owner read Spanish.

**Rejected:** all Spanish (the first drafts); all English including customer messages (customers wouldn't understand).

## Commit language
2026-10-23 (confirmed for commits **and PR titles/descriptions**)

**Decision:** Conventional Commits, message in **English** (`feat: add apartado confirmation flow`). Types: feat, fix, refactor, docs, chore, test.

**Why:** a scannable prefix, and consistent with the language policy. The template's history doesn't count as our convention: those are the teacher's commits.

**Rejected:** plain sentences with no prefix (less scannable); Spanish messages (superseded by the language policy).

## Spec tooling: OpenSpec

**Decision:** specs are written and managed with **OpenSpec** (`openspec/` folder, initialised for Claude Code and OpenCode, language `en`). The Spanish-then-translated drafts in `specs/` (`spec.md`, `08-error-workflow.md`, `ontologia.md`) are kept as source material and will be redone under OpenSpec.

**Why:** the team wants a spec workflow that both agents run the same way (`/opsx:propose` in Claude Code, `/opsx-propose` in OpenCode).

**Rejected:** our own spec template under `specs/` (the first approach; replaced by OpenSpec's artifacts).

## n8n email account

**Decision:** a single Gmail account (OAuth2 credential in n8n) both reads the bank notices and sends all messages. A dedicated team account, not a personal one.

**Why:** one credential, simplest to set up and document. The test emails from `data/correos/` are sent to that same inbox.

**Rejected:** two accounts (more credentials with no clear gain at Essential); reading over IMAP (needs an app password and another credential type).

**Consequence:** flow 3 must filter the inbox (e.g. by the bank's sender/subject) so it doesn't process its own sent mail or customer replies.

## AI model inside n8n (flow 3)
2026-10-23 (supersedes the earlier OpenRouter choice; aligns with `AGENTS.md`)

**Decision:** a model served by **Groq** that only extracts `ordenante`, `importe`, `concepto` and `tipo` from the email text. The Groq API key is already provided to n8n as a credential (never in Git). The specific model is chosen by testing the 9 emails and noted in `docs/ai-log.md`.

**Why:** Groq's free tier costs nothing, is fast, is named in the README as an option, and the key is already configured. The model receives only the text of the bank notice (data minimisation). The flow makes the decisions, so a less accurate model can't register a payment wrongly.

**Rejected:** OpenRouter `:free` models (a second provider and key with no gain now that Groq is set up); Gemini free tier (usage limits can break runs); paid Claude API (cost per email and another key to manage).

**Risk:** free tiers have rate limits and can fail. The flow must validate the output (required fields, numeric amount) and, if invalid, ask Marisa instead of registering.

## Daily close history

**Decision:** Google Sheets, one row per `fecha`, written with an *upsert* by date (re-running the close for the same day updates the row, it doesn't create another).

**Why:** Marisa can open and check it as a sheet; the README proposes Sheets for what the app doesn't store; satisfies FR-31 and idempotency.

**Rejected:** n8n data table (Marisa can't see it and it's lost if n8n data is wiped); local CSV (invisible to Marisa, awkward in Docker).

**Consequence:** needs a Google Sheets credential (can be the same account as Gmail) and the sheet ID as a variable, not in the JSON.

## Daily close time and day

**Decision:** the close runs at **23:55** (Europe/Madrid) and covers **the current day**. Anything registered after 23:55 falls in the next day's close.

**Why:** Marisa receives the summary that same night and the close date matches the calendar day; avoids subtracting a day in the flow.

**Rejected:** 00:05 for the previous day (summary after the day ended, more date logic); the shop's closing time (misses later remote payments).

**Consequence:** flow 3 may register a deposit at 23:58 that is not in that day's close; document this in the daily-close spec.

## Alert email failure and repeated alerts (flow 08)

**Decision:** (1) If sending the alert itself fails, the error stays only in n8n's execution history; the risk is documented and the team checks that history periodically. (2) One alert per failed execution, with no limit or grouping.

**Why:** the README asks for one alert channel at Essential; a backup channel adds a dependency to the flow that must not fail. Flows 1, 2 and 3 are event-driven and flow 5 runs once a night, so a flood is unlikely. An hourly limit could hide a second, different error.

**Rejected:** backup in Google Sheets or Telegram (more pieces, Telegram postponed to Advanced); at most one alert per flow per hour (needs state and can hide errors).

**Postponed:** grouping alerts and a backup channel → [future-implementation-ideas.md](future-implementation-ideas.md).

## Flow split between Manon and David
2026-10-22 (decided; replaces the earlier "decide later")

**Decision:**
- **Manon:** `add-error-workflow` (HU-05, flow 08), `add-event-router`, `add-reservation-confirmation` (HU-01, flow 01), `add-deposit-receipt` (HU-02, flow 02), and deliverable #20 (demo-data flow). 49 flow tasks.
- **David:** `add-remote-deposits` (HU-03, flow 03), `add-daily-close` (HU-04, flow 05), and deliverable #21 (execution evidence). 32 flow tasks. David also keeps AGENTS.md, the AI log and the process map.
- Each reviews the other's PRs.

**Why:** flows 08, router, 01 and 02 share one pattern (payload in, Spanish email out, missing-email branch), so one owner avoids duplicate work. Flows 03 and 05 are fewer but harder, and David also holds three documentation deliverables. It lets both start in parallel: Manon builds 08 first, then the router with stubs; David's flow 05 needs nothing else and flow 03 only needs 08 wired in (flow 03 never emails customers, so a receipt stub is enough).

**Rejected:** the mirror split (Manon 03 and 05, David the rest), better only if David had less documentation time.

**Watch:** HU-03 is the riskiest flow and David uses a different agent; review it together once the nine sample emails run.


## Payer-name matching refinement (flow 3)
Refines "How a payment finds its reservation (flow 3)". Found while writing the specs against the sample data: the stored names are short ("Carmen Ruiz", "Lucía Gómez", "Paula Ramos") but the bank gives full names ("CARMEN RUIZ GARCIA", "LUCIA GOMEZ PEREZ", "PAULA RAMOS LEON"), so a strict exact-name match would fail on 01, 03 and 06.

**Decision:** the order is now: 1) reservation number in the concept; 2) otherwise normalise names (case, accents, spaces) and match an `activo` reservation whose stored name words are **all contained** in the payer's name; exactly **one** match → use it; 3) if the payer is abbreviated (e.g. "LAURA O."), accept it only when the first name matches, the surname starts with the initial, **and** the concept names the product of exactly one such reservation. Zero or several matches → register nothing and ask Marisa. Never guess.

**Why:** reproduces the expected outcomes of all 9 sample emails (01, 03, 06, 09 by contained name; 02 by number; 04 by abbreviated name + product; 05 and 07 ask Marisa) while keeping the "when in doubt, ask" rule.

**Rejected:** exact full-name equality (fails the sample data); fuzzy/similarity matching (risk of assigning to someone else).

**To confirm:** that the abbreviated-payer rule (3) is acceptable, and verify it against the seeded names when the flow is built.

## Branching model and issues per flow
2026-10-23 (supersedes the `flow-<name>` / `docs-<topic>` branch names and the "PR to `main`" rule; aligns with `AGENTS.md`)

**Decision:**
- Branches are created from `dev` and named `feat/<issue#>-<short-description>`, `docs/<issue#>-<short-description>` or `fix/<issue#>-<short-description>`. One issue = one branch = one PR.
- PRs target **`dev`**, reference the issue and carry a standalone `Closes #N` line (`Refs #N` if partial). `dev` → `main` goes through a reviewed PR. Nobody pushes to `dev` or `main`.
- PR titles, PR descriptions and commits are in **English**.

**Issues per flow** (GitHub issues keep their original Spanish titles):

| Issue | Flow / OpenSpec change | Owner | Branch |
|---|---|---|---|
| #5 HU-05 · Avisos de errores | 08 · `add-error-workflow` | Manon | `feat/5-error-workflow` |
| #1 HU-01 · Confirmación al apartar | 01 · `add-reservation-confirmation` | Manon | `feat/1-reservation-confirmation` |
| #2 HU-02 · Recibo de cada abono | 02 · `add-deposit-receipt` | Manon | `feat/2-deposit-receipt` |
| #3 HU-03 · Abonos por Bizum o transferencia… | 03 · `add-remote-deposits` | David | `feat/3-remote-deposits` |
| #4 HU-04 · Cierre de caja automático | 05 · `add-daily-close` | David | `feat/4-daily-close` |
| #20 Flujo de prueba | demo-data flow | Manon | `feat/20-demo-data-flow` |
| #21 Prueba y evidencias de ejecución | execution evidence | David | `docs/21-execution-evidence` |
| *(none yet)* | `add-event-router` (routes events to 01 and 02) | Manon | **create an issue first**, then `feat/<issue#>-event-router` |

**Why:** one convention for both agents and for the issue-closing automation (`Closes #N` only closes issues when merged into `dev`).

**Open:** the router has no issue; create one (or attach it to #1/#2) before starting it.
