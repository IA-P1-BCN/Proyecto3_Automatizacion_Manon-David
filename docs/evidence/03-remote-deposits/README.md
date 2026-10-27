# Evidence · Flow 03 Remote Deposits (HU-03 / issue #3)

Test notes: `workflows/tests/03-remote-deposits.md`. Save screenshots in this folder; crop out secrets, tokens and customer data that is not demo data.

**Setup:** (n8n version, flows imported, published flows, credentials by name only)

**Date and tester:** 

| # | Scenario | Action | Expected | Result | Screenshot |
|---|---|---|---|---|---|
| 1 | 01 bizum_carmen | Send `data/correos/01_bizum_carmen.eml` | Registers | pending | pending |
| 2 | 02 bizum_jorge | Send `02_bizum_jorge.eml` | Registers by reservation number | pending | pending |
| 3 | 03 transferencia_lucia | Send `03_transferencia_lucia.eml` | Registers and settles | pending | pending |
| 4 | 04 bizum_laura | Send `04_bizum_laura.eml` | Asks Marisa (overpayment) | pending | pending |
| 5 | 05 bizum_romero | Send `05_bizum_romero.eml` | Asks Marisa | pending | pending |
| 6 | 06 bizum_paula | Send `06_bizum_paula.eml` | Asks Marisa (past deadline) | pending | pending |
| 7 | 07 transferencia_desconocido | Send `07_transferencia_desconocido.eml` | Asks Marisa | pending | pending |
| 8 | 08 publicidad_banco | Send `08_publicidad_banco.eml` | Ignored | pending | pending |
| 9 | 09 bizum_silvia | Send `09_bizum_silvia.eml` | Registers | pending | pending |
| 10 | Customer receipts | Check registered payments | Receipt from flow 02; flow 03 emails no customer | pending | pending |
| 11 | Idempotency | Run the same emails twice | No duplicate deposits in the app | pending | pending |
| 12 | App down | `docker compose -p paso-firme stop tienda`, send a payment email | Flow 08 alert; restart `tienda` | pending | pending |

**Notes / deviations:** 
