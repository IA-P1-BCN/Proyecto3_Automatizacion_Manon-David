# Proposal

## Why

**Issue #12 — HU-12 · Marisa pregunta a su negocio**, assigned to David (`davidlafuentem`), asks for private Telegram access to the shop's current figures. Marisa should receive verified answers without opening reports, while neither a forged identity nor prompt injection can widen access or trigger a business write.

## What Changes

- Add **12 Shop Telegram Assistant**, limited to two questions and equivalent Spanish phrasings: this week's collections (Monday through today in `Europe/Madrid`) and currently active reservations with deadlines in the current calendar month, including already-overdue active reservations.
- Authenticate a dedicated local Telegram bridge and independently authorize Marisa's numeric user/chat identifiers before any model or shop call. No username-based or conversational enrollment.
- Use a Groq-backed n8n AI Agent only to select a closed read plan. Validate the selection outside the model, perform fixed API GETs outside the agent's context, and construct Spanish replies with deterministic code/templates. No raw customer records, balances, deadlines or arbitrary user text reach Groq.
- Add a deterministic pre-send verification rubric: permitted intent/period, complete successful responses, valid dates/IDs/amounts, integer-cent calculations, stable ordering and escaped/chunked output. An error must not become a plausible zero result.
- Add the user-approved local polling bridge as an isolated optional Docker service: no public port, tunnel, shop credential or access to n8n's persistent volume. Persist only minimum local delivery/deduplication metadata; document uncertain-delivery handling without claiming exactly-once Telegram delivery.
- Include bounded requests/rate limits, malicious-input fixtures, read-only API comparisons, disposable integration tests, editor testing and an explicitly authorized real Telegram exchange before review readiness.
- Keep all exports inactive and effect gates off. No changes to the shop app, existing workflow layout/credentials, HU-11 client linking or HU-13 inputs.

## Capabilities

### New Capabilities

- `shop-telegram-assistant`: private owner authorization, two constrained read-only questions, model isolation, deterministic verification/replies and safe local Telegram delivery.

### Modified Capabilities

None. There are no main capability specs yet (`openspec list --specs`); the integrated HU-14 constraints in its existing change and `docs/ai-data-inventory.md` remain unchanged. This delivery will document its own AI data flow rather than relax those rules.

## Impact

- New workflow/helper/tests/setup files scoped to #12; append-only coordination for `docs/ai-log.md` and an additional entry in `docs/ai-data-inventory.md`. Reuse existing monetary/date techniques without changing HU-04/HU-08 behavior.
- New optional `docker-compose.shop-assistant.yml` and a small bridge service. Bot token and bridge key stay in owner-private files outside the repo, mounted read-only; environment configuration contains only paths, IDs and effect gates. Bridge authentication and shop Header Auth (`X-API-Key`) remain distinct. Start only the new bridge after permission; do not recreate the current shop/n8n services.
- API reads: `GET /api/ventas`, `GET /api/abonos`, `GET /api/apartados?estado=activo`. No application POST/PUT/PATCH/DELETE, direct database access, external history writes or customer messaging.
- HU-14 is merged, but that does not prove David's local drafts or consent table are updated. HU-11/12 use separate bots; coordinate HU-13's bot ownership with Manon before real use. The shop assistant's owner authorization is separate from customer email consent.
- Initial timebox: five hours of active agent/manual-test work, excluding waiting and human PR review. Finish the two questions first; reassess at the timebox rather than weaken safety or expand scope.
