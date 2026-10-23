# Spec Delta

## Purpose

Turns bank notices of Bizum and transfer payments into deposits on the correct reservation automatically, and asks the shop owner instead of guessing whenever the payment is unclear or the app refuses it.

## ADDED Requirements

### Requirement: Only payment emails are processed
The system SHALL read new emails from the shop's bank notices and SHALL ignore any email that is not a payment, without registering anything or notifying anyone.

#### Scenario: Bank advertising
- **WHEN** an email arrives offering up to 150 € for moving the card-terminal collections
- **THEN** nothing is registered, nobody is notified, and the email is marked as processed

### Requirement: Extraction is limited to the email text
The system SHALL send an AI model only the subject and body of the email, and SHALL ask it only to return payer, amount, concept and payment type (`bizum`, `transferencia` or `no_es_pago`). The AI SHALL NOT decide which reservation a payment belongs to or whether it is registered.

#### Scenario: Data sent to the model
- **WHEN** a payment email is analysed
- **THEN** the model receives only that email's subject and body, and no reservation, customer list, phone or email address

### Requirement: Extracted data is validated
The system SHALL accept an extraction only when the payer is non-empty, the amount is a number greater than zero, the type is one of the three allowed values and the amount appears in the email text. Otherwise the payment SHALL be treated as doubtful and nothing SHALL be registered.

#### Scenario: Model returns an invented amount
- **WHEN** the model returns an amount that does not appear in the email text
- **THEN** nothing is registered and Marisa is asked to review the email

#### Scenario: Model returns unusable output
- **WHEN** the model's answer is not valid structured data
- **THEN** nothing is registered and Marisa is asked to review the email

### Requirement: Reservation found by number in the concept
The system SHALL, when the concept contains a reservation number written like "apartado 2", use that reservation.

#### Scenario: Number in the concept
- **WHEN** a Bizum of 20,00 EUR from "JORGE M." has the concept "apartado 2 bota" and reservation 2 is active
- **THEN** a deposit of 20.00 by `bizum` is registered on reservation 2

### Requirement: Reservation found by contained payer name
The system SHALL, when the concept has no reservation number, compare names ignoring case, accents and extra spaces and select the single active reservation whose stored name words are all contained in the payer's name.

#### Scenario: Payer name longer than stored name
- **WHEN** a Bizum of 10,00 EUR from "CARMEN RUIZ GARCIA" arrives and exactly one active reservation is stored as "Carmen Ruiz"
- **THEN** a deposit of 10.00 by `bizum` is registered on that reservation

#### Scenario: Accents and case
- **WHEN** a payment from "LUCIA GOMEZ PEREZ" arrives and the only matching active reservation is stored as "Lucía Gómez"
- **THEN** that reservation is selected

### Requirement: Abbreviated payer needs product confirmation
The system SHALL accept an abbreviated payer name (first name or surname plus an initial) only when the first name matches, the other word starts with the initial, and the concept names the product of exactly one such active reservation.

#### Scenario: Abbreviated payer with product in the concept
- **WHEN** a payment from "LAURA O." with concept "deportivas" arrives and exactly one active reservation matches Laura, a surname starting with O, and a sports-shoes product
- **THEN** that reservation is selected

#### Scenario: Abbreviated payer without a concept
- **WHEN** a payment from "ROMERO D" with an empty concept arrives
- **THEN** no reservation is selected, nothing is registered and Marisa is asked to decide

### Requirement: Doubt means asking, never guessing
The system SHALL, when no reservation or more than one reservation qualifies, register nothing and email Marisa the payer, amount, concept, payment type and, when there are several, the candidate reservations.

#### Scenario: Unknown payer
- **WHEN** a transfer of 25,00 EUR from "ANTONIO FERNANDEZ SOTO" with concept "botas" arrives and no active reservation matches
- **THEN** nothing is registered and Marisa receives the payer, amount and concept with the reason "no matching reservation"

#### Scenario: Several candidates
- **WHEN** two active reservations qualify for the same payment
- **THEN** nothing is registered and Marisa receives both candidate reservation numbers

### Requirement: Transfers are recorded as Bizum
The system SHALL register both Bizum and transfer payments with payment method `bizum`, and SHALL state the real type in any message to Marisa.

#### Scenario: Transfer registered
- **WHEN** a transfer of 12,00 EUR is matched to a reservation with 12.00 pending
- **THEN** a deposit of 12.00 with method `bizum` is registered and the reservation becomes settled

### Requirement: The app's rules decide acceptance
The system SHALL register the deposit through the app's API and SHALL NOT pre-calculate whether it is allowed. When the app refuses it, the system SHALL register nothing else and email Marisa the app's message, the payer, the amount and the reservation number.

#### Scenario: Payment above the pending amount
- **WHEN** a payment of 15,00 EUR is matched to a reservation with less than 15.00 pending
- **THEN** the app refuses it, nothing is registered, and Marisa receives the app's message with the payer, amount and reservation number

#### Scenario: Reservation past its deadline
- **WHEN** a payment is matched to an active reservation whose deadline has passed
- **THEN** the app refuses it, nothing is registered, and Marisa receives the app's message with the reason

### Requirement: The customer is not messaged by this flow
The system SHALL NOT send any message to the customer. The receipt SHALL come from the deposit-receipt flow when the app announces the registered deposit.

#### Scenario: Successful registration
- **WHEN** a deposit is registered by this flow
- **THEN** this flow sends nothing to the customer, and the customer receives their receipt from the deposit-receipt flow

### Requirement: Each email is processed once
The system SHALL mark each bank email as processed before registering anything, so that no email is handled twice.

#### Scenario: Flow restarts
- **WHEN** the flow runs again after a failure partway through an email
- **THEN** that email is not reprocessed and no duplicate deposit is created

### Requirement: Failures are reported
The system SHALL let unexpected failures (API unreachable, model unreachable, email service errors) reach the error workflow so that a payment never disappears silently.

#### Scenario: App unreachable
- **WHEN** the app cannot be reached while registering a deposit
- **THEN** the execution fails and the error workflow alerts the shop
