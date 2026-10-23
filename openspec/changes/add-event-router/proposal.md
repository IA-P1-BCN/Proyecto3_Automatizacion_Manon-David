# Proposal

## Why

The app announces everything that happens (reservation created, deposit registered, sale registered, reservation expired) through one webhook. The Essential level requires a **single** webhook that distributes events by their `evento` field. Without it, flows 01 and 02 have no way to receive their events, and the two teammates would fight over one webhook path.

## What Changes

- Add one n8n workflow, `00 Event Router`, with a Webhook node on path `tienda` (POST) that reads the `evento` field and sends each event to its own handling flow.
- Route `apartado.creado` to flow 01 and `abono.registrado` to flow 02. Events with no handler yet (`venta.registrada`, `apartado.vencido`) are accepted and ignored, not errors.
- Keep each handler a separate sub-workflow so each teammate can own and test theirs independently.
- Respond to the app quickly and never make the app wait on message sending.
- Document how to publish the router and how to see events with the Test URL.

## Capabilities

### New Capabilities
- `event-routing`: every event the app sends reaches exactly the flow that handles it, and unknown or unhandled events cause no failure.

### Modified Capabilities

None.

## Impact

- **New file:** `workflows/00-event-router.json`, without credentials.
- **Depends on:** the app's webhook (`N8N_WEBHOOK_URL=http://n8n:5678/webhook/tienda`), already configured in `.env.example`.
- **Constraint from the app:** the app sends each event once, with no retries, and does not know whether n8n handled it. An event sent while n8n is down or the router unpublished is lost.
- Flows 01 and 02 are built as callable sub-workflows (see their changes). Flow 08 must be set as the *Error Workflow* of the router.
- Webhook authentication is not part of the Essential level (Advanced story HU-14).
- **Owner:** Manon (@ManonChab) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** none yet (create one first) (PR targets `dev`).
