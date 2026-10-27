# Evidence · Flow 90 Demo Data (issue #20)

Test notes: `workflows/tests/90-demo-data.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:** 

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Clean run | Run flow 90 on a clean app | Five reservations: activo, liquidado, liquidado, activo (no email), activo past deadline | pending | pending |
| 2 | Emails | Check the shop inbox | Emails only in `TIENDA_EMAIL_AVISOS` | pending | pending |
| 3 | Second run | Run flow 90 again | Nothing created, no email, summary says all skipped | pending | pending |

**Notes / deviations:** 
