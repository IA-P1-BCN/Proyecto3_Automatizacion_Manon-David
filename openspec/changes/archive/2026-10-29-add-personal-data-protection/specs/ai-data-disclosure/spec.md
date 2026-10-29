# Spec Delta

## Purpose

Keeps personal data away from external AI models unless needed, and keeps the list of what is sent honest.

## ADDED Requirements

### Requirement: Inventory of data sent to AI models
`docs/ai-data-inventory.md` SHALL list, for every AI node in the exported flows: the flow and node, the provider and model, exactly which fields are sent, which personal data is never sent, when the node is enabled and the legal basis.

#### Scenario: Current AI use
- **WHEN** the inventory is read
- **THEN** it states that flow 03 sends only the subject and body of a bank-notice email to Groq, only after the sender filter and the `allow_external_ai` gate, and that no other flow sends data to an AI model

### Requirement: Inventory is checked
A unit test SHALL scan the exported `workflows/*.json` for AI nodes (any node whose type contains `langchain`, or an HTTP Request to a known AI API host such as `api.groq.com`) and fail when one is not listed in the inventory.

#### Scenario: Undocumented AI node
- **WHEN** a flow gains an AI node that the inventory does not mention
- **THEN** the test fails and names the flow and node

#### Scenario: Documented only
- **WHEN** every AI node found is in the inventory
- **THEN** the test passes

### Requirement: Minimum data to models
Any flow that sends text to an AI model SHALL NOT send customer phone numbers, emails, balances, deadlines or reservation ids, and SHALL NOT send data about a customer who has not consented (applies to future flows such as HU-11 and HU-12).

#### Scenario: Rule recorded for future flows
- **WHEN** a new AI flow is proposed
- **THEN** `docs/constitution.md` and the inventory point to this rule as part of the definition of done
