# Spec Delta

## Purpose

Makes automation failures visible: whenever a connected n8n flow fails, the shop is told by email which flow, which step and what error, so nothing stops working unnoticed and no secret is leaked.

## ADDED Requirements

### Requirement: Alert on every failed execution
The system SHALL send one email alert to the shop's alert address for each failed execution of any flow that has the error workflow configured. The alert SHALL contain the flow name, the step where it failed, the error and a link to the failed execution.

#### Scenario: A connected flow fails
- **WHEN** an automatic execution of a connected flow fails
- **THEN** the shop receives an email whose content names the flow, the failing step, the error message and the execution link

#### Scenario: Several consecutive failures
- **WHEN** the same flow fails three times in a row
- **THEN** the shop receives three alerts, one per failed execution

#### Scenario: Alert arrives promptly
- **WHEN** a connected flow fails
- **THEN** the alert is delivered within one minute of the failure

### Requirement: Alerts never contain secrets
The system SHALL mask secrets in the error text before sending, replacing them with `[oculto]`. Masked content SHALL include authorization headers and bearer tokens, API-key headers, the value of any known API key, and any `key=value` or `"key":"value"` pair whose key contains `key`, `token`, `secret`, `password` or `pass`.

#### Scenario: Bearer token in the error
- **WHEN** the error text contains `Authorization: Bearer abc123SECRET`
- **THEN** the alert shows `Authorization: [oculto]` and the string `abc123SECRET` does not appear anywhere in it

#### Scenario: Secret inside a JSON fragment
- **WHEN** the error text contains `{"api_key":"sk-test-123","detalle":"422"}`
- **THEN** the alert masks the `api_key` value and still shows `detalle` and `422`

### Requirement: Alerts exclude personal data and request bodies
The system SHALL NOT include in an alert the full request body, the failing node's input data, or any customer personal data (name, phone, email). The execution link SHALL be the way to inspect the details.

#### Scenario: Failure while handling a customer's data
- **WHEN** a flow fails while processing a reservation that has a customer name, phone and email
- **THEN** none of those three values appears in the alert

### Requirement: Alert text is bounded and always readable
The system SHALL cut the error message to at most 500 characters. The system SHALL produce a readable alert even when the error message or the failing step is missing.

#### Scenario: Very long error message
- **WHEN** the error message is 2000 characters long
- **THEN** the alert shows at most 500 characters of it

#### Scenario: Error without a message
- **WHEN** the failed execution carries no error message
- **THEN** the alert shows `«error sin mensaje»` together with the step and the execution link

#### Scenario: The trigger itself failed
- **WHEN** the failed execution has no last executed step
- **THEN** the alert shows the step as `«desconocido (falló el disparador)»`

### Requirement: Alerts are written for the shop owner
The system SHALL write the alert in Spanish, addressed to Marisa, with the subject `⚠️ Falló la automatización «<flow name>»` and fields for flow, step, error, time (Europe/Madrid) and execution link.

#### Scenario: Alert wording and time zone
- **WHEN** an alert is generated at 23:55 Madrid time
- **THEN** the subject and field labels are in Spanish and the time shown is Madrid time

### Requirement: The error workflow only alerts
The system SHALL NOT retry, register, correct or otherwise act on the app or on the failed flow when an alert is raised.

#### Scenario: Failed deposit registration
- **WHEN** a flow fails while registering a deposit in the app
- **THEN** the only effect of the error workflow is the email alert, and no request is made to the app

### Requirement: Alert-delivery failures are not retried
The system SHALL NOT retry or loop when sending the alert itself fails. The failure SHALL remain visible in the execution history of n8n.

#### Scenario: Email credential is invalid
- **WHEN** the error workflow runs with an invalid email credential
- **THEN** no email is sent, the error workflow is not retried, and the failed execution is visible in n8n's history

### Requirement: Alert address is configuration, not code
The system SHALL read the alert recipient address from a configuration variable, and the exported flow JSON SHALL contain no credentials and no real recipient address.

#### Scenario: Exported flow is reviewed
- **WHEN** the exported JSON of the error workflow is searched for credentials and for the shop's real address
- **THEN** neither is found
