# Design

## Context

The app posts `{evento, datos}` to `http://n8n:5678/webhook/tienda` once per event, from a background task with a 5-second timeout, no retries (`backend/services/n8n.py`). n8n puts the request under `body`, so the event name is `$json.body.evento`. The webhook only works on its Production URL when the workflow is published; while building, the Test URL `/webhook-test/tienda` is used. See proposal.md for motivation and `specs/event-routing/spec.md` for behaviour.

## Goals / Non-Goals

**Goals:**
- One router that owns the webhook path and nothing else; handlers are independent sub-workflows.
- Answer the app immediately.

**Non-Goals:**
- Replaying events lost while n8n was down (the app never retries; scheduled flows read the API instead).
- Authenticating the webhook (Advanced story).
- Handling `venta.registrada` and `apartado.vencido` (Medium level flows).

## Decisions

1. **Router + sub-workflows (Execute Workflow) instead of one big workflow.** The two teammates can own separate files (`01-…`, `02-…`) and branches. *Alternative:* all branches inside one workflow; rejected because it forces both people to edit the same JSON file and create merge conflicts.

2. **Switch on `{{ $json.body.evento }}` with a fallback output** that ends successfully. Unhandled and unknown events are not failures (they are visible in the execution history). Events with a missing name go to a dedicated branch that throws, so the error workflow alerts.

3. **Webhook responds immediately** (response mode "immediately") and handlers run after. *Alternative:* wait for the handler; rejected because the app only waits 5 seconds and does not use the answer.

4. **Execute Workflow nodes set to not wait / continue on handler error** so a failing handler does not block routing. The failure is still reported by the handler's own error workflow setting.

5. **Handlers receive `body.datos` and the event name unchanged**, so no handler needs to know about the webhook wrapper.

## Risks / Trade-offs

- **[Lost events]** The app never retries; an unpublished router or stopped n8n silently loses a message. → Documented in the README; publishing the router and `docker compose up -d` are part of the demo checklist. Scheduled flows don't rely on events.
- **[Error workflow on sub-workflows]** Verified (task 3.2): when a handler fails, only the handler's own *Error Workflow* setting fires; the router's does not, because the router run ends successfully. → Flow 08 is set on the router and on every handler; flows 01 and 02 do it in their own tasks (2.1).
- **[Test vs Production URL confusion]** → README states which URL is used when.
