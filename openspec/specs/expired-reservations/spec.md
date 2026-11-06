# expired-reservations Specification

## Purpose
Closes, every morning, the active reservations whose deadline has passed: the app expires them and creates the voucher, the customer is told the voucher code and amount, and Marisa receives the list of shoes that go back on sale.

## Requirements

### Requirement: Daily expiry run
The system SHALL check the active reservations once every morning at 09:05 (Europe/Madrid) and SHALL be runnable by hand for a chosen date.

#### Scenario: Scheduled run
- **WHEN** it is 09:05 in Madrid
- **THEN** the system looks at every reservation with state `activo` and expires those past their deadline

#### Scenario: Manual run for a chosen date
- **WHEN** the team runs the flow by hand and sets the date 2026-10-20
- **THEN** reservations with `fecha_limite` before 2026-10-20 are treated as past their deadline, as if the run happened that day

### Requirement: Expire only what is past its deadline
The system SHALL expire, through the app, every `activo` reservation whose `fecha_limite` is strictly before the run date, and SHALL NOT touch any other reservation. The app creates the voucher; the system SHALL NOT calculate it.

#### Scenario: Deadline passed
- **WHEN** today is 2026-10-20 and an `activo` reservation has `fecha_limite` 2026-10-19
- **THEN** the system expires it through the app and the app returns the reservation as `vencido` with its voucher

#### Scenario: Deadline today
- **WHEN** today is 2026-10-20 and an `activo` reservation has `fecha_limite` 2026-10-20
- **THEN** it is not expired, because the customer still has today

#### Scenario: Not active
- **WHEN** a `liquidado` or `vencido` reservation has a `fecha_limite` in the past
- **THEN** the system does nothing with it

#### Scenario: Nothing to expire
- **WHEN** no active reservation is past its deadline
- **THEN** the run finishes successfully and sends no customer email and no summary

### Requirement: Safe to run again
The system SHALL expire a reservation only once and SHALL NOT send its customer a second voucher email when the flow runs again.

#### Scenario: Run twice the same day
- **WHEN** the flow runs twice the day a reservation passes its deadline
- **THEN** the customer receives one voucher email and the shop one summary that lists it

#### Scenario: App refuses to expire
- **WHEN** the app rejects the expiry of one reservation (for example it is no longer `activo`)
- **THEN** that reservation gets no email and is reported as a failure, and the other reservations are still processed

### Requirement: Voucher message to the customer
The system SHALL email the customer, in Spanish, the voucher `codigo` and `importe`, the product, and a note that the amount paid became store credit and is not refunded in cash. The code and amount SHALL be shown exactly as the app returned them, formatted for Spanish readers (comma decimals, euro sign).

#### Scenario: Voucher email
- **WHEN** reservation 16 expires and the app returns the voucher `VALE-00016` with `importe` 5.0
- **THEN** its customer receives an email that shows `VALE-00016` and `5,00 €`

#### Scenario: Missing or malformed email
- **WHEN** an expired reservation has an empty `email` or one without `@`
- **THEN** no customer email is sent and the reservation appears, with its voucher code, in the shop summary as a customer to tell by hand

#### Scenario: Customer email bounces
- **WHEN** the customer email is rejected by the mail server
- **THEN** the reservation still appears in the shop summary with its voucher code and the run ends as failed so flow 08 alerts

### Requirement: Shop summary of shoes back on sale
The system SHALL send Marisa, at `TIENDA_EMAIL_AVISOS`, one Spanish email per run that lists every reservation expired in that run with product, size (when there is one), customer, voucher code and amount, headed as shoes that return to sale.

#### Scenario: Several expired the same day
- **WHEN** three reservations expire in one run
- **THEN** Marisa receives one email listing the three products

#### Scenario: Nothing expired
- **WHEN** no reservation expires
- **THEN** Marisa receives no summary

### Requirement: Failures are visible
The system SHALL end the execution as failed when the app, a customer email or the summary email fails for any reservation, after processing the rest, so the Error Workflow alerts. The alert SHALL NOT contain secrets.

#### Scenario: App unreachable
- **WHEN** the app cannot be reached when listing the reservations
- **THEN** the execution fails and flow 08 alerts

#### Scenario: One failure among several
- **WHEN** three reservations are due and the second cannot be expired
- **THEN** the first and third are expired and notified, and the execution ends as failed
