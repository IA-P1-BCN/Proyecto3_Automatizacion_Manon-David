# Proposal

## Why

Story HU-14 (Advanced level) asks for three things the flows do not do yet: the n8n webhook accepts any request, nothing checks that a customer agreed to be written to (consent is only *assumed* from having given an email), and it is not written down which personal data leaves the shop for an AI model. Customers' names, emails and balances pass through these flows, so each gap is a real exposure, and the Telegram assistants (HU-11, HU-12) should be built on top of these rules, not before them.

## What Changes

- **Webhook authentication (flow 00).** The router rejects any request that does not carry the shared secret `TIENDA_WEBHOOK_TOKEN`, either in the `X-Webhook-Token` header or in a `?token=` query parameter, and answers `401` without running any other flow. The given app can only send to a URL (it cannot add headers, and we do not change it), so the app's own calls use the query parameter in `N8N_WEBHOOK_URL`; header authentication is for any other caller. The secret lives only in `.env` and in n8n, never in Git.
- **Payload validation (flow 00).** After authentication the router checks the body: `evento` is a non-empty string, `datos` is an object, and each routed event carries the fields its handler needs (`id`, `email` when present is a valid address, `importe` numeric). An invalid body stops there and raises the error alert of flow 08 (without the payload's personal data).
- **Consent register.** A new n8n Data Table `consentimientos` (key: normalised email; fields: status, date, source) is the only list of people we may write to. Consent is recorded when `apartado.creado` arrives with an email (source "in-store at reservation"); a one-off backfill flow records the customers already in the app; Marisa withdraws consent by changing a row's status.
- **Consent check before every customer message.** A new sub-workflow `09 Consent Check` answers "may we write to this email?". Flow 00 uses it for `abono.registrado` (so flow 02 is not called for someone without consent) and flows 06 and 06b call it before each customer email. No row, withdrawn status or an unreadable table all mean **do not send**.
- **AI data disclosure.** A document `docs/ai-data-inventory.md` lists every AI node in the exported flows, what data it receives, what it never receives and the legal basis, plus a test that fails when a flow contains an AI node that is not in the inventory.

## Capabilities

### New Capabilities
- `webhook-authentication`: only requests that prove they come from the app (or an authorised caller) are routed, and only well-formed events reach the handlers.
- `customer-consent`: a customer receives automatic messages only while the consent register allows it.
- `ai-data-disclosure`: what personal data reaches AI models is minimal, documented and checked.

### Modified Capabilities

None in `openspec/specs/` on this branch (the `event-routing` main spec arrives with the archive commit on `chore/archive-merged-changes`). The router behaviours changed here are written as requirements of `webhook-authentication`.

## Impact

- **Edited:** `workflows/00-event-router.json` (token check, 401 response, validation, consent steps) and, to add the consent call, `workflows/06-due-reminders.json` and `workflows/06b-expired-reservations.json` (flows owned by the other teammate: coordinate and get their review on the PR; flows 01 and 02 stay untouched because the router gates them).
- **New:** `workflows/09-consent-check.json`, `workflows/09b-consent-backfill.json`, generators and tests under `workflows/code/`, `workflows/tests/09-consent.md`, `docs/ai-data-inventory.md`.
- **Edited config:** `.env.example` and `docker-compose.yml` (`TIENDA_WEBHOOK_TOKEN`), and `N8N_WEBHOOK_URL` in each person's own `.env` (adds `?token=…`).
- **Rules kept:** no secret in Git; amounts, states and deadlines still come only from the app; the register stores the minimum (email, status, date, source), not names or balances.
- **Behaviour change to announce:** after this lands, an app configured with the old URL gets `401` and flows stop; every teammate must update `N8N_WEBHOOK_URL`.
- **Out of scope:** an explicit opt-in email with a confirm link, authentication of the Telegram bot (HU-11/12), the backup alert channel and alert grouping, rate limiting, TLS (HU-16).
- **Owner:** Manon.
- **Issue · branch:** #14 · `feat/14-personal-data` (PR targets `dev`).
