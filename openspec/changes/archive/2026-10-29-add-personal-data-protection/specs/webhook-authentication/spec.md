# Spec Delta

## Purpose

Makes sure only the app (or a caller holding the shared secret) can start the automations, and that only well-formed events reach the handlers.

## ADDED Requirements

### Requirement: Reject unauthenticated webhook calls
The router SHALL accept an event only when it carries a secret equal to the environment variable `TIENDA_WEBHOOK_TOKEN`, sent in the `X-Webhook-Token` header or in the `token` query parameter. Any other request SHALL receive HTTP `401`, and no handler flow SHALL run.

#### Scenario: App call with the token in the URL
- **WHEN** the app posts a valid event to `…/webhook/tienda?token=<secret>`
- **THEN** the event is routed as before

#### Scenario: Caller with the header
- **WHEN** a request carries `X-Webhook-Token: <secret>` and no query parameter
- **THEN** the event is routed as before

#### Scenario: Missing or wrong token
- **WHEN** a request arrives with no token, or with a different one
- **THEN** the response is `401`, no handler is called and no customer data is written to the execution log

#### Scenario: Token not configured
- **WHEN** `TIENDA_WEBHOOK_TOKEN` is empty in n8n
- **THEN** every request is rejected with `401` (the router never runs open) and flow 08 alerts the shop to the misconfiguration (a wrong token from a caller does not alert, to avoid a flood of emails from probes)

### Requirement: Secret never stored in the repository
The token SHALL be defined only in `.env` and in the n8n environment; the exported JSON, docs and tests SHALL contain no real value.

#### Scenario: Export contains no secret
- **WHEN** the exported flows and docs are scanned for the configured token value
- **THEN** nothing matches, and `.env.example` holds an obviously fake placeholder

### Requirement: Validate the event body
After authentication the router SHALL check that `evento` is a non-empty string and `datos` is an object, and for each routed event that the fields its handler needs are present and of the right type (`importe` numeric, `email`, when present, a valid address). An invalid body SHALL stop at the router and raise the error alert, without including the payload's personal data in the alert.

#### Scenario: Valid event
- **WHEN** an `abono.registrado` event has `datos.id`, a numeric `datos.importe` and a valid `datos.email`
- **THEN** it continues to the consent step

#### Scenario: Missing or wrong-typed field
- **WHEN** the event has `importe` equal to `"veinte"` or `datos` is a string
- **THEN** no handler runs and the alert names the flow, the step and the problem but not the customer's name or email

#### Scenario: Unknown event still ignored
- **WHEN** a valid, authenticated event has an `evento` the router does not know
- **THEN** it ends silently, as today
