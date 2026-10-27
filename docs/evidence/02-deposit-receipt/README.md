# Evidence · Flow 02 Deposit Receipt (HU-02 / issue #2)

Test notes: `workflows/tests/02-deposit-receipt.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:** 

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Partial deposit | Register a deposit from the app UI | Receipt with amount paid and pending, within 1 min | pending | abono recibido.png |
| 2 | Settling deposit | Register the deposit that settles the reservation | Collect-your-shoes text, no pending amount | pending | ultimo abono.png |
| 3 | API deposit | `POST /api/apartados/{id}/abonos` with `X-API-Key` | Same receipt | pending | pending |
| 4 | No email | Deposit on a reservation without email | Shop alert, execution successful | pending | pending |
| 5 | SMTP broken | Wrong SMTP password, register a deposit | Flow 08 alert; restore credential | pending | pending |

**Notes / deviations:** 
