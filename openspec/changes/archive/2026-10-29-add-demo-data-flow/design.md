# Design

## Context

The app creates a reservation with `POST /api/apartados` (`cliente`, `producto`, `precio`, `abono_inicial` required; `telefono`, `email`, `talla`, `forma_pago`, `fecha` optional) and a deposit with `POST /api/apartados/{id}/abonos` (`importe`, optional `forma_pago`). It calculates `abonado`, `pendiente`, `fecha_limite` (`fecha` + 90 days) and `estado`, and it sends `apartado.creado` / `abono.registrado` to the router for every request, whoever makes it. `GET /api/apartados` without `pagina` returns every reservation as a list. See proposal.md and `specs/demo-data-loading/spec.md`.

## Goals / Non-Goals

**Goals:** a short, readable flow that rebuilds the demo story on demand; safe to run twice; no real customer can be emailed.

**Non-Goals:** loading the nine bank emails (flow 03's own test data); creating direct sales (`venta.registrada` has no flow yet); deleting or resetting data (the app has no delete endpoint; a full reset is `docker compose down -v`, documented in the app guide); scheduling.

## Decisions

1. **A flow, not a script**, started by a Manual Trigger. The assignment accepts either; the team works in n8n and the flow doubles as an example of calling the app by API. It is never published.

2. **Scenarios as data in one Code node.** `Build Demo Scenarios` outputs five items, one per demo customer: the `POST /api/apartados` body plus the list of deposits to register afterwards. Prices, deposits and names are literals, so the test notes can state the expected final states. The only computed value is the original date of the overdue reservation (`fecha` = today minus 100 days, so the app's own +90 days puts `fecha_limite` ten days in the past). That is an input date, not a business figure. *Alternative:* five hard-wired HTTP nodes; rejected as repetitive and harder to review.

3. **Idempotency by customer name.** `List Reservations` (`GET /api/apartados`) runs once; a Code node drops every scenario whose `cliente` (the `(demo)` suffix makes it unique) already appears in the list. Only the surviving scenarios are created, and deposits are registered only for reservations created in this run, using the `id` the app returns. *Alternative:* skip everything if any demo name exists; rejected because one failed run would block the rest forever. Limit: a run that fails after creating a reservation but before its deposit leaves that reservation as created; the next run does not add the missing deposit (documented; `docker compose down -v` resets).

4. **Sequential, one request at a time.** Creation and deposits use HTTP Request nodes with the shared Header Auth credential, base URL `http://tienda:8000`, default behaviour on error (a `4xx` stops the flow) with flow 08 as Error Workflow. The app's `422` is therefore never hidden or retried. Deposits for one reservation are sent in order, because the app rejects a deposit above what is pending.

5. **Demo email = `$env.TIENDA_EMAIL_AVISOS`** (decision recorded for this change). Customers with an email get that address; the "without email" customer gets none. Consequence: flows 01 and 02 send their customer messages to the team inbox. No variable is added, so `docker-compose.yml` and `.env.example` stay untouched.

6. **Customer names and cases.** All names carry the suffix `(demo)`; no real or seeded customer name is used. Prices stay above the app's €5 minimum initial deposit so no run depends on a rule the app may change.

   | # | Customer | Case | Create | Then |
   |---|---|---|---|---|
   | 1 | Lucía Prado (demo) | active, email, size | price 89.90, initial 10 (bizum) | deposit 20 (efectivo) |
   | 2 | Marcos Vidal (demo) | no size, settled by final deposit | price 45.00, initial 10 (efectivo) | deposit 35 (tarjeta) |
   | 3 | Elena Soto (demo) | paid in full at creation | price 59.90, initial 59.90 (tarjeta) | none |
   | 4 | Pablo Ríos (demo) | no email | price 74.50, initial 15 (efectivo), phone only | none |
   | 5 | Irene Mora (demo) | past deadline, still `activo` | price 64.50, initial 10 (efectivo), `fecha` today minus 100 days | none |

7. **Output.** The last node returns a summary item: how many reservations were created, how many skipped, and the created ids, so the demo operator sees what happened without reading each node.

## Risks / Trade-offs

- **[Emails to the team inbox]** Publishing flows 01 and 02 makes every run send about a dozen emails to `TIENDA_EMAIL_AVISOS`. → Intended; the test notes say how many to expect.
- **[Lost events]** If the router is not published, the app events are not handled (nothing retries). → The data is still created; the notes say to publish the router first for a live demo.
- **[Past `fecha` is meant for migration]** The guide says `fecha` is for migrating old data. → Used only for the overdue case; the app accepts it and computes the deadline itself.
- **[Partial run]** See decision 3.
- **[Name clash]** A seeded customer called exactly like a demo customer would hide that scenario. → The `(demo)` suffix makes this practically impossible.
