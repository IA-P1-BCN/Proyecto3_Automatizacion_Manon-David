# Spec Delta

## Purpose

Tells a customer, right after they reserve shoes, exactly what they reserved, what they have paid, what remains and the deadline, and tells the shop when the customer cannot be reached.

## ADDED Requirements

### Requirement: Confirmation email for every new reservation
The system SHALL email the reservation's customer within one minute of an `apartado.creado` event. The email SHALL be in Spanish and SHALL contain the model, size, price, amount already paid, amount still pending and the deadline date.

#### Scenario: Reservation with email
- **WHEN** an `apartado.creado` event arrives for "Carmen Ruiz", Botín piel marrón, size 38, price 89.90, paid 10.00, pending 79.90, deadline 2027-01-18, with an email
- **THEN** that email address receives a Spanish message showing the model, size 38, 89,90 €, 10,00 €, 79,90 € and 18/01/2027 within one minute

### Requirement: Figures come from the app
The system SHALL show the price, paid amount, pending amount and deadline exactly as the app sent them, formatted for Spanish readers (comma decimals, euro sign, day/month/year), and SHALL NOT calculate or change them.

#### Scenario: Pending amount is not recomputed
- **WHEN** the event says price 64.50, paid 5.00, pending 59.50
- **THEN** the email shows 59,50 € as pending, taken from the event and not from price minus paid

### Requirement: Missing size is handled
The system SHALL leave out the size line when the reservation has no size, without leaving a blank or placeholder.

#### Scenario: No size
- **WHEN** the event has no `talla`
- **THEN** the email is still sent and contains no size line or empty label

### Requirement: Fully paid reservation says so
The system SHALL, when the event's state is `liquidado`, say that the customer can pick up their shoes instead of stating an amount pending.

#### Scenario: Paid in full at creation
- **WHEN** the event has state `liquidado` and pending 0
- **THEN** the email says the shoes are ready to collect and shows no pending amount to pay

### Requirement: Missing email does not fail the flow
The system SHALL, when the reservation has no email or an email that is empty or has no `@`, send no customer email and instead email the shop with the reservation number, customer name, phone if present, model and the reason the confirmation was not sent. The execution SHALL finish successfully.

#### Scenario: No email on the reservation
- **WHEN** the event has an empty `email`
- **THEN** the shop receives an alert naming reservation number, customer, phone and model, and the flow execution is not marked as failed

#### Scenario: Malformed email
- **WHEN** the event has the email `carmen.example.com`
- **THEN** the shop receives the same alert and no email is sent to the customer

### Requirement: One confirmation per event
The system SHALL send at most one confirmation for each `apartado.creado` event it receives.

#### Scenario: Single event
- **WHEN** one `apartado.creado` event arrives
- **THEN** exactly one email (customer or shop) is sent for it

### Requirement: Failures are reported
The system SHALL let any unexpected failure (for example the email service rejecting the message) reach the error workflow.

#### Scenario: Email service fails
- **WHEN** sending the customer email fails
- **THEN** the execution fails and the error workflow sends its alert
