# Evidence · Flow 06b Expired Reservations (HU-07 / issue #7)

Test notes: `workflows/tests/06b-expired-reservations.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:** 

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Expire + voucher | Reservation with own email and past deadline, manual run | App shows `vencido`; one voucher email; one shop summary | pending | pending |
| 2 | Rerun | Run again | No second voucher, no summary | pending | pending |
| 3 | No email | Reservation without email | No customer email; "avisar a mano" entry with voucher code | pending | pending |
| 4 | SMTP broken | Wrong SMTP password for one run | Reservation expired, flow 08 alert, code still reaches Marisa | pending | pending |
| 5 | Schedule 09:05 | Publish for the test (with permission) | Fires once, Madrid time; unpublish | pending | pending |

**Notes / deviations:** 
