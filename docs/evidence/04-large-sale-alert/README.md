# Evidence · Flow 04 Large Sale Alert (HU-09 / issue #9)

Test notes: `workflows/tests/04-large-sale-alert.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:** 

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | Below threshold | Register a sale of 100 € (threshold 150) | No email; execution ends successfully | pending | pending |
| 2 | Above threshold | Register a sale of 189,50 € | Exactly one Spanish email to the shop | pending | pending |
| 3 | Equal to threshold | Register a sale equal to the threshold | No email | pending | pending |
| 4 | Threshold changed | Edit `TIENDA_UMBRAL_VENTA_GRANDE`, `docker compose -p paso-firme up -d`, repeat | Result changes; exported JSON does not | pending | pending |
| 5 | Empty threshold | Empty variable, register a sale | Flow 08 alert | pending | pending |

**Notes / deviations:** 
