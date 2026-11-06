# Spec Delta

## Purpose

Tells Marisa about direct sales above a configurable amount as they happen, so she hears about them without being in the shop.

## ADDED Requirements

### Requirement: Alert on sales above the threshold
The system SHALL send Marisa an email for every `venta.registrada` event whose `datos.importe` is strictly greater than the configured threshold.

#### Scenario: Sale above the threshold
- **WHEN** the threshold is 100 and a `venta.registrada` event arrives with `importe` 149.90
- **THEN** Marisa receives one email about that sale

#### Scenario: Sale equal to the threshold
- **WHEN** the threshold is 100 and the event has `importe` 100
- **THEN** no email is sent

#### Scenario: Sale below the threshold
- **WHEN** the threshold is 100 and the event has `importe` 4.50
- **THEN** no email is sent and the execution ends successfully

### Requirement: Alert content
The alert SHALL be written in Spanish and SHALL state the sale's `concepto`, `importe` formatted as euros, `forma_pago` and `fecha`, using the values the app sent.

#### Scenario: Message shows the sale
- **WHEN** an alert is sent for `{"concepto": "Botas de piel", "importe": 189.5, "forma_pago": "tarjeta", "fecha": "2026-10-20"}`
- **THEN** the email shows the concept, "189,50 €", the payment method and the date, with no amount calculated by the flow

### Requirement: Threshold is configuration, not flow logic
The system SHALL read the threshold from the environment variable `TIENDA_UMBRAL_VENTA_GRANDE`, so that changing it requires no edit to any workflow node.

#### Scenario: Threshold changed
- **WHEN** the variable changes from 100 to 200 and n8n is restarted
- **THEN** a sale of 150 € that alerted before no longer alerts, and the exported flow JSON is unchanged

#### Scenario: Decimal threshold
- **WHEN** the variable is `99.99` (dot) and a sale of 100 arrives
- **THEN** the alert is sent

### Requirement: Invalid configuration fails loudly
The system SHALL treat a missing, empty or non-numeric threshold as a failure so that the error workflow alerts, and SHALL NOT silently skip every sale.

#### Scenario: Threshold not set
- **WHEN** the variable is empty and a `venta.registrada` event arrives
- **THEN** the execution fails and the error workflow sends an alert

### Requirement: Only sale events are handled
The system SHALL run this flow only for `venta.registrada` events routed by the event router.

#### Scenario: Other events
- **WHEN** an `apartado.creado` or `abono.registrado` event arrives
- **THEN** the large-sale flow does not run

### Requirement: Malformed sale data is reported
The system SHALL fail the execution when `datos.importe` is missing or not a number, so that the error workflow alerts.

#### Scenario: Missing amount
- **WHEN** a `venta.registrada` event arrives with no `importe`
- **THEN** the execution fails and the error workflow sends an alert, and no sale alert is sent
