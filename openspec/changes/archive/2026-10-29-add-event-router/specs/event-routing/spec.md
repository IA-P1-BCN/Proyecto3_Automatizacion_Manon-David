# Spec Delta

## Purpose

Receives every event the shop app announces and hands it to the one flow responsible for it, so event-driven automations share a single entry point without interfering with each other.

## ADDED Requirements

### Requirement: Single entry point for app events
The system SHALL receive all app events on one webhook endpoint that accepts POST requests with a JSON body of the form `{ "evento": <name>, "datos": <payload> }`.

#### Scenario: Event is received
- **WHEN** the app sends `{"evento": "apartado.creado", "datos": {...}}` to the production webhook URL
- **THEN** the router accepts it and starts handling it

### Requirement: Events are routed by name
The system SHALL send `apartado.creado` events only to the reservation-confirmation flow, `abono.registrado` events only to the deposit-receipt flow and `venta.registrada` events only to the large-sale-alert flow, passing the event's `datos` unchanged.

#### Scenario: Reservation created
- **WHEN** an `apartado.creado` event arrives
- **THEN** only the reservation-confirmation flow runs, and it receives the reservation exactly as the app sent it

#### Scenario: Deposit registered
- **WHEN** an `abono.registrado` event arrives
- **THEN** only the deposit-receipt flow runs, and it receives the updated reservation and the deposit `importe` exactly as the app sent them

#### Scenario: Sale registered
- **WHEN** a `venta.registrada` event arrives
- **THEN** only the large-sale-alert flow runs, and it receives the sale exactly as the app sent it

### Requirement: Unhandled events are accepted silently
The system SHALL accept events that have no handler yet (`apartado.vencido`) and any unknown event name, without raising an error or an alert.

#### Scenario: Expired reservation with no handler
- **WHEN** an `apartado.vencido` event arrives
- **THEN** the router finishes successfully, no message is sent and no error alert is raised

#### Scenario: Unknown event name
- **WHEN** an event with an unrecognised `evento` arrives
- **THEN** the router finishes successfully and the event is visible in n8n's execution history

### Requirement: Malformed events are reported
The system SHALL treat a request with no `evento` field, or with a body that is not JSON, as a failure so that the error workflow alerts the shop.

#### Scenario: Missing event name
- **WHEN** a request arrives whose body has no `evento`
- **THEN** the router execution fails and the error workflow sends an alert

### Requirement: Routing does not block the app
The system SHALL answer the app's request without waiting for the handler to finish sending messages.

#### Scenario: Slow email sending
- **WHEN** a handler takes several seconds to send its email
- **THEN** the app's webhook call has already been answered within its 5-second limit

### Requirement: Handler failures are isolated
The system SHALL ensure that a failure in one handler does not stop other events from being routed.

#### Scenario: One handler fails
- **WHEN** the deposit-receipt flow fails for one event and a new `apartado.creado` event arrives afterwards
- **THEN** the new event is routed and handled normally
