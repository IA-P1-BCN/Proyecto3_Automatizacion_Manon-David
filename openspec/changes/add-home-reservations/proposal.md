# Proposal

## Why

HU-13 (Advanced level) asks that some data enter by itself so the shop assistant can serve customers. We take its first option, *apartados desde casa*: a customer wants to reserve shoes without going to the shop. Today that is a phone call or a visit, and the app cannot hold a reservation without an initial deposit (`POST /api/apartados` requires `abono_inicial` ≥ 5 €). So the request has to wait somewhere until the money arrives, and nothing in n8n does that yet. The README says the apartado is confirmed when the initial deposit arrives, so the arrival of the payment, not a person, must create it.

## What Changes

- Add flow `11 Home Reservations`: a public n8n Form Trigger where the customer gives name, phone, email, a shoe model (a dropdown whose labels carry the price), a size and a consent checkbox. The flow stores a pending request, emails Marisa, and emails the customer how to pay the initial deposit, with a reference (`SOL-0001`…) to write as the payment concept.
- Store pending requests in the n8n Data Table `solicitudes_apartado` (`ref`, `nombre`, `telefono`, `email`, `producto`, `talla`, `precio`, `estado` `pendiente` / `procesando` / `confirmada` / `cancelada`, `apartado_id`, `fecha`, `payment_key`). Marisa can read and cancel rows by hand.
- Take the price from a **fixed price list inside the flow** (one list builds both the dropdown and the lookup). The customer never types a price.
- Add flow `11b Match Pending Request`, a sub-workflow that decides whether a bank payment belongs to a pending request and, if so, creates the apartado through `POST /api/apartados` with the paid amount as the initial deposit. It claims the row first (`pendiente → procesando`, storing the payment key) and releases or confirms it from the app's answer. Doubtful cases go to Marisa; nothing is guessed.
- **Modify flow 03 (Remote Deposits)** with a three-node hook: an Execute Workflow node that calls 11b on every validated payment, a Switch on its answer (`not_mine` continues exactly as today, `created` ends, anything else goes to flow 03's existing review email) and a NoOp for the created case. This needs the flow 03 owner's agreement.
- The apartado creation emits `apartado.creado`, so flow 01 sends the confirmation and the router records consent as it does today. These flows send no second confirmation.
- Record the form's consent through `09 Consent Check` (`registrar`), never overriding a `retirado` row; customer emails go only when consent is `activo`. Flow 09 does not take an origin, so the row's origin is `tienda`.
- Wire every path to the Error Workflow (flow 08); a request is never turned into two apartados.
- Add the environment variable `TIENDA_PAGO_INSTRUCCIONES` (payment instructions shown to the customer), passed through `docker-compose.yml` and documented in `.env.example`.
- Document the price list, the form URL, the Data Table and the hook in the README changes and the AI log.

## Capabilities

### New Capabilities
- `home-reservation-requests`: a customer requests a reservation from home, the shop is told, and the apartado is created in the app when the matching initial deposit arrives.

### Modified Capabilities
- `remote-deposit-registration`: payments are checked against pending home requests before reservations; payments that are not about a request behave exactly as before.

## Impact

- **New files:** `workflows/11-home-reservations.json` and `workflows/11b-match-request.json` (no credentials), their generators, pure-logic code and unit tests under `workflows/code/`, and `workflows/tests/11-home-reservations.md`, following flows 06b and 10.
- **Changed files:** `workflows/03-remote-deposits.json` (three nodes and two connections, after the owner agrees and the export is sanitized), `docker-compose.yml` and `.env.example` (one variable).
- **New config:** the Data Table `solicitudes_apartado`; `TIENDA_PAGO_INSTRUCCIONES`; reuses `TIENDA_EMAIL_FROM`, `TIENDA_EMAIL_AVISOS`, the shop Header Auth, the SMTP credential and flow 09. No new credential.
- **No router change and no app change.**
- **Rules kept:** the app is the source of truth for the deposit rules (minimum 5 €, at most the price) and for the resulting amounts; the flows never recalculate `abonado` or `pendiente`. No new AI use: 11b runs after flow 03's extraction and sends nothing to the model. Nothing is activated in production.
- **Out of scope:** Option B (card-terminal CSV); a Telegram request channel; expiring or reminding stale pending requests; a product catalogue or stock; online payment; letting flow 09 record a form origin.
- **Prerequisite:** the owner of flow 03 (David) agrees to the hook, because the project rules say not to touch a partner's files.
- **Owner:** Manon.
- **Issue · branch:** #13 · `feat/13-home-reservations` (from `dev`, PR targets `dev`).
