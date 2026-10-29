# Proposal

## Why

Marisa wants to know about big direct sales even when she is not in the shop (story HU-09, Medium level). The app already announces every direct sale with the `venta.registrada` event, but nothing reads it yet: the event router (change `add-event-router`) accepts it and ignores it.

## What Changes

- Add flow 04, `04 Large Sale Alert`, a sub-workflow called by the router for `venta.registrada`.
- Compare `datos.importe` with a threshold and, when the amount is **strictly greater**, send Marisa a Spanish email with the sale's concept, amount, payment method and date.
- Keep the threshold outside the flow, in the plain environment variable `TIENDA_UMBRAL_VENTA_GRANDE` (`.env` → `docker-compose.yml` → n8n), so changing it never means editing a node.
- Add the `venta.registrada` output of the router's Switch and connect it to the new flow; the router stops ignoring that event.
- Wire flow 08 as the Error Workflow of the new flow; a missing or invalid threshold fails loudly instead of silently never alerting.
- Document the variable in `.env.example` and the README.

## Capabilities

### New Capabilities
- `large-sale-alert`: Marisa is told about every direct sale above a configurable amount, and about no other.

### Modified Capabilities

None in `openspec/specs/` (it is still empty). Note: the `event-routing` delta in `add-event-router` says `venta.registrada` is ignored; this change supersedes that one scenario, and the router change's spec text is updated when this one is applied.

## Impact

- **New file:** `workflows/04-large-sale-alert.json`, without credentials; generator and tests under `workflows/code/` and `workflows/tests/`, following flow 02.
- **Edited file:** `workflows/00-event-router.json` (add one Switch output and one Execute Workflow node), owned by Manon.
- **Edited config:** `.env.example` and `docker-compose.yml` (new `TIENDA_UMBRAL_VENTA_GRANDE`, plain env var; n8n Variables are paid, see [decision](../../../docs/decisions-clarify.md#alert-address-and-local-port-without-paid-n8n-features)). Reuses `TIENDA_EMAIL_AVISOS` and `TIENDA_EMAIL_FROM` and the existing SMTP credential.
- **Depends on:** the event router (#32, merged in `dev`) and flow 08.
- **Rules kept:** the flow only compares the `importe` the app sent; it recalculates nothing and calls no API.
- **Out of scope:** sales made while n8n is down (the app never retries), alerts by Telegram, per-product thresholds, daily totals (HU-04).
- **Owner:** Manon.
- **Issue · branch:** #9 · `feat/9-large-sale-alert` (PR targets `dev`).
