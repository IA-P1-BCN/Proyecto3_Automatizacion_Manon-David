# Evidence · Flow 08 Error Workflow (issue #5)

Test setup: local n8n 2.44.5 (Community), flows `08 Error Workflow` and `99 Error Test` imported from `workflows/`, `99 Error Test` published only for the test, its Error Workflow setting pointing to flow 08. SMTP credential on the team mailbox; recipient and sender from `TIENDA_EMAIL_AVISOS` / `TIENDA_EMAIL_FROM`. Scenarios 1 to 5 were sent with `node workflows/code/run-08-scenarios.js`.

| # | Input | Expected | Result (reported by Manon, 2026-10-23) | Screenshot |
|---|---|---|---|---|
| 1 | `Error: apartado 99 no encontrado` | flow, step and message | OK | pending |
| 2 | `Request failed: Authorization: Bearer abc123SECRET` | `Authorization: [oculto]`, secret absent | OK | pending |
| 3 | `{"api_key":"sk-test-123","detalle":"422"}` | `api_key` masked, `detalle` visible | OK | pending |
| 4 | 2000-character message | cut to 500 | OK | pending |
| 5 | empty message | `error sin mensaje` | OK | pending |

Also unit-tested without n8n: `node --test workflows/code/08-sanitise-error.test.js` (12 tests, all passing).

Still to record: the arrival time (target: under one minute), the Madrid time shown in the email, and the screenshots. Save them in this folder.

Scenario 6 (invalid email credential) was dropped by the team on 2026-10-23 and is not tested.
