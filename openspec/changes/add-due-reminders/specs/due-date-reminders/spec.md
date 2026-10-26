# Spec Delta

## Purpose

Warns a customer, every morning, when the deadline of their active reservation is 7 days or 1 day away, with what is still pending and the deadline date, so they do not lose their shoes or what they have already paid. Each customer gets each reminder once.

## ADDED Requirements

### Requirement: Daily reminder run
The system SHALL check the active reservations once every morning at 09:00 (Europe/Madrid) and SHALL be runnable by hand for a chosen date.

#### Scenario: Scheduled run
- **WHEN** it is 09:00 in Madrid
- **THEN** the system looks at every reservation with state `activo` and sends the reminders that are due that day

#### Scenario: Manual run for a chosen date
- **WHEN** the team runs the flow by hand and sets the date 2026-10-20
- **THEN** the reminders due on 2026-10-20 are sent, as if the run happened that day

### Requirement: Reminder at 7 days and at 1 day
The system SHALL send a reminder for an `activo` reservation whose `fecha_limite` is exactly 7 days after the run date, and another when it is exactly 1 day after the run date. Reservations in any other state, or with any other number of days left, SHALL get nothing.

#### Scenario: Deadline in 7 days
- **WHEN** today is 2026-10-20 and an `activo` reservation has `fecha_limite` 2026-10-27
- **THEN** its customer receives the 7-day reminder

#### Scenario: Deadline tomorrow
- **WHEN** today is 2026-10-20 and an `activo` reservation has `fecha_limite` 2026-10-21
- **THEN** its customer receives the 1-day reminder, worded as "mañana"

#### Scenario: Any other distance
- **WHEN** today is 2026-10-20 and reservations have `fecha_limite` 2026-10-26, 2026-10-28, 2026-10-20 or 2026-10-19
- **THEN** none of them receives a reminder

#### Scenario: Not active
- **WHEN** a `liquidado` or `vencido` reservation has `fecha_limite` 7 days away
- **THEN** it receives nothing

#### Scenario: Nothing due
- **WHEN** no reservation is due that day
- **THEN** the run finishes successfully and sends no email

### Requirement: Each reminder is sent once
The system SHALL send each reminder (one per reservation and threshold, 7 days or 1 day) at most once, even if the flow runs again the same day, and SHALL keep that record outside n8n's execution history so it survives restarts.

#### Scenario: Run twice the same day
- **WHEN** the flow runs twice on the day a reservation is 7 days from its deadline
- **THEN** the customer receives one 7-day email in total

#### Scenario: Both thresholds
- **WHEN** a reservation was reminded at 7 days and, six days later, is 1 day from its deadline
- **THEN** the customer receives the 1-day reminder as well

#### Scenario: Record survives a restart
- **WHEN** n8n is restarted after a reminder was sent and the flow runs again the same day
- **THEN** that reminder is not sent again

### Requirement: Reminder content
The system SHALL write the reminder in Spanish with the model, the size (when there is one), the amount still pending, the amount already paid and the deadline date, shown exactly as the app sent them and formatted for Spanish readers (comma decimals, euro sign, day/month/year). It SHALL NOT calculate or alter any amount or date.

#### Scenario: Figures as the app gives them
- **WHEN** the reservation says price 89.90, paid 30.00, pending 59.90 and deadline 2026-10-27
- **THEN** the email shows 59,90 € pending, 30,00 € paid and 27/10/2026, taken from the app's fields and not from price minus paid

#### Scenario: No size
- **WHEN** the reservation has no `talla`
- **THEN** the email is still sent and contains no size line or empty label

### Requirement: Customer without a usable email
The system SHALL, when the reservation has no email or an email that is empty or has no `@`, send nothing to the customer and instead email the shop with the reservation number, customer name, phone if present, model, deadline and which reminder could not be sent. The run SHALL carry on with the other reservations and finish successfully, and the shop SHALL be told only once per reservation and threshold.

#### Scenario: No email
- **WHEN** a reservation due in 7 days has an empty `email`
- **THEN** the shop receives an email naming the reservation number, customer, phone, model and the reason, and the other reminders of the day are still sent

#### Scenario: Re-run
- **WHEN** the flow runs again the same day
- **THEN** the shop is not alerted a second time for that reservation and threshold

### Requirement: Failures are reported and do not mark a reminder as sent
The system SHALL let any unexpected failure (the app unreachable or returning an error, the record unreadable or unwritable, the email service rejecting a message) reach the error workflow, and SHALL NOT record a reminder as sent unless its email was accepted.

#### Scenario: App unreachable
- **WHEN** the reservations cannot be read
- **THEN** the execution fails, the error workflow sends its alert and no reminder is recorded

#### Scenario: Email rejected
- **WHEN** the email service rejects the reminder for one customer
- **THEN** the execution fails, the error workflow sends its alert and that reminder is not recorded as sent, so a later run can try again

#### Scenario: Unreadable record
- **WHEN** the sent-record exists but cannot be read or has the wrong columns
- **THEN** the execution fails before any email is sent, so nobody can be reminded twice by mistake
