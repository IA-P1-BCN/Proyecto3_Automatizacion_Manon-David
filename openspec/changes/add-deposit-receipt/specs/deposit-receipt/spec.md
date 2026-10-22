# Spec Delta

## Purpose

Gives a customer a receipt each time they pay a deposit, with what remains to pay, and tells them when the reservation is fully paid and the shoes can be collected.

## ADDED Requirements

### Requirement: Receipt for every registered deposit
The system SHALL email the reservation's customer within one minute of an `abono.registrado` event. The email SHALL be in Spanish and SHALL contain the model, the amount just paid (`importe`), the amount still pending and the deadline date.

#### Scenario: Partial deposit
- **WHEN** an `abono.registrado` event arrives with `importe` 20.00, state `activo`, pending 59.90, deadline 2027-01-18 and an email
- **THEN** the customer receives a receipt showing 20,00 € paid, 59,90 € pending and 18/01/2027 within one minute

### Requirement: Figures come from the app
The system SHALL show the paid amount, pending amount and deadline exactly as the event carries them, formatted for Spanish readers, and SHALL NOT calculate or change them.

#### Scenario: Pending not recomputed
- **WHEN** the event carries `importe` 20.00 and pending 59.90
- **THEN** the receipt shows 59,90 € as pending even if other fields would suggest a different value

### Requirement: Settled reservation tells the customer to collect
The system SHALL, when the event's state is `liquidado`, send a message that confirms the final payment and says the customer can collect their shoes, instead of showing an amount pending.

#### Scenario: Final deposit
- **WHEN** an `abono.registrado` event arrives with state `liquidado`, pending 0 and `importe` 12.00
- **THEN** the customer receives a message confirming the 12,00 € and saying the shoes are ready to collect, with no pending amount to pay

### Requirement: Source of the deposit does not matter
The system SHALL send the same receipt whether the deposit was registered from the shop's screen or through the API (for example by the remote-deposit flow).

#### Scenario: Deposit registered through the API
- **WHEN** a deposit is registered by the remote-deposit flow and the app announces it
- **THEN** the customer receives the receipt without the remote-deposit flow sending any message to the customer

### Requirement: Missing email does not fail the flow
The system SHALL, when the reservation has no email or an email that is empty or has no `@`, send no customer message and email the shop with the reservation number, customer name, phone if present, the amount paid and the reason. The execution SHALL finish successfully.

#### Scenario: No email on the reservation
- **WHEN** the event has an empty `email`
- **THEN** the shop receives a message with reservation number, customer, phone, amount paid and the reason, and the execution is not marked as failed

### Requirement: One receipt per event
The system SHALL send at most one message (customer or shop) for each `abono.registrado` event.

#### Scenario: Two deposits in a row
- **WHEN** two deposits of the same reservation are registered one after the other
- **THEN** the customer receives two receipts, each showing its own amount

### Requirement: Failures are reported
The system SHALL let any unexpected failure reach the error workflow.

#### Scenario: Email service fails
- **WHEN** sending the receipt fails
- **THEN** the execution fails and the error workflow sends its alert
