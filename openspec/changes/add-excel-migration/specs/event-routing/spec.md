# Spec Delta

## ADDED Requirements

### Requirement: Events are ignored while a migration runs
The system SHALL check the migration flag before routing an app event and, when it is on, SHALL ignore the event without calling any handler flow and without raising an alert.

#### Scenario: Flag on
- **WHEN** the migration flag is on and the app sends `abono.registrado`
- **THEN** no handler flow runs and the router execution succeeds

#### Scenario: Flag off
- **WHEN** the migration flag is off
- **THEN** events are routed exactly as before

#### Scenario: Flag unreadable
- **WHEN** the router cannot read the flag
- **THEN** the event is routed as before and the failure is visible in the execution, so a real event is never lost because of the flag

#### Scenario: Flag left on by a crash
- **WHEN** the flag has been on for more than 30 minutes
- **THEN** the router treats it as off and routes the event, so a crashed migration never silences the shop
