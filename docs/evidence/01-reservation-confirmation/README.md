# Evidence · Flow 01 Reservation Confirmation (HU-01 / issue #1)

Test notes: `workflows/tests/01-reservation-confirmation.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:** 

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Reservation with email | Create a reservation in the app with your email | Spanish email within 1 min, amounts as shown by the app | pending | reservation confirmation.png |
| 2 | Paid in full | Create a reservation paid in full | Paid-in-full text | pending | reservation confirmation and full payment.png |
| 3 | No / malformed email | Create reservations with no email and with `carmen.example.com` | Shop alert, execution successful | pending | pending |
| 4 | Two in a row | Create two reservations in a row | Exactly two emails | pending | pending |
| 5 | SMTP broken (task 2.3) | Wrong SMTP password, create a reservation | Flow 01 fails, flow 08 alert arrives; restore credential | pending | pending |

**Notes / deviations:** 
