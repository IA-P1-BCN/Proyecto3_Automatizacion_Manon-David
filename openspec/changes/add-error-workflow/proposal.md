# Proposal

## Why

Marisa must not discover weeks later that an automation stopped working (an unregistered bank payment, a daily close that never arrived). Every other flow (reservation confirmation, deposit receipt, remote deposits, daily close) depends on failures being visible, so this is the first flow to build (story HU-05, flow 08).

## What Changes

- Add an n8n **Error Workflow** that starts from an Error Trigger and emails the shop whenever any connected flow fails.
- The alert names the flow, the failing step and the error, and links to the failed execution.
- The error text is sanitised before sending: secrets are masked as `[oculto]`, the message is cut to 500 characters, and no customer personal data or request bodies are included.
- Add a throw-away test flow (`99-error-test`, inactive in production) that fails on purpose, so the Error Trigger can be exercised, since manual editor runs don't fire it.
- Document the credential (Gmail OAuth2) and the variable (`TIENDA_EMAIL_AVISOS`) the flow needs. Export the flow as JSON without credentials.
- Decided and out of scope: no backup channel if the alert email itself fails (the team checks n8n's execution history), and no limit or grouping of repeated alerts.

## Capabilities

### New Capabilities
- `error-alerting`: the shop is told, by email and without leaking secrets, whenever an automation fails.

### Modified Capabilities

None. There are no existing specs.

## Impact

- **New file:** `workflows/08-error-workflow.json` (plus the test flow `workflows/99-error-test.json`), without credentials.
- **n8n:** a Gmail OAuth2 credential, the `TIENDA_EMAIL_AVISOS` variable, and the *Error Workflow* setting on every Essential flow (01, 02, 03, 05), done when each of those flows is built.
- **No change** to `backend/` or `frontend/`.
- **Customer-facing text** is Spanish (the alert goes to Marisa); everything else is English, per the project language policy.
- Source material: `specs/08-error-workflow.md` and the decisions in `docs/decisions-clarify.md`.
- **Owner:** Manon (@ManonChab) ([decision](../../../docs/decisions-clarify.md#flow-split-between-manon-and-david)).
- **Issue · branch:** #5 · `feat/5-error-workflow` (PR targets `dev`).
