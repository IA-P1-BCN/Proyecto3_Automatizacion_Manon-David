# Spec Delta

## ADDED Requirements

### Requirement: Pending home requests are checked before reservations
The system SHALL, for every validated payment, ask the pending-request matcher whether the payment belongs to a pending home reservation request before it looks at existing reservations. The matcher SHALL answer that the payment is not about a request, that an apartado was created, that the case needs review, or that the outcome is uncertain.

#### Scenario: Payment for a pending request
- **WHEN** a validated payment carries the reference of a pending request and the payer fits it
- **THEN** the request is handled by the matcher and the existing reservation matching is not run for that payment

#### Scenario: Payment not about a request
- **WHEN** a validated payment fits no pending request
- **THEN** the payment goes back as it came in, with only the answer "not about a request" added, and the existing matching, eligibility, registration and review behaviour is unchanged for it

#### Scenario: Existing sample notices
- **WHEN** the nine sample bank notices are processed while no pending request exists
- **THEN** each one has exactly the outcome it had before

### Requirement: Answers other than created use the existing review path
The system SHALL send the reason of a review or uncertain answer to Marisa through the existing review email, SHALL treat any unexpected answer as a review, and SHALL still fail the execution for the error workflow when the outcome is uncertain.

#### Scenario: Doubtful request payment
- **WHEN** the matcher answers that the case needs review
- **THEN** Marisa receives the usual review notice with the reason, and nothing is registered

#### Scenario: Uncertain creation
- **WHEN** the matcher answers that the outcome is uncertain
- **THEN** Marisa receives the usual review notice with the warning not to register manually, and the execution fails for the error workflow

#### Scenario: Unexpected answer
- **WHEN** the matcher returns anything other than the known answers
- **THEN** the payment is treated as a review and Marisa is told

### Requirement: A created apartado ends the payment's processing
The system SHALL stop processing a payment once the matcher has created the apartado from a request, SHALL NOT register a second deposit for it, and SHALL send nothing to the customer, because the confirmation comes from the reservation-confirmation flow.

#### Scenario: Apartado created from a request
- **WHEN** the matcher answers that an apartado was created
- **THEN** flow 03 registers no further deposit and sends no customer message

### Requirement: The hook respects the registration gate
The system SHALL pass the existing payment-registration setting to the matcher, so that no apartado is created while registration is disabled.

#### Scenario: Registration disabled
- **WHEN** payment registration is disabled and a payment matches a pending request
- **THEN** Marisa receives a preview and nothing is created
