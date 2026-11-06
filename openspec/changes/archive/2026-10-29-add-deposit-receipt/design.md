# Design

## Context

`abono.registrado` carries the updated reservation plus `importe`: `id, cliente, telefono, email, producto, talla, precio, abonado, pendiente, fecha_limite, estado, importe`. `estado` is the state **after** the deposit, so `liquidado` means the last payment was made. The app fires the event for both screen and API deposits. See proposal.md and `specs/deposit-receipt/spec.md`.

## Goals / Non-Goals

**Goals:** a small sub-workflow almost identical in shape to flow 01, so teammates can reuse the formatting and the missing-email branch.

**Non-Goals:** deciding anything about whether a deposit is valid (the app already did); sending receipts from flow 03; PDF receipts.

## Decisions

1. **Branch on `datos.estado`** with an IF (`liquidado` vs otherwise) to pick the message text. This is exactly what the app's design intends: the state travels in the event.

2. **Reuse flow 01's formatting and missing-email approach** (Code node for Spanish formatting; IF on a validity check; shop alert path that ends successfully). To avoid duplicating logic, a shared formatting sub-workflow may be extracted later. *Alternative:* extract it now; rejected because it adds a dependency between the two owners' work before either flow exists.

3. **Receipt flow, not the remote-deposit flow, sends the customer message.** Keeps one place that talks to the customer about deposits and guarantees screen and API deposits behave the same.

4. **No API calls.** The event carries everything needed.

## Risks / Trade-offs

- **[Duplicate logic with flow 01]** → Accepted for Essential; revisit extraction once both exist.
- **[Event lost while n8n is down]** A deposit registered while n8n is down gets no receipt. → Accepted, documented.
- **[Event for the initial deposit does not exist]** The first deposit is covered by flow 01's confirmation. → Stated in the proposal so nobody expects a receipt for it.
