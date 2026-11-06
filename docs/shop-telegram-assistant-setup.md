# Shop Telegram assistant setup — HU-12 / #12

Workflow: **12 Shop Telegram Assistant**. Canonical export:
`workflows/12-shop-telegram-assistant.json`. Import only this new inactive draft;
do not recreate, rearrange or replace any other local workflow.

## Meaning and fixed replies

Supported: **¿Cuánto se ha recaudado esta semana?** (Monday through today) and
**¿Qué apartados vencen este mes?** (currently active, deadline in current month,
including overdue active records). All dates use `Europe/Madrid`. Tested aliases
include **¿Cuánto hemos cobrado esta semana?**, **Dime la recaudación semanal**,
`/semana` and `/vencimientos`. Unsupported phrasing gets examples, not a broader
query. No writes, customer search, custom dates or conversation memory.

The weekly template is fixed:

```text
Recaudación de esta semana
Del DD/MM/AAAA al DD/MM/AAAA (Europe/Madrid)
Ventas directas: XX,XX €
Abonos de apartados: XX,XX €
Total recaudado: XX,XX €
```

A verified empty week explicitly says there are no movements. Monthly output
lists reservation number, customer, product/size, API pending and deadline, ordered
by deadline then ID; earlier deadlines say `Fuera de plazo`. A verified empty month
says `No hay apartados activos con fecha límite este mes.` Required failures say
`No puedo verificar los datos ahora. Inténtalo de nuevo más tarde.` Never treat a
failed/incomplete read as zero. These are current sequential queries, not an atomic
snapshot or exact historical report.

## Local-only names (never share the values)

| Name | Where | Meaning |
| --- | --- | --- |
| Shop Header Auth | New workflow's three GET nodes | Existing credential; header `X-API-Key`, not Bearer |
| Groq credential | **Groq Shop Query Model** | Existing provider key; tested model `openai/gpt-oss-20b` |
| Bridge Header Auth | **Receive Private Shop Question** | New credential; header `X-HU12-Bridge-Key` |
| `HU12_TELEGRAM_TOKEN_FILE` | Ignored `.env`, path only | Private token file outside the repo |
| `HU12_BRIDGE_KEY_FILE` | Ignored `.env`, path only | Private bridge-key file; same value later associated with bridge Header Auth |
| `HU12_BRIDGE_UID` | Ignored `.env`, numeric UID | Non-root host user used to build the bridge image |
| `HU12_OWNER_USER_ID`, `HU12_OWNER_CHAT_ID` | Ignored environment | Verified numeric private account/chat IDs |
| `HU12_N8N_URL` | Ignored environment | Exact internal test or production webhook, never host port 5680 |
| `HU12_ALLOW_TELEGRAM_SEND` | Ignored environment | False unless real sends are explicitly approved |
| `owner_user_id`, `owner_chat_id` | **Configure Owner and Effects** | Same verified IDs, strings; blank in Git |
| `allow_external_ai`, `allow_shop_reads` | **Configure Owner and Effects** | Booleans, both false in Git |
| Error Workflow selection | New workflow Settings | Existing local **08 Error Workflow**, never a guessed ID |

David's editor is `http://localhost:5680`; shop is `http://localhost:8001`.
Container-to-container shop reads use `http://tienda:8000`. No current service
restart or global n8n setting change is required. No token belongs in chat, a
command argument, node parameters, exported JSON, screenshots or Git.

## First safe editor preview

**Effects: synthetic data only; no shop call, AI request, message or publication.**

1. Import the new draft into David's editor, keeping all other workflows intact.
2. Explicitly select **Manual Safe Preview**, not the webhook trigger.
3. Keep owner IDs blank and both external effect gates false.
4. Execute and inspect **Show Synthetic Weekly Example**: it must say
   `fixture_only=true`, `external_ai_called=false`, `shop_read=false`,
   `telegram_sent=false`, and show **20,00 €** sales, **15,00 €** payments,
   **35,00 €** total. This checks editor execution, not live integration.

Local test commands and actual evidence are in
[`workflows/tests/12-shop-telegram-assistant.md`](../workflows/tests/12-shop-telegram-assistant.md).

### David-local preparation and acceptance (2026-10-28–29)

**12 Shop Telegram Assistant** already exists as the new inactive draft
`hu12ShopAssistantDavid` in your editor on port 5680. **Do not import another
copy.** The three GET nodes already use the existing shop Header Auth credential,
and Settings already selects your existing **08 Error Workflow**. These are local
associations only, absent from Git. Do not repeat their setup or modify them.

Owner IDs have been paired and independently checked against the local draft;
bridge Header Auth and Groq credentials are associated. The synthetic manual
preview was verified in the disposable CLI without credentials. David also
confirmed the actual editor
result: **20,00 € + 15,00 € = 35,00 €**. Do not repeat that preview.
David also reported creating **Paso Firme - Marisa**, username
**@pasofirme_marisa_david_bot**; its Bot API username was subsequently verified.
Private secret setup and both authorized real Telegram/editor queries succeeded.
Weekly reply: sales 0,00 €, payments 12,00 €, total 12,00 € for 26–29 October.
David confirmed the monthly reply was correct; no customer payload is retained
in Git. Do not repeat bot creation, pairing or the confirmed manual preview.

Initial acceptance used bounded one-shot runs. David subsequently authorized
publication of only HU-12 and a controlled continuous-mode test. Both real queries
also succeeded without the editor listening, and the bridge was stopped cleanly
after David's confirmations. The local workflow remains published; the bridge is
stopped, not an unattended service. The shared export is still inactive, with
blank owner IDs and false effect gates; local IDs/credentials are preserved.
No other workflow was changed.

## Security boundaries

The bridge and n8n both validate owner IDs before expensive work. A username or
"soy Marisa" never grants access. AI sees only a constant, prevalidated query
representation and cannot access the shop/results, choose destinations or compose
the financial answer. This bounds the effects of prompt injection; it is not a
claim that a model can never be tricked. Rubric checks are code, not another model.

Telegram receives the minimal final business reply, including the listed customer
fields, and bot chats are not secret chats. Groq receives no personal/financial
records. Use controlled demo records, private owner chat and Telegram two-step
verification. Unexpected automatic errors use sanitized alerts; a failing alert
channel is not a second delivery guarantee. Manual editor failures do not prove
automatic Error Workflow dispatch.

## Create the dedicated bot (guided, one step at a time)

**Effect: creates a Telegram bot, not shop records or messages to customers.**

For a new installation, use the official **@BotFather**, `/newbot`, and a dedicated
username ending in `bot`. David has already completed this step as recorded
above. Keep the returned token private. Enable Telegram account two-step
verification. Do not reuse Manon's or a customer's bot.

## Store secrets outside the repository

**Effect: creates private local files and updates only HU-12 paths/UID in ignored
`.env`; no network, service startup, API read or message.** In your own terminal,
from the project root, run:

```sh
python3 services/shop-assistant-bridge/setup_secrets.py
```

At `Token:`, paste the BotFather token and press Enter. Input is hidden: no
characters or asterisks appear. Do not put the token in the command, chat or a
screenshot. The helper refuses terminals where hidden input is unavailable.

It creates/reuses these files without printing their contents:

- `~/.config/paso-firme/secrets/hu12-telegram-token`: BotFather token.
- `~/.config/paso-firme/secrets/hu12-bridge-key`: independently generated random
  bridge key (64 hexadecimal characters).

Directories are private (0700); files are owner-only (0600). Existing secrets are
validated, never overwritten. Unrelated `.env` settings remain unchanged. Only
`HU12_TELEGRAM_TOKEN_FILE`, `HU12_BRIDGE_KEY_FILE` and `HU12_BRIDGE_UID` are set;
the helper adds a false send gate if absent. Legacy inline HU-12 secret fields
are removed only after private files exist. Do not add them again.

Compose mounts only those two files read-only. The image uses your non-root host
UID to read 0600 files without weakening permissions; rebuild after setup. Missing
files, symlinks, unsafe permissions or a wrong owner stop startup without echoing
secrets. The token and bridge key are not Docker environment values. **Files are
still plaintext**, not encrypted storage: the owner account and Docker
administrator can read them. No Keychain, public HTTPS endpoint or extraction
from n8n is used.

During the later guided credential step, copy the bridge-key file's value locally
into n8n's **HU12 Local Bridge** Header Auth credential: **Name**
`X-HU12-Bridge-Key`, **Value** that same key. Never send it to the assistant. Keep
the existing shop credential unchanged. Creating that credential is not sending
a message or publishing the workflow.

## Build and pair locally

These commands retain the existing Compose project. If your stack uses `-p`, use
that **same existing project name** on every command, not a second shop stack.

**Effect: build only the new image. Does not start or restart the shop/n8n.**
Run private-file setup first so the build uses the matching host UID. If a state
volume already exists under a different UID, inspect ownership before proceeding;
do not delete/reset it or loosen secret-file permissions as a workaround.

```sh
docker compose -f docker-compose.yml -f docker-compose.shop-assistant.yml build shop-assistant-bridge
```

**Effect: reads Telegram updates to identify your account; sends nothing, calls
no n8n/shop/model, and does not authorize anyone automatically.** Run discovery
only while this bot has no other consumer. It acquires the bridge's state lock.

```sh
docker compose -f docker-compose.yml -f docker-compose.shop-assistant.yml run --rm --no-deps shop-assistant-bridge --discover-owner
```

In **your own terminal**, follow its instruction to send `/start` plus the
one-time phrase to your bot's **private** chat. Do not paste that phrase here.
The command prints only `HU12_OWNER_USER_ID` and `HU12_OWNER_CHAT_ID` after the
matching message, then exits. It times out after two minutes. Review the account
you used, copy those numbers to your local `.env`, and copy them **as strings**
to the two matching fields in **Configure Owner and Effects**. No automatic
first-user enrollment exists. Keep both effect flags and the send gate false.

If the bot already has a webhook, startup refuses; do not delete it automatically
or drop pending messages. Confirm that the token is the new dedicated bot's.

## Associate only the new workflow's credentials

| Node / screen | Field | Choose | Must remain unchanged |
| --- | --- | --- | --- |
| Receive Private Shop Question | Header Auth credential | HU12 Local Bridge | Path `hu12-shop-assistant`, POST, response-node mode |
| Fetch Weekly Sales / Fetch Weekly Deposits / Fetch Active Reservations | Header Auth credential | Existing shop credential | GET, `http://tienda:8000`, complete JSON response, no redirects |
| Groq Shop Query Model | Groq credential | Existing Groq credential | Tested model `openai/gpt-oss-20b` and bounded output |
| Settings | Error Workflow | Existing 08 Error Workflow | Madrid timezone, inactive status, payload retention off |

This only associates credentials; it does not authorize a real AI call, send,
publication or unattended polling. The synthetic preview does not need them.

## Controlled editor + Telegram round trip — only after explicit permission

**Effect: reads current API data, sends a constant query to Groq and replies to
the one authorized private Telegram chat. No financial record is created.**

1. Confirm local owner IDs in both places and controlled/demo shop data. In
   **Configure Owner and Effects**, set only booleans `allow_external_ai=true`
   and `allow_shop_reads=true`. Preserve node names/positions/connections,
   credentials and fixed URLs.
2. Keep `.env` `HU12_N8N_URL` exactly
   `http://n8n:5678/webhook-test/hu12-shop-assistant` and the saved send gate false.
   The command below enables sending for that one process only.
3. Close the node panel and use **Execute workflow** from the canvas; explicitly
   choose **Receive Private Shop Question** if prompted for a starting trigger.
   Do not select **Manual Safe Preview**, which is a separate synthetic branch.
   Merely capturing an event in the webhook node panel does not prove the whole
   workflow ran. Wait for the complete execution to listen.
4. Send one of the two questions to the bot, then run one bounded poll:

   ```sh
   HU12_ALLOW_TELEGRAM_SEND=true docker compose -f docker-compose.yml -f docker-compose.shop-assistant.yml run --rm --no-deps shop-assistant-bridge --once
   ```

5. Inspect the editor results and Telegram content, comparing with the
   independent GET verification. For the second question, start the complete
   workflow execution again before sending/running. Test URLs are temporary
   listeners, not an unattended service. A skipped/replayed update is not proof
   of a new send. `--once` fetches the **oldest next update**, not the latest
   question: a queued weekly question can precede a monthly one. Do not send
   repeated questions or rerun blindly after a failure. Check the queue first;
   then, with a fresh full listener and authorization, process the intended
   pending question only if still under five minutes old. Never drop the queue.
6. Restore the local send gate and both n8n effect flags to false when testing
   ends unless another test is explicitly approved. Do not publish.

`--check` instead of `--once` reads only bot identity/webhook status, consumes no
updates and sends no reply. Normal bridge startup refuses to poll while the send
gate is false. Questions queued more than five minutes ago are ignored; send a
new one after the editor is ready. No global `WEBHOOK_URL` setting is needed.

### Safe diagnostics and credential hygiene

The bridge reports fixed stages: `poll_empty`, `update_processed` with an outcome,
`workflow_unavailable`, `workflow_reply_verified` with status, or delivery error
codes. Ignored updates distinguish `owner_mismatch`, `outside_age_window` and
`unsupported_update` without revealing text or numeric account identifiers.
`sent` confirms Telegram acceptance, not that a business report succeeded:
an `unavailable` reply can also be delivered successfully. Check the reply status
and operator-confirmed content, not just a successful process exit.

Never share a complete webhook input: its headers contain **X-HU12-Bridge-Key**.
If exposed, rotate only that key, update **HU12 Local Bridge → Value**, and keep
the new value private. The bridge key is not the Telegram token. Do not alter
the token unless it was separately exposed. No exposed value belongs in evidence.

For metadata-only SQLite diagnostics, mount the state volume read-only and copy
`delivery.sqlite` plus any `-wal`/`-shm` companions into disposable writable
temporary storage before querying the copy. SQLite can need auxiliary files even
for reads; a read-only mount error does not prove the journal is missing. Never
delete the original state or loosen permissions to diagnose this.

### Export the reviewed tested draft safely

```sh
python3 scripts/export-shop-assistant-safe.py         # validate without writing
python3 scripts/export-shop-assistant-safe.py --write # write shared safe JSON only
python3 scripts/export-shop-assistant-safe.py --published --write # explicitly select the tested published version; output remains inactive
```

The helper checks David's port-5680 workflow with the official n8n CLI. An active
source requires explicit `--published` selection; otherwise it is refused. Raw export
stays in memory. It rejects behavioral/connection drift, normalizes known omitted
editor defaults, preserves tested node IDs/positions, strips credential references,
pins and instance metadata, blanks owner IDs and disables effects in the shared
copy. It never imports/replaces the local draft or changes its credentials/flags.
The generator also preserves that layout while regenerating business logic.

## Production mode, limits and recovery

Production requires **separate explicit publication/unattended-operation
permission**, not just successful editor tests. Only then publish this workflow,
change the bridge URL to `http://n8n:5678/webhook/hu12-shop-assistant`, enable the
verified effect gates and start **only** the bridge:

```sh
docker compose -f docker-compose.yml -f docker-compose.shop-assistant.yml up -d --no-deps shop-assistant-bridge
```

David authorized and verified a **controlled continuous-mode test** on 2026-10-29.
The service used the production URL and a temporary process-level send gate; it
handled both questions automatically and was then stopped. This does not authorize
leaving it running indefinitely. Docker must stay up on an awake Mac. The overlay
deliberately uses `restart: "no"`; automatic startup/restart and a genuinely always-on
host require a separately reviewed operational setup. Importing or publishing the
JSON alone does not run the bridge. Cloud hosting is outside this local delivery.

After a controlled production test, stop only the bridge as shown below. A
published workflow remains published even when the bridge is stopped. To disable
the production endpoint itself, unpublish only HU-12 in the editor after explicit
permission. Changing effect flags in an unpublished draft is not proof that the
already-published version changed; validate the active version before resuming.

One process owns the bot. Do not run discovery/`--once` alongside the running
service. A conflicting webhook, process or bot/state mismatch stops startup
without deleting anyone's configuration. Docker must be running; Telegram keeps
updates only temporarily, and this flow deliberately ignores old requests.

Bounds: 320 input UTF-16 units, five-minute age, six owner requests/minute, one
in flight, two agent iterations, 10,000 records / 5 MiB per API source and at most
ten 3,500-unit replies. The rubric refuses a list that cannot fit completely.
Chunks are paced; an uncertain/partially sent result is **not automatically
retried or recomputed**. Check Telegram and sanitized local metadata, then ask a
new question if appropriate. It is not exactly-once delivery.

The bridge's dedicated `shop_assistant_state` volume stores IDs/cursor/timestamps,
rate/delivery status and confirmed Telegram message IDs, not prompts, replies,
business data or secrets. Retention is seven days / 10,000 request records; a
full journal stops safely. Do not delete it to fix duplicates or reuse it for a
different bot. Logs contain only fixed stage codes and opaque correlation IDs.

To stop only this integration, without touching business data or other flows:

```sh
docker compose -f docker-compose.yml -f docker-compose.shop-assistant.yml stop shop-assistant-bridge
```

Keep its state for reconciliation. Unpublish only this workflow if its previous
publication was authorized. Never run `docker compose down -v` or reset the shop.

Bridge self-tests (fake Telegram/n8n, no external effects):

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s services/shop-assistant-bridge -p 'test_*.py' -v
```
