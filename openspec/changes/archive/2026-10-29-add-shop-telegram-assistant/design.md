# Design

## Context

See `proposal.md` for issue #12's motivation and the agreed two-question scope. The working branch is `feat/12-shop-telegram-assistant`, based on fetched `dev` (`189d530` at preparation). HU-08, HU-14 and the process maps are integrated; existing OpenSpec change checklists are not a reliable substitute for actual GitHub status.

Observed local services are David's shop at host port **8001**, n8n at **5680**, and the optional monthly PDF container. Internal names remain `tienda:8000` and `n8n:5678`; no restart or reassociation of existing services/workflows is needed for the proposed bridge. The running n8n image reports **2.32.6**. Its installed package contains AI Agent versions through 3.1, Code Tool through 1.3 and the Groq chat-model node. This is availability inspection, not a working-agent integration test. No n8n MCP tools are available in this session.

Relevant current contracts:

- The shop API has date-filtered `GET /api/ventas` and `GET /api/abonos`, and `GET /api/apartados?estado=activo`. Omitting pagination returns full lists; completeness must still be checked. No new backend endpoint is required.
- HU-04/HU-08 demonstrate integer-cent sums, `Europe/Madrid` date boundaries and response validation. Their monthly/daily-specific code must not be silently broadened or changed by this delivery.
- HU-14's inventory explicitly forbids sending balances, deadlines, reservation IDs or customer contacts to a model. Its customer email consent table is not Telegram owner authorization.
- Telegram's standard n8n trigger requires a public HTTPS webhook; one bot has only one webhook/update consumer. David explicitly chose an additional local polling bridge instead of exposing n8n via a tunnel.
- The existing project-specific Actions workflows handle review/merge transitions. The generic readiness checker finds no generic-kit config on `main`; do not install a competing kit. Issue #12 is already on the board and In Progress.

## Goals / Non-Goals

**Goals:** A closed read-only assistant whose authority does not depend on a prompt; fixed, auditable answers; a local integration that can be tested through the editor; clear external-data and uncertain-delivery boundaries.

**Non-Goals:** Autonomous agent actions, arbitrary reporting periods, customer search/linking, write tools, a shared multi-role bot, conversation memory, a public endpoint, a cloud deployment, changing customer consent policy or promising universal prompt-injection prevention/exactly-once delivery.

## Decisions

### 1. Dedicated outbound bridge, not a public Telegram webhook

Add `services/shop-assistant-bridge/` and optional `docker-compose.shop-assistant.yml`. A small Python standard-library process uses Telegram HTTPS `getUpdates` long polling, authenticates the owner, then posts a bounded message envelope to a dedicated internal n8n webhook. n8n returns a verified reply envelope; only the bridge sends to Telegram. No bot token is placed in workflow node parameters.

The bridge has no public port, shop API credential, Docker socket or n8n data-volume mount. Use a non-root image, read-only root filesystem, dropped capabilities and a dedicated small metadata volume. The optional Compose overlay adds only this service to the current project network. Use `up -d --no-deps shop-assistant-bridge` after local approval, preserving the actual Compose project name. Do not run a blanket `compose up` or recreate shop/n8n.

Check `getMe` and `getWebhookInfo` before consuming. An existing webhook is a visible setup conflict; never call `deleteWebhook`, use negative offsets or drop pending updates automatically. Use an exclusive local process lock and stop on Telegram's conflicting-consumer response. HU-11 and Manon's HU-13 must not consume this bot token.

**Alternative rejected:** the native Telegram Trigger is less custom code, but requires a public HTTPS endpoint and risks exposing a local editor or disturbing another trigger's webhook. A publicly reachable shop is unnecessary here.

### 2. Explicit enrollment and two independent authorization checks

The operator creates a new bot with BotFather and stores its token in an owner-private file outside the repository, never in this conversation, environment values or command arguments. A bounded discovery mode uses a locally generated one-use pairing phrase to identify the owner's own `/start` message, displays only the numeric user/chat identifiers locally, and exits. It does not authorize automatically, call n8n or send replies. The operator explicitly copies the verified IDs into local bridge configuration and the new workflow's configuration node.

The bridge accepts only fresh original private text messages with both identifiers matching. The workflow's Webhook node uses a new Header Auth credential, header **`X-HU12-Bridge-Key`**; this key is distinct from Telegram, Groq, shop and n8n-management keys. Workflow code independently validates the envelope, owner IDs, age and supported update shape before any AI/API step. Never select a destination from model text, user parameters or an API field: the bridge sends only to its configured owner chat.

Local settings contain `HU12_TELEGRAM_TOKEN_FILE`, `HU12_BRIDGE_KEY_FILE`, `HU12_BRIDGE_UID`, `HU12_OWNER_USER_ID`, `HU12_OWNER_CHAT_ID`, `HU12_N8N_URL`, `HU12_ALLOW_TELEGRAM_SEND`. Inside n8n use **Configure Owner and Effects** with blank `owner_user_id` / `owner_chat_id`, `allow_external_ai=false` and `allow_shop_reads=false` in the canonical export. No global n8n configuration change is needed. `HU12_N8N_URL` is constrained to this workflow's exact test/production internal URLs, not read from a message.

**User-approved revision, 2026-10-29:** do not use macOS Keychain, a public HTTPS tunnel or secret environment values for this MVP. A local interactive `setup_secrets.py` reads the token with hidden input, creates/reuses `~/.config/paso-firme/secrets/hu12-telegram-token` and `hu12-bridge-key` (mode 0600, private directory 0700), and writes only absolute paths/host UID to ignored `.env`. It preserves unrelated settings and never overwrites existing secrets; any old inline HU-12 secret fields are removed only after secure files exist. Atomic `.env` temporary files use an explicitly Git-ignored prefix. No Docker/network/provider call is made by setup.

Compose bind-mounts only the two files as read-only, refuses missing sources rather than creating directories and never puts their contents into the image or environment. The runtime checks regular-file type, owner UID, private permissions and size, refuses symlinks and legacy inline secret variables, and hides secrets from configuration repr. Build the bridge as the **non-root host UID** (group 10001) so a mode-0600 file remains readable without making it group/world-readable. This UID also owns the new isolated state volume; an existing volume from another UID requires inspected migration, never automatic deletion/reset. Files remain plaintext: this protects against accidental Git/environment exposure, not a Docker administrator or compromised owner account.

### 3. The model selects a closed plan, never reads results or writes the answer

The accepted input family is deliberately bounded Spanish, including the agreed examples and conservative tested synonyms. Normalize case/accents/spacing, bound length and validate the *whole* request against permitted question forms. Unsupported vocabulary, personal text, URLs, custom dates/periods, negation/conflicting intents and additional instructions go to fixed help without AI or shop access. Do not strip arbitrary malicious words and pretend the remainder was the original request.

Build a minimal canonical query representation from constant vocabulary only. Do not forward raw Telegram text or numeric IDs. The Groq-backed **Interpret Supported Shop Question** AI Agent receives that representation and can call only **Choose Weekly Collections Plan** or **Choose Monthly Deadlines Plan**, fixed Code Tools returning closed plan descriptors. Tools have no network, credential lookup, `eval`, shell, arbitrary JavaScript input or app data. Require strict input schemas, one accepted tool selection, bounded agent iterations and strict final output; deterministic code checks the chosen plan against the validated request. Invented fields, prose, missing tool evidence, extra/mismatched calls and invalid output fail closed.

Initial model candidate is Groq `openai/gpt-oss-20b`, already named for HU-03; tool calling on David's installed node must be exercised before claiming it works. Use bounded tokens/time and low temperature, but never treat these as determinism/security controls. No memory, generic HTTP tool, retrieval, auto-fixing parser, model-generated code or model-authored financial response is connected. The two plan tools do not grant direct API access.

**Installed-node compatibility finding during implementation:** the first disposable execution with Agent 3.1 on n8n 2.32.6 merged internal parent execution fields into Code Tool arguments, so `additionalProperties:false` correctly rejected the call. Use the already installed Agent 2.2 executor instead, keeping the same strict tool schema and independent checks. A separate **Isolate Model Input** step passes only canonical vocabulary into the agent. No input-schema widening or provider switch is authorized by this compatibility fix.

This intentionally narrows the issue's contextual "API as a tool" suggestion: exposing actual API results to the Agent would violate integrated HU-14 minimization. The AI Agent remains present as requested, but deterministic downstream nodes own the actual reads and rendering. For only two questions an entirely deterministic bot would be simpler; the constrained agent meets the agreed learning requirement without making it a trusted authority.

Document all LangChain nodes in `docs/ai-data-inventory.md` and verify the existing inventory test. No customer details leave for Groq. Telegram does receive the final authorized business reply, including the limited listed customer fields; bot conversations are not end-to-end encrypted secret chats. Use controlled demo records for acceptance, no phone/email fields, and do not describe this as a complete legal compliance assessment.

### 4. Fixed API plans and deterministic rubric

Freeze the workflow's clock once after authorization. Model/caller cannot supply `today`, `desde` or `hasta`. Pure code derives Madrid's date; calendar-day arithmetic does not subtract 24-hour intervals across daylight-saving changes.

| Plan | Allowed reads | Verified result |
| --- | --- | --- |
| `weekly_collections` | Full sales and payments with inclusive `desde=<Monday>` and `hasta=<today>` | Separate sales/payments totals and sum, all in safe integer cents; initial payments only in the payments list |
| `monthly_deadlines` | Full active reservations, filtered locally by the frozen month's date boundaries | Current active records in deadline/ID order, `id`, `cliente`, `producto`, `talla`, API `pendiente`, `fecha_limite`; `fecha_limite < today` marked `Fuera de plazo` |

HTTP nodes use literal `http://tienda:8000` endpoints, GET only, existing Header Auth and full response bodies/headers. Disallow redirects outside that origin. Check `X-Total-Count` where exposed, schema/IDs, duplicates, safe dates, actual amounts and bounded body size/row count. Unexpected methods/hosts/headers cannot come from the model. Require each returned sales/payment date inside the interval and no double use of one record. For the active list, do not silently omit an invalid selected row. Copy API `pendiente`, never `precio - abonado`.

The rubric runs in code before any reply is returned: authorization and permitted plan; frozen period; complete successful reads; valid per-source records; independently consistent totals/selected rows; template and safe destination. Only explicitly complete empty arrays mean zero/no results. An HTTP error, wrong shape, count mismatch or limit excess is unavailability, never an empty answer. Sequential reads are "consulted for this request", not an atomic snapshot or exact historical ledger. Recheck consistency and fail on detectable mutations; do not claim all concurrent changes can be detected by this API.

Planned Spanish templates (the date and data are deterministic inputs, not model output):

```text
Recaudación de esta semana
Del DD/MM/AAAA al DD/MM/AAAA (Europe/Madrid)
Ventas directas: XX,XX €
Abonos de apartados: XX,XX €
Total recaudado: XX,XX €
```

The empty version adds `No hay movimientos registrados en este periodo.` The monthly list has a fixed header and numbered records; empty version says `No hay apartados activos con fecha límite este mes.` Unsupported input lists the two accepted questions. A failed required read says `No puedo verificar los datos ahora. Inténtalo de nuevo más tarde.` Never expose internal paths, tokens or raw upstream errors.

Render plain text with links/previews disabled, normalized control characters and stable ordering. Label any bounded display-field shortening instead of silently changing data. Split at record boundaries into deterministic chunks of at most 3,500 UTF-16 code units, max 10 messages. If a complete result cannot fit, do not send a partial business list; return a fixed limit warning directing Marisa to the app. Use escaped output if the installed Telegram send behavior requires a parse mode; the bridge should prefer no parse mode.

### 5. Bounded replay, delivery and resource use

Initial limits: 320 input characters, max age 5 minutes with small future-clock tolerance, 6 accepted requests per minute for the owner, one in-flight request, two agent iterations and bounded output tokens, 100 returned updates per poll, fixed request/body/row/time limits. The planned workflow cap is 10,000 records / 5 MiB per source, with a clear error rather than truncation. Final timeouts must be tested against installed node behavior, not guessed as achieved performance.

Bridge persistence is a small SQLite journal on its own volume: bot identity/cursor, update/message identifiers, timestamps, per-chunk delivery status and an opaque request ID. Never store request text, reply text, customers, totals or keys there. Retain dedup/rate metadata for seven days with a bounded row count; age checks make expired entries ineligible for reply. Claim work and record a `sending` state durably before an external send. Store successful Telegram message IDs on confirmed acceptance, then acknowledge the update cursor. Restart/duplicates skip sent work; unfinished reads may be reprocessed because they have no financial effect. A `sending` record after a crash or ambiguous send is held for manual reconciliation, not retried or reported as sent. There is no exactly-once guarantee; prioritizing no duplicate may lose a reply, recoverable by a new question.

Safe bounded retries apply to GET reads and explicit pre-acceptance rate limiting only; no blind retries of `sendMessage` or uncertain sends. Enforce flood limits before model/API work. A wrong owner produces no reply and no alert flood. A bridge failure logs only sanitized stage/code/correlation metadata. Unexpected automatic workflow failures use the existing local Error Workflow, selected by the user; do not edit it. Disable successful/failed execution-payload persistence for the new workflow where supported and keep progress-saving/pinning off; editor evidence uses controlled data. Avoid raw exceptions containing Telegram request URLs.

### 6. Scoped files and verification before manual work

Planned new files:

- `workflows/12-shop-telegram-assistant.json`, pure logic/tests/generator under `workflows/code/12-shop-telegram-assistant*`.
- `services/shop-assistant-bridge/` runtime, Dockerfile and isolated tests; `docker-compose.shop-assistant.yml`.
- `specs/12-shop-telegram-assistant.md`, `docs/shop-telegram-assistant-setup.md`, `workflows/tests/12-shop-telegram-assistant.md`, a GET-only verification script and safe fixtures.

Append only the relevant credential/variable-name template, README setup link, AI inventory and AI-log entries during implementation. Check shared-file drift against Manon's work first. Do not edit existing workflow JSON or backend/frontend. Map the task-sync script to this change only if needed; syncing the GitHub issue body is a remote mutation and needs separate permission.

Tests first use pure JavaScript/Python logic and local stub servers: authorization ordering, malformed envelopes, aliases, unsupported periods, injection in message/API/model/tool fields, no arbitrary tool capability, all rubric failures, empty data, cents/overflow, week/year/DST boundaries, current active versus terminal records, stable text/chunks, retries and restart/uncertain-send behavior. Count model, API and Telegram calls to prove zero side effects on forbidden paths. Validate generated JSON, expressions, node versions/connections, effect defaults, no model access to API results and no write path. Run relevant existing regression/inventory tests without reworking them to hide failures.

Use a disposable n8n stack with stub Telegram/Groq/shop endpoints and isolated state to execute the actual exported graph and bridge. Verify actual serialization/tool-call behavior in the installed Agent family. Then compare independent real API GET calculations on David's intended app; print aggregates, not customer contacts. Import only this new draft, associate existing local credentials and explicitly select the manual trigger for the first editor preview with external effects off. Preserve any manual positions/names/credentials in subsequent fixes. Real Groq or Telegram calls and publication require explicit authorization after their effects are explained. CLI/disposable success never substitutes for the editor and owner-confirmed Telegram reply.

## Risks / Trade-offs

- **Prompt injection cannot be ruled out inside an LLM** → Security comes from no privileged tools, no raw personal/model inputs, independent plan validation and deterministic replies; adversarial tests target unauthorized effects rather than relying on a system prompt.
- **Conservative language acceptance may reject a harmless new wording** → Return the two examples, retain strict scope and add tested aliases later; do not broaden authority silently.
- **The constrained Agent adds calls that a two-command bot would not need** → Required by the agreed AI-assisted scope; cap requests and fail clearly on model/provider limits.
- **Telegram sees the business reply and the operator's account can be compromised** → Dedicated private owner account, local allowlist, minimum output and recommended Telegram two-step verification; no claim of secret-chat encryption.
- **Another bot consumer or a bridge key leak bypasses assumptions** → Dedicated bot ownership, startup webhook/lock checks, independent owner checks, no public listener and key rotation outside Git.
- **Crash after send or multi-chunk partial delivery** → Persistent per-chunk uncertainty state, no automatic duplicate, explicit manual reconciliation; a fresh question is the recovery path.
- **Five-hour target competes with integration complexity** → Prioritize the complete two-question safe path and essential tests, log active work separately from waiting, reassess instead of dropping safety or adding optional questions.

## Migration Plan

1. Implement and validate this new scope on its branch; keep current containers/workflows untouched and preserve both untracked `.DS_Store` files.
2. Guide David through creating the dedicated bot and local keys/owner pairing without copying tokens into chat. Document exact fields, values-by-name and effect of every step.
3. Import the new inactive workflow and reassociate only its credentials. Run safe manual editor previews and independent API comparisons before real messages.
4. With permission, start only the bridge against the editor's temporary test webhook for one controlled round trip. Re-listen explicitly between test events; do not assume a test webhook is a permanent endpoint. Test sends remain separately gated.
5. Only if explicitly authorized, publish the workflow and switch the bridge to its production internal webhook for unattended polling. Otherwise leave it stopped/unpublished and report the limitation.
6. Export the tested, sanitized workflow back to Git; update evidence, setup, inventory and log. Obtain fresh commit/push/PR approval for #12, not reuse #19's publication authorization.

Rollback stops only `shop-assistant-bridge` and unpublishes only the new workflow if its publication was authorized. Preserve its local metadata volume for reconciliation; never reset the shop/n8n volumes or change another bot's webhook.

## Open Questions

Guided setup and both authorized real query paths completed on 2026-10-29;
see the evidence guide for David's confirmations and exact coverage limits.
Owner IDs, keys and local credential references remain outside tracked artifacts.
No design question remains for the two-question local MVP. A later explicitly
authorized controlled publication/continuous-mode test passed both queries; the
bridge was stopped afterward. Indefinite operation and cloud hosting remain
separate, unauthorized actions, not acceptance claims.

### Acceptance follow-up decisions

- One-shot polling processes the next queued update, not the latest question.
  Keep cursor ordering and deduplication intact; document queue-aware full-editor
  testing rather than dropping old updates or silently selecting a later one.
- Add only fixed poll/outcome/rejection categories and validated reply status to
  diagnostics. No prompts, business data, IDs or credentials are logged. Delivery
  acceptance must not be confused with a verified business response.
- Export the actual tested draft via official CLI into memory, preserve editor
  positions/IDs, verify behavioral equality, normalize only known omitted defaults
  and sanitize local configuration in the shared copy. Do not reimport it over
  David's manually configured draft. Publication and local gate cleanup remain
  distinct from saving the shared artifact.
