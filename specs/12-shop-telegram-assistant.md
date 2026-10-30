# Shop Telegram assistant — HU-12

**Issue:** #12 — HU-12 · Marisa pregunta a su negocio. **Owner:** David.
**Branch:** `feat/12-shop-telegram-assistant`.

Normative contract, architecture and checklist:
[`add-shop-telegram-assistant`](../openspec/changes/add-shop-telegram-assistant/).

## Scope

Only the configured owner in a private Telegram chat can ask:

1. **¿Cuánto se ha recaudado esta semana?** Monday through today, inclusive, in
   `Europe/Madrid`. Direct sales, payments (initial ones counted once) and total.
2. **¿Qué apartados vencen este mes?** Currently active reservations whose API
   deadline falls in the current month, including already-overdue active ones.
   Show number, customer, product/size, API pending and deadline. Deadline day is
   still valid; only earlier dates get `Fuera de plazo`.

Aliases `/semana` and `/vencimientos` and explicitly tested Spanish equivalents
are supported. Other periods, customer-specific filters, modifications and
ambiguous requests return help without reading the shop. No conversation memory.

## Inputs, outputs and entities

Dedicated bridge envelope: request ID plus original private text update with
numeric sender/chat IDs, update/message IDs and Telegram date. Authenticate the
bridge and validate the owner independently in n8n before further calls.

Response: `{request_id, status, messages}`; never a model-selected destination.
The bridge sends only to its locally configured owner. Entities read through the
API are `Venta`, `Abono` and `Apartado`; none is created or changed. The bridge's
own cursor/delivery journal is not an app database or a financial ledger.

## Security and correctness

- AI only chooses a closed plan from a constant canonical query. It sees no raw
  Telegram question, owner IDs, API results, customer data, amounts or dates.
- Code verifies tool evidence and plan, fixes GET URLs/date boundaries, validates
  source completeness/IDs/amounts and produces fixed Spanish templates.
- Amounts are integer cents. Copy individual `pendiente` from the app.
- Missing/invalid data yields unavailability, not guessed totals or zero.
- API texts never return to AI. Plain-text bounded output disables link previews.
- No public endpoint, write tool, arbitrary URL, direct app database access or
  customer message. Telegram sees the authorized business replies; bots are not
  end-to-end encrypted secret chats.

## Configuration and error paths

Names and exact guided steps are in
[`docs/shop-telegram-assistant-setup.md`](../docs/shop-telegram-assistant-setup.md).
Shop auth is `X-API-Key`, bridge auth is `X-HU12-Bridge-Key`; both differ from bot,
Groq and n8n-management credentials. Exports are inactive, credential-free and
effect-disabled. Unauthorized requests are silent; unsupported owner questions
get help; verified empty data gets explicit zero/no-results; model/API/rubric
failures get unavailability and sanitized diagnostics. Uncertain Telegram sends
are held, never blindly replayed.

The bridge logs only fixed poll/outcome/rejection categories, validated reply
status and opaque correlation IDs. A delivered unavailability reply is not a
verified financial answer. One-shot polling consumes the next queued message,
not necessarily the last question typed. See the setup guide before retesting.

## Acceptance and evidence

Both issue criteria require owner-only API-derived replies. The agreed extended
contract additionally requires deterministic templates, authorization outside AI,
negative/adversarial/replay tests, independent GET comparisons, editor testing
and owner-confirmed real Telegram replies. Actual results and remaining blockers
are recorded in [`workflows/tests/12-shop-telegram-assistant.md`](../workflows/tests/12-shop-telegram-assistant.md).

David confirmed both authorized real Telegram replies on 2026-10-29. The tested
draft's sanitized export preserves its editor layout and matches the generated
business logic. With later explicit permission, only HU-12 was published locally
and both questions passed a controlled continuous-mode test without editor
listening; the bridge was stopped afterward. Indefinite operation, automatic Error
Workflow dispatch and live second-account/provider-failure tests are not claimed;
negative and replay coverage is identified as unit/disposable evidence. Cloud
deployment and pair-reviewed integration remain separate from local acceptance.
