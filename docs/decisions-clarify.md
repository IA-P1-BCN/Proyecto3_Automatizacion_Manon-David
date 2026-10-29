# Decisions · Clarify phase

> One decision per section, written at decision time. Format: decision · why · rejected alternatives. All dates 2026-10-22.

## Target level

**Decision:** we commit to the 🟢 Essential level (flows 1, 2, 3, 5 and 8 + deliverables). We reassess 🟡 Medium once the Essential flows pass their tests.

**Why:** the 5 Essential stories and the deliverables are already a lot of work, and no story is assigned or started. Widening scope before anything works is the main risk.

**Rejected:** Essential + Medium from the start (more specs up front, risk of leaving things half done); Advanced (unrealistic for now).

## Notification channel

**Decision:** email (the team's Infomaniak mailbox) for all notices, to customers and to Marisa. Telegram is left for later (Advanced level).

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

**Decision:** at Essential, consent is implied: whoever gives their `email` on the reservation receives notices **only about that reservation**. Real consent tracking is postponed to HU-14 (Advanced); decided in [Personal data: consent register](#personal-data-consent-register-hu-14).

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
2026-10-23 (updated: Gmail replaced by an Infomaniak mailbox; confirmed with David)

**Decision:** a single dedicated team mailbox on **Infomaniak** both reads the bank notices (IMAP, `mail.infomaniak.com:993`, SSL/TLS) and sends all messages (SMTP, port 587 STARTTLS or 465 SSL/TLS). Two n8n credentials (IMAP and SMTP) use a mailbox password generated in Infomaniak for the device; never the account password, and never in Git. Not a personal account.

**Why:** the team created this mailbox, it is free, and n8n's Send Email and Email Trigger (IMAP) nodes need no paid feature. The test emails from `data/correos/` are sent to that same inbox.

**Rejected:** Gmail OAuth2 (the team does not use it any more); two mailboxes (more credentials with no clear gain at Essential).

**Consequence:** flow 03 reads with the Email Trigger (IMAP) node and the others send with Send Email (SMTP); the sender address comes from `TIENDA_EMAIL_FROM`. Google Sheets (flow 05) still needs its own Google credential.

**Pitfall found:** a stray space before the user name or host in a credential gives misleading errors (`COMMAND FAILED`, `ENOTFOUND`). Re-type those fields.

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

**Consequence:** needs a Google Sheets credential (a Google account; the mailbox is on Infomaniak) and the sheet ID as an environment variable, not in the JSON (n8n Variables are paid, see [decision](#alert-address-and-local-port-without-paid-n8n-features)).

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
| #32 Event router (single webhook, routes app events to flows 01 and 02) | `add-event-router` | Manon | `feat/32-event-router` |
| #7 HU-07 · Apartados vencidos con su vale | 06b · `add-expired-reservations` | Manon | `feat/7-expired-reservations` |
| #13 HU-13 · Entrada automática de datos | 11 and 11b · `add-home-reservations` (plus a hook in flow 03) | Manon (the flow 03 hook needs David's agreement) | `feat/13-home-reservations` |

**Why:** one convention for both agents and for the issue-closing automation (`Closes #N` only closes issues when merged into `dev`).

**Update:** the router issue was created as #32.

## Alert address and local port without paid n8n features
2026-10-23

**Decision:**
- n8n *Variables* (`$vars`) need a paid plan (Cloud Pro or self-hosted Business), and we pay for nothing in n8n. `TIENDA_EMAIL_AVISOS` is a plain environment variable: `.env` (git-ignored) → `docker-compose.yml` → n8n container, read as `$env.TIENDA_EMAIL_AVISOS`. n8n v2 blocks that access by default, so the n8n service sets `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. This applies to every flow that needs the shop address.
- The host port of the app is `${TIENDA_PORT:-8000}`. A teammate whose port 8000 is busy sets `TIENDA_PORT=8001` in their own `.env`. Containers talk over Docker's network, so n8n still calls `http://tienda:8000`; exported flows must never contain `localhost` or `8001`.

**Why:** zero cost, no real address in Git, and no per-person edit of `docker-compose.yml`.

**Rejected:** a local uncommitted edit of the port mapping (easy to commit by mistake); a hard-coded address in the flow JSON (real data in Git).

**Consequence:** a plain environment variable is readable by every workflow of that instance, so it must hold no secret. The shop address is not one.

## Expired reservations and vouchers (flow 06b, HU-07)
2026-10-26 (Medium level; board assigns #6 and #7 to Manon)

**Decision:**
- Own workflow `06b Expired Reservations`, separate from flow 06 (reminders), run every day at **09:05 Europe/Madrid** and by hand for a chosen date.
- A reservation is expired when it is `activo` and its `fecha_limite` is **strictly before** the run date (the deadline day itself is still valid, as in the app). The flow calls `POST /api/apartados/{id}/vencer`; the app creates the voucher.
- The customer gets one Spanish email with the voucher `codigo` and `importe` from the app's response, and a note that the voucher is store credit, never cash. Marisa gets **one summary per run**: the shoes that go back on sale and the customers she must tell by hand (no usable `email`, or the email bounced).
- No sent-record file: once expired a reservation is `vencido` and no longer listed, so a re-run does nothing. Each expiry has its own error output; the run fails at the end if any expiry or email failed, so flow 08 alerts.
- The router keeps ignoring `apartado.vencido`, so the voucher email is sent only by this flow.

**Why:** the app never closes a late reservation by itself, and the README asks for expiry by API, a voucher message and a list for Marisa. Expiry is a one-way state change, so the app itself gives idempotency.

**Rejected:** doing it inside flow 06 (a failure expiring one reservation could block reminders); handling `apartado.vencido` in the router (loses the one summary per run; open question if Marisa expires by hand); a catch-up rule (the selection already covers every reservation before today, so the next run recovers a missed day).

**Consequence:** a reservation expired by hand from the app screen sends no voucher email. If the expiry succeeds but the customer email fails, there is no automatic retry: the voucher code is in Marisa's summary and in the alert. The app checks its own real date, so a manual run with a past date can only narrow what is expired.
## Due date reminders (flow 06, HU-06)
2026-10-26 (Medium level taken up after the Essential flows; board assigns #6 and #7 to Manon)

**Decision:**
- The flow runs every day at **09:00 Europe/Madrid** and can be run by hand for a chosen date.
- A reservation is reminded when it is `activo` and its `fecha_limite` is **exactly** 7 days or exactly 1 day after the run date. No catch-up for a day when n8n was down.
- Each reminder is sent **once**: a sent-record `avisos.csv` in the same kDrive folder as the daily-close history (columns `apartado_id;umbral;resultado;fecha_envio`, semicolons, one row per reservation and threshold). It is a separate file; `basedatos.csv` (HU-04) is never touched. David confirmed the folder and credential can be shared.
- A reservation without a usable `email` alerts the shop once and is recorded as `sin_email`.
- Emails go out directly from the flow (no shared notification sub-workflow), in Spanish, with the app's amounts as sent.

**Why:** the app emits no event before a deadline, so the flow is time-driven. The README asks for "once" per reminder, which needs a record that survives restarts; kDrive is already set up for HU-04 and Marisa can open the file.

**Rejected:** n8n static data (invisible, lost with n8n data); no record (a re-run sends twice); "7 days or fewer and not yet reminded" catch-up (changes what "7 days" means; revisit if missed runs become a problem); a shared notification sub-workflow (already deferred for flows 01 and 02).

**Consequence:** if the email is accepted but `avisos.csv` cannot be saved, the next run would send it again; the save fails loudly so flow 08 alerts. This does not contradict the Essential target level: [Target level](#target-level) said to reassess Medium once the Essential flows pass their tests.

## Excel migration: idempotency (HU-10)
2026-10-26

**Decision:** the migration finds out whether a row is already loaded by **querying the app itself**, with no import register. Before each create it looks for the same natural key and skips if found: apartado = `cliente` + `producto` + `fecha` + `precio`; abono = apartado + `fecha` + `importe`; venta = `fecha` + `concepto` + `importe`. When identical rows legitimately repeat on the same day, it compares **counts** (CSV occurrences vs. rows already in the app) and only creates the difference.

**Why:** the API has no idempotency key and apartados have no notes field to carry a marker. The app is the single source of truth (constitution principle 1), so a second register could drift from it, and a lookup keeps working if any register or n8n data is wiped.

**Rejected:** import register in Google Sheets (second source of truth, a deleted sheet means duplicates); n8n data table (invisible to Marisa, lost if n8n data is wiped).

**Consequence:** the app's `fecha_limite` is `fecha` + 90 days, so a re-run is only safe while the lookup can see the first run's rows (the app has no delete endpoint, which fits).

## Excel migration: webhook side effects (HU-10)
2026-10-26

**Decision:** the app sends a webhook for every apartado, abono and venta created through the API, and cannot be told not to. So the migration flow switches a **"migration running" flag on** at the start and **off** at the end, and also in its error branch. While the flag is on, the event router (flow 00) drops every event without calling flows 01/02. Marisa runs the migration once with the shop closed, so no real event is lost in that window. The flag lives in n8n (workflow static data or a data table; the spec picks one).

**Why:** the CSVs have no `email`, so each historical row would trigger a "could not send" alert to Marisa (about 12). Skipping by old `fecha` is not safe: in `abono.registrado` the payload's `fecha` is the **apartado's** creation date, so a genuine new deposit on an older apartado would be dropped.

**Rejected:** skip by old `fecha` (drops genuine deposits, see above); unsetting `N8N_WEBHOOK_URL` during the run (manual, and a forgotten restore silently kills all notices); letting the events through (about 12 noise alerts).

**Consequence:** flow 00 (Manon, already merged) gets a small change; it needs its own test (flag on → event ignored, flag off → routed as today). The flag must be reset even if the migration fails, and the Error Workflow alert should say when it was left on.

## Excel migration: report channel (HU-10)
2026-10-26

**Decision:** one **Spanish email** per run to Marisa (`TIENDA_EMAIL_AVISOS`, same SMTP credential as the other notices) with the result in the body: how many rows were loaded, how many skipped as already loaded, and a table of the rows held back with their reason. Re-running resends it, which also shows what is still pending.

**Why:** email is already the channel for Marisa ([decision](#notification-channel)); no new credential or variable.

**Rejected:** CSV attachment (extra binary step and a re-feed path the story doesn't ask for); Google Sheet (second place to look, new sheet ID variable).

## Excel migration: doubtful rows (HU-10)
2026-10-26

**Decision:** a row is **held back and reported, never loaded**, when: the initial abono is under €5 (Lucía Gómez, €4); an abono exceeds the pending balance; `fecha`, `importe` or `cliente` is missing or unparseable; or it is a later abono of an apartado that was itself held back (Lucía's €41). **Cleaning is not doubt:** name casing (`carmen ruiz`), 2-digit years (`7/9/26`), `15€`, phone spacing and a missing phone are fixed silently. Lines in the sales file that repeat an apartado deposit ("… abono inicial apartado", "Abono Ana Torres …", "… (apartado)") are skipped as already counted, not loaded as ventas and not reported as doubtful. The "TOTAL SEPTIEMBRE (a mano)" line is ignored.

**Why:** the rules (min €5, no overpaying, 90-day deadline) belong to the app (constitution principle 4); the flow only decides what to do with a row it cannot load. The old Excel counted initial deposits as sales, but in the app they are abonos ([ontology](../specs/ontologia.md)). Note the deadline is `fecha` + 90 days: every CSV date (02/09 to 06/10) is inside it today (2026-10-26), so no row is held for being expired, but the flow must check it for other data.

**Rejected:** also holding same-customer-different-phone rows (more review for Marisa on a small sample); sending everything and reporting only the app's 422s (relies on the app's rejection against the story's wording).

**Resolved below:** `forma_pago` for apartado rows.

## Excel migration: payment method (HU-10)
2026-10-26

**Decision:** the apartados CSV has no `forma_pago`. For each deposit the flow uses the `forma_pago` of a sales-file line with the same `fecha` and `importe` (the file shows 3: efectivo, efectivo, bizum); with no match it sends `efectivo`. The report states which deposits got the default so Marisa can correct them.

**Why:** uses the only real evidence we have without holding most rows, and the default is the in-shop norm.

**Rejected:** always `efectivo` (ignores the visible Bizum deposit and skews the splits); holding rows with no match (holds most of the 12).

## Excel migration: owner and timing (HU-10)
2026-10-27 (supersedes the "after Essential" version of 2026-10-26)

**Decision:** **Manon** owns HU-10 (issue #10, OpenSpec change `add-excel-migration`, branch `feat/10-excel-migration` from `dev`) and builds it **now**, without waiting for the Essential evidence and the remaining open stories (HU-03, HU-07, HU-08). The small migration-flag change to flow 00 is part of the same change and PR.

**Why:** flows 01, 02, 04, 05, 06, 08 and the router are merged in `dev`, and HU-10 depends on none of the open stories. Medium has already been taken up ([Due date reminders](#due-date-reminders-flow-06-hu-06)). The branch starts from the current `dev`, so the flow 00 change builds on what is merged.

**Rejected:** waiting for every Essential item (HU-03 and the evidence are David's and do not block this); David builds it (flow 00 is Manon's).

**Consequence:** add #10 to the owner table in [Branching model and issues per flow](#branching-model-and-issues-per-flow); issue #10 is already assigned to Manon. Rebase on `dev` before the PR in case HU-03 or HU-07 touch flow 00.

## Excel migration: how the CSV files arrive (HU-10)
2026-10-27

**Decision:** the migration flow starts from an n8n **Form Trigger with two file uploads** (apartados CSV and sales CSV); Extract From File parses them. `data/excel_actual_*.csv` are the files used in tests. No change to `docker-compose.yml`.

**Why:** n8n runs in Docker with no access to the repo's `data/` folder, and n8n 2 restricts disk nodes. A form needs no volume or file-access setting, works on every machine, and lets Marisa re-run it with a corrected export.

**Rejected:** mounting `data/` read-only into the n8n container (compose change for everyone, allow-list env vars, path differs per OS); uploading the CSVs to kDrive first (extra manual step and a dependency on the shared HU-04 folder for a one-off).

**Also decided while writing the specs (to confirm in review):** (1) a sales line is a deposit repeat only if its concept mentions `abono` or `apartado` *and* a deposit has the same `fecha` and `importe`; a deposit-looking line with no match is held for Marisa; (2) a later row with a different `precio` than the first of its reservation is held; (3) the app's `422` is a safety net: it holds the row with the app's message; (4) the migration flag expires after 30 minutes so a crashed run cannot silence the shop forever.

## Personal data: webhook authentication (HU-14)
2026-10-28

**Decision:** flow 00 accepts an event only with the shared secret `TIENDA_WEBHOOK_TOKEN`, in the `X-Webhook-Token` header or in the `?token=` query parameter, checked in a Code node (constant-time compare). Anything else gets `401` and no handler runs. The app's own calls carry the token in `N8N_WEBHOOK_URL`. An empty configured token rejects everything and raises a flow 08 alert; a wrong token does not alert (no email flood from probes).

**Why:** the app is given and its sender (`backend/services/n8n.py`) only sends `Content-Type`, so the Webhook node's Header Auth would reject the app itself.

**Rejected:** a secret in the webhook path (the path lands in the exported JSON, a secret in Git); a reverse proxy that injects the header (one more service for a small project); Header Auth on the node (breaks every flow). **Known limit:** a token in a URL can appear in access logs; fine on the Docker network, but over the internet (HU-16) it needs HTTPS and rotation.

**Consequence:** everyone changes their own `.env`: `TIENDA_WEBHOOK_TOKEN` and `N8N_WEBHOOK_URL=…/webhook/tienda?token=…`, then `docker compose -p paso-firme up -d`.

## Personal data: consent register (HU-14)
2026-10-28

**Decision:** an n8n Data Table `consentimientos` (`email` normalised, `estado` `activo`/`retirado`, `fecha`, `origen`) is the only list of people we may write to. `apartado.creado` with a valid email records `activo` (origin `tienda`) unless the row is `retirado`; the manual flow `09b` backfills the customers already in the app. Flows 01 and 02 are gated by the router; flows 06 and 06b call `09 Consent Check` before each customer email. Marisa withdraws consent by setting `estado` to `retirado`. A missing row, a withdrawn row, an invalid email or an unreadable table all mean **do not send**; an event with no email still reaches flows 01 and 02, which only warn the shop.

**Why:** the Data Table is what flow 10 already uses, needs no credential and can be edited by Marisa. Failing closed is the opposite of the migration flag on purpose: writing to someone who did not agree is worse than a missed message.

**Rejected:** Google Sheets (new credential, second system); explicit opt-in email with a confirm link (needs a public endpoint, stays in [future ideas](future-implementation-ideas.md)); editing flows 01 and 02 (the router already sees every event).

**Assumption to confirm with Marisa:** an email given in the shop counts as consent for notices about that reservation, as the Essential decision already stated.

## Personal data: what reaches an AI model (HU-14)
2026-10-28

**Decision:** `docs/ai-data-inventory.md` lists every AI node, what it receives and what it never receives. A unit test fails when an exported flow has an AI node that the inventory does not name.

**Why:** a document alone drifts; the test keeps it honest. The test checks that the node is declared, not what data flows into it, which stays a review item.

## Home reservations from the web (HU-13, option A)
2026-10-29 (David agreed to the flow 03 hook on 2026-10-29)

**Decision:**
- HU-13 is covered by its first option only (*apartados desde casa*). The card-terminal CSV is out of scope.
- The customer asks through an n8n **Form Trigger** (no Telegram). The model comes from a **fixed price list in the flow**; the customer never types a price. The request waits in the Data Table `solicitudes_apartado` (`ref` as `SOL-0001`, customer data, `producto`, `talla`, `precio`, `estado`, `apartado_id`, `fecha`, `payment_key`).
- The apartado is created **when the matching payment arrives**, not by a person: a new sub-workflow `11b Match Pending Request` decides, claims the row, calls `POST /api/apartados` with the paid amount as `abono_inicial` and updates the row. Flow 01 sends the confirmation because the app emits `apartado.creado`.
- Matching: a `SOL-…` reference in the concept makes that request the only candidate (the payer must fit its name). Without it, only one pending request fitting the full payer name and **no active reservation fitting it** is accepted; abbreviated payers need the reference. Anything else goes to Marisa.
- Flow 03 gets a hook of three nodes (Execute Workflow, Switch, NoOp) **before** `Keep Bank Notice Context…`; `not_mine` leaves every existing payment untouched, anything unexpected goes to the existing review email.
- Consent goes through flow 09 (`registrar`); its origin is `tienda` because flow 09 takes no origin.

**Why:** the app refuses an apartado without a deposit, and the README confirms the reservation when the deposit arrives, so the payment must create it. Doing it in a sub-workflow keeps the edit to flow 03 small and testable.

**Rejected:** a confirmation form for Marisa (the extra manual step was too costly); a second flow reading the same mailbox (a payment could be processed twice); price typed by the customer (untrusted amount); name-only matching without the reservation guard (could take a payment that belongs to an existing apartado).

**Agreement:** David, who owns flow 03, agreed on 2026-10-29 to the three-node hook, because the project rules say not to touch a partner's files. He reviews the PR that changes `workflows/03-remote-deposits.json`.
