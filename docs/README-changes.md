# README changes to apply

`README.md` is the supplied assignment (Spanish), so it is not edited by the agents. These are the changes the team should apply when convenient. They cover tasks 5.1 and 5.2 of `openspec/changes/add-error-workflow`, plus two corrections found while working on flow 08. Suggested README text is in Spanish.

## 1. Credentials and variables used by flow 08 (task 5.1)

Add to the README's credentials/variables list (names only, never values):

| Name | Type | Used for |
|---|---|---|
| SMTP (Infomaniak mailbox) | n8n credential | Send the alert email |
| `TIENDA_EMAIL_AVISOS` | environment variable in `.env` | Address that receives the alerts (Marisa) |
| `TIENDA_EMAIL_FROM` | environment variable in `.env` | Sender mailbox, the same as the SMTP credential's account |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` | set in `docker-compose.yml` | Lets flows read `$env.…` (blocked by default since n8n v2) |
| `TIENDA_PORT` (optional) | environment variable in `.env` | Browser port of the app when 8000 is busy; n8n still uses `http://tienda:8000` |

Suggested text:

> **Configuración de los avisos de error (flujo 08).** Copia `.env.example` a `.env` y rellena `TIENDA_EMAIL_AVISOS` (dirección que recibe los avisos) y `TIENDA_EMAIL_FROM` (buzón desde el que se envía). En n8n crea la credencial SMTP del buzón (contraseña de buzón generada en Infomaniak). Las *Variables* de n8n son de pago, por eso se usan variables de entorno. Si el puerto 8000 está ocupado, pon `TIENDA_PORT=8001` en tu `.env`: solo cambia la URL en tu navegador (`http://localhost:8001`); dentro de n8n sigue siendo `http://tienda:8000`.

## 2. Failed executions must be checked (task 5.2)

If the alert email itself cannot be sent, nobody is notified automatically (decided: no backup channel). Suggested text:

> **Revisa el historial de ejecuciones.** Si falla el propio correo de aviso (credencial caducada, sin red), el error solo queda en el historial de n8n. Revisa de vez en cuando la pestaña *Executions* y filtra por *Error*.

And the setup step:

> **Conecta cada flujo con el flujo 08.** En cada flujo Essential (01, 02, 03 y 05): *Settings → Error Workflow → `08 Error Workflow`*. Sin esto no llegan los avisos de ese flujo. Vale también para el flujo 00 (router) y para cada flujo que llame a otro: el fallo de un flujo llamado solo avisa si ese flujo tiene su propio *Error Workflow*.

## 3. Corrections

- **Number of sample emails:** the README says 8 (`El flujo 3 resuelve bien los 8 correos…`, near line 348). `data/correos/` holds **9** files. Suggested: "los 9 correos".
- **Email provider:** the README lists Gmail as an example (lines near 140 and 153). The team uses an Infomaniak mailbox (IMAP to read, SMTP to send). No change is required because the README says "Gmail o IMAP", but the project documents say Infomaniak.
