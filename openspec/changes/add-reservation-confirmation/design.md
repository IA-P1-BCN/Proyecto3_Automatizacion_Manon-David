# Design

## Context

The event router passes `datos` of `apartado.creado` unchanged: `id, fecha, cliente, telefono, email, producto, talla, precio, abonado, pendiente, fecha_limite, estado`. The app calculates `abonado` and `pendiente` (principle: n8n never recalculates). Customer email is optional in the app. See proposal.md and `specs/reservation-confirmation/spec.md`.

## Goals / Non-Goals

**Goals:** a simple linear sub-workflow; correct Spanish formatting; no failure for a missing email.

**Non-Goals:** reading the reservation again from the API (the event already carries it); sending to channels other than email; tracking consent; resending lost events.

## Decisions

1. **Use the event payload, not an extra API call.** The event already contains every figure. *Alternative:* `GET /api/apartados/{id}`; rejected as an extra dependency and failure point with no gain.

2. **IF node on a validity check (non-empty, contains `@`)** splits the customer path from the shop path. The shop path ends successfully, so a missing email is not an error.

3. **Formatting in one Code node** (comma decimals, `€`, `dd/mm/yyyy`, optional size line, paid-in-full variant) so the Gmail node only inserts ready-made text. Formatting only, no arithmetic on the amounts.

4. **Plain text email.** Simplest to review and to test; an HTML template can come later.

5. **Subject names the shoes and amount pending**, for example "Tu apartado en Paso Firme: Botín piel marrón".

## Risks / Trade-offs

- **[Lost event]** If n8n is down when the reservation is created, no email is sent and nothing retries. → Accepted for Essential; documented in the router's README section.
- **[Syntactically valid but wrong email]** The flow can't know. → The email bounces to the sending inbox; the team sees it when checking the account.
- **[Phone-only customers]** They get no message. → The shop alert tells staff to contact them.
