# Spec Delta

## Purpose

Makes sure automatic messages reach only customers whose consent is recorded, and that withdrawing it is respected.

## ADDED Requirements

### Requirement: Consent register
The system SHALL keep a register in the n8n Data Table `consentimientos` with one row per normalised (trimmed, lowercase) email and the fields `email`, `estado` (`activo` or `retirado`), `fecha` and `origen`. It SHALL store no name, phone, balance or product.

#### Scenario: Row content
- **WHEN** consent is recorded for "Carmen@Example.com "
- **THEN** the row has email `carmen@example.com`, estado `activo`, the date and the origin, and nothing else

### Requirement: Consent recorded at reservation
The router SHALL record consent with origin `tienda` when an `apartado.creado` event carries a valid `email`, and SHALL NOT overwrite a row whose `estado` is `retirado`.

#### Scenario: New customer with email
- **WHEN** `apartado.creado` arrives with `email` "ana@example.com" and no row exists
- **THEN** a row with estado `activo` is created and flow 01 runs

#### Scenario: Customer who withdrew
- **WHEN** a row for the email has estado `retirado` and a new `apartado.creado` arrives
- **THEN** the row stays `retirado` and no confirmation is sent

#### Scenario: No email
- **WHEN** `apartado.creado` has no `email`
- **THEN** no row is written and no message is sent (as today)

### Requirement: Check consent before every customer message
Before any email to a customer, the flow SHALL call `09 Consent Check` with the recipient's email and SHALL send only when the answer is `permitido`. This covers flows 01 and 02 (gated by the router) and flows 06 and 06b. An unknown email, a `retirado` row, an invalid email or an unreadable register SHALL all mean "do not send".

#### Scenario: Customer with active consent
- **WHEN** an `abono.registrado` event arrives for an email with estado `activo`
- **THEN** flow 02 sends the receipt

#### Scenario: Customer without a row
- **WHEN** an `abono.registrado` event arrives for an email that is not in the register
- **THEN** no customer email is sent and the execution ends successfully

#### Scenario: Withdrawn consent on a reminder
- **WHEN** flow 06 finds a reservation due in 7 days whose email is `retirado`
- **THEN** no reminder is sent and the reservation is not recorded as notified

#### Scenario: Register unreadable
- **WHEN** the Data Table cannot be read
- **THEN** no customer email is sent and flow 08 alerts the shop (fail closed)

#### Scenario: Messages to the shop are not gated
- **WHEN** an alert, daily close or report is sent to `TIENDA_EMAIL_AVISOS`
- **THEN** the consent check is not involved

### Requirement: Backfill existing customers
A manual flow `09b Consent Backfill` SHALL read the app's reservations through the API and record every distinct valid email that has no row, with origin `tienda (migración)`. It SHALL be idempotent, never change an existing row and never send any message.

#### Scenario: First run
- **WHEN** the app holds 20 reservations with 14 distinct emails and the register is empty
- **THEN** 14 rows are created

#### Scenario: Second run
- **WHEN** it is run again with no new customers
- **THEN** no row is created or changed

### Requirement: Withdrawing consent
Marisa SHALL be able to withdraw a customer's consent by editing `estado` to `retirado` in the Data Table, and the next send SHALL honour it without any flow edit.

#### Scenario: Withdrawn between two sends
- **WHEN** a row is changed to `retirado` after an earlier receipt
- **THEN** the next `abono.registrado` for that email sends nothing
