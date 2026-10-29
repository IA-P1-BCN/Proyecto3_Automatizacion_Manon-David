# HU-12 verification — Shop Telegram assistant

Issue #12 — HU-12 · Marisa pregunta a su negocio. Evidence is separated by test
type: no static/unit test is a live Telegram or editor test.

## Pure JavaScript checks

```sh
node --test workflows/code/12-shop-telegram-assistant.test.js
```

Initial pure logic: **93 tests passed** on 2026-10-28. Covers numeric owner
authorization, full-message allowlisting, aliases, disabled gates, malicious model
tool/output fields, strict plan evidence, Monday/year/month/DST boundaries,
integer cents/overflow, duplicate/incomplete API replies, initial payments counted
once, zero data, current/terminal/overdue states, unchanged pending amounts,
stable output, hostile fields, deterministic chunks and complete-list limits.

## Generated workflow and inventory checks

```sh
node --test workflows/code/12-shop-telegram-assistant*.test.js workflows/code/ai-inventory.test.js
```

**110 tests passed**: 93 pure logic, 13 generated-graph/embedded-code checks and
4 inventory checks. The exact known-node inventory assertion explicitly checks
canonical files 03 and 12; its separate undocumented-node test still checks all
exports, including David's preserved Git-ignored tested copy of flow 03.

## Bridge and container checks

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s services/shop-assistant-bridge -p 'test_*.py'
docker compose -f docker-compose.yml -f docker-compose.shop-assistant.yml config --quiet
docker build -t paso-firme-hu12-bridge-test services/shop-assistant-bridge
```

**24 Python tests passed** using fakes/local HTTP only, covering owner filtering,
profile minimization, safe defaults, cursor locks, enrollment, no webhook deletion,
duplicate/restart/rate/retention behavior, uncertain and partially sent replies,
no payloads/keys in the metadata journal, fixed destination, sanitized errors and
redirect refusal. Compose validation and the isolated image build succeeded.
No existing shop/n8n service was recreated.

### File-secret revision — 2026-10-29

**35 Python tests passed** after replacing inline secret variables with private
files and adding the hidden-input setup helper. Additional cases verify missing,
relative, symlinked, nonregular, wrongly owned, oversized and nonprivate files;
legacy inline-secret refusal; secret-free configuration repr; private helper
output; reuse without overwrite; unrelated `.env` preservation and safe removal
of legacy fields only after private files exist.

```sh
python3 scripts/test-shop-assistant-secret-files.py --run
```

**PASS, offline Docker test:** synthetic host files with mode 0600 are readable
by the matching non-root UID; both bind mounts reject writes as read-only;
world-readable input is refused. Docker environment metadata contains no secret
values. The two disposable containers had networking disabled and were removed;
no real secret files, Telegram calls or live services were used. The test also
checks the resolved Compose file's path-only settings and missing-source refusal.
This is not evidence of a real bot token, owner pairing or provider exchange.
After reconciling the guide, Python tests (35), JavaScript regressions (380),
Compose validation, strict OpenSpec validation and `git diff --check` also pass.

## Independent real API comparison

```sh
python3 scripts/verify-shop-telegram-assistant.py
```

**PASS on 2026-10-28 at 15:44:20 Europe/Madrid**, intended shop mapping checked as
host port 8001. Three GET requests only; no AI, Telegram or financial write.
Independent Python Decimal/calendar calculations match the JavaScript helpers:

- Week 2026-10-26 through 2026-10-28: sales **0 cents**, payments **1,200 cents**,
  total **1,200 cents**. These are observed test-shop figures, not fixed fixtures.
- Current month: **5** matching active reservations, **3** overdue. IDs, deadlines
  and pending cents were compared internally; no customer names/contacts printed.
- Verified-row fingerprint:
  `35ddcf76e06dc7a6a82b82a9a91c33a84369f59c44e830762db89bcad154d63e`.

The queries are sequential, not an atomic snapshot. Reruns can legitimately
change if another workflow or the operator changes the shop's records.

Key expected results:

| Case | Expected |
| --- | --- |
| EUR 20 sale + initial EUR 5 payment + later EUR 10 | Sales 20,00 €, payments 15,00 €, total 35,00 € |
| Complete successful empty lists | Explicit no movements/no matching reservations |
| API timeout/401/bad schema/count mismatch | Unavailability, never zero or a partial report |
| Today / yesterday deadline | Today valid; yesterday `Fuera de plazo`, not invented `vencido` |
| Unknown user/group/forward/edited/stale update | No AI/shop call or business reply |
| Custom period/customer/write request/injected instructions | Help or rejection, no shop read |
| Model selects another tool/intent or invents amounts/URL | Validation failure, no privileged operation |
| Same accepted query/date/data with different row order | Same Spanish business reply |
| List exceeds complete output limit | Whole-result warning, no silently truncated list |

## Disposable actual-graph integration

Build the bridge test image as above, then opt in explicitly:

```sh
python3 scripts/test-shop-assistant-disposable.py --run
```

**PASS with n8n 2.32.6** on 2026-10-28. The test creates a randomly named,
internally isolated Docker network, stub shop/model service and n8n CLI runner;
it removes only its own labeled containers/network afterward. It uses fake
credentials/providers, never the local n8n data volume or a real Telegram bot.

- The **unmodified, credential-free canonical manual preview** executes with
  zero model/shop calls and the expected synthetic 35,00 € result.
- The actual Agent/Groq-node/strict Code Tools execute both plans. Weekly
  synthetic data yields 35,00 €; monthly projection handles a hostile field as
  inert text and excludes terminal records.
- Empty data, API failure and count mismatch take the expected paths. Invalid
  final model output, wrong tool choice and unexpected tool arguments cannot
  reach the shop API. Unauthorized and unsupported inputs make zero model/shop
  calls.
- The real Python HTTP adapter calls a local fake endpoint backed by the actual
  n8n CLI graph and delivers the verified 35,00 € reply to fake Telegram; duplicate
  and restart replay do not send again. Captured model user input is only one of
  the two constant canonical query objects.

The CLI harness replaces transport trigger/response nodes and the final
post-response error stop, not the business/Agent/tool/API logic. It therefore
does **not** prove live webhook authentication, actual Groq responses, Telegram
delivery or automatic Error Workflow dispatch; those require the remaining
local/editor/provider tests.

**Compatibility correction found by execution, not static tests:** Agent 3.1 on
this installed n8n merges internal fields into Code Tool arguments, causing the
strict schema to reject even a valid selection. Agent **2.2**, already installed,
works with the unchanged `additionalProperties:false` schema. An explicit
**Isolate Model Input** node also strips all upstream metadata before the Agent.
The expected business results and security checks were not weakened.

## Full focused regression

```sh
node --test workflows/code/*.test.js
```

**380 JavaScript tests passed** (zero failures) after the implementation and
inventory extension. OpenSpec strict validation, `git diff --check`, targeted
secret-pattern scanning and shared-JSON credential/pin/personal-path checks pass.

## Integration checklist — actual remaining work

- [x] Generated workflow node/connection/expression/default checks.
- [x] Bridge tests with fake HTTP services, replay/restart and uncertain sends.
- [x] Disposable n8n + fake model/shop/Telegram end-to-end execution.
- [x] Independent GET-only comparison with David's actual shop API.
- [x] Import only the new inactive draft in David's n8n; existing shop auth and Error Workflow associated locally.
- [x] Explicit manual preview button in David's editor: David confirmed 20,00 € sales + 15,00 € payments = 35,00 €; no repeat needed.
- [x] Dedicated bot Paso Firme - Marisa / @pasofirme_marisa_david_bot verified through Bot API; owner pairing and local identifier consistency checked without printing IDs.
- [x] Private-file setup implementation and offline Docker permission checks (synthetic secrets only).
- [x] Authorized real Groq tool-call paths for both queries on the tested graph.
- [x] Authorized private Telegram replies received and checked by David (weekly and monthly).
- [x] Current duplicate/unauthorized/failure coverage classified as unit/stub/disposable, not real Telegram.

## Authorized real editor / Telegram acceptance — 2026-10-29

David entered the token with hidden input in his own terminal, built the bridge,
completed nonce-based pairing and associated bridge/Groq credentials. Read-only
inspection verified bridge/n8n owner IDs agree and all required credentials and
the existing Error Workflow are associated. Bot API `getMe` verified the expected
username; neither secret values nor account IDs are recorded here.

David explicitly authorized the weekly read/reply, then the monthly read/reply.
The bot was not published and each bridge run used `--once` with a process-local
send gate. The real graph requires closed model/tool evidence before any report;
the successful business replies exercise that path, not the synthetic preview.
No raw provider trace or customer list is retained as evidence.

| Real case | Observed result |
| --- | --- |
| Initial incomplete editor/trigger attempt | Fixed unavailability delivered, no financial claim. This does not identify a Groq failure. |
| Weekly full-workflow test, bridge run at 13:49 Madrid | David confirmed period 26–29 October, direct sales 0,00 €, layaway payments 12,00 €, total 12,00 €. |
| First monthly attempt, bridge run at 13:52 | A queued **weekly** question was processed first. Read-only queue inspection confirmed the last handled update was weekly and the distinct monthly update was pending and unhandled. Not a model intent-selection failure. |
| Monthly pending question, full listener restarted, bridge run at 13:54 | Processed within the five-minute window; David confirmed the monthly response was correct. Names, IDs, amounts per customer and message text are not copied here. |

The metadata journal showed four handled requests/four confirmed message parts:
one unavailability, two weekly replies to distinct queued questions, and the
monthly reply. `sent` alone proves only Telegram acceptance, not report validity.
No identical-update replay was deliberately sent to the real bot; no duplicate
financial write can occur because HU-12 has no business-write path.

At 14:03:34 Madrid, a fresh independent three-GET comparison again passed:
weekly sales/payment/total cents **0 / 1200 / 1200**, month **5** matching active
records (**3** overdue), with the same row fingerprint recorded above. This
checks current API/helper consistency; David's monthly confirmation is human
acceptance, not a retained byte-for-byte comparison of the live Telegram body.

### Corrections and security handling

- The initial instruction to listen only in the webhook node panel was
  insufficient to establish a complete workflow test. The guide now requires
  **Execute workflow** from the canvas with the webhook selected as the start.
- The original bridge produced no diagnostic for empty/ignored one-shot polls.
  Fixed stage/outcome/reason diagnostics and queue-order regression tests were
  added; they do not change authorization, cursor order or delivery rules.
- A copied webhook input exposed the bridge authentication header. With explicit
  permission the local bridge key was atomically replaced (0600); David updated
  n8n's credential before the successful tests. The Telegram token was untouched.
  Neither old nor replacement key is recorded in project files.
- The first SQLite read-only diagnostic failed; copying the database and its WAL
  companions into disposable storage allowed inspection without changing state.

### Explicit coverage limits

Unauthorized users, forged envelopes, duplicates, restarts, invalid model
outputs, source failures and uncertain/partial sends are covered by pure/stub/
disposable tests as described above. No second real Telegram test account was
provided for this acceptance; no live Groq outage or deliberate shop/provider
failure was triggered. The real initial failure covered the transport/editor
unavailability response only. Production publication, continuous operation,
automatic Error Workflow alert dispatch and real-provider negative-case coverage
were **not** claimed at the one-shot checkpoint. A later explicitly authorized
publication/continuous-mode test is recorded below; the other coverage limits
remain. These limits do not substitute fake tests for real positives.

## Final export and focused verification

`scripts/export-shop-assistant-safe.py --write` read only David's inactive draft
through the official CLI, kept raw data in memory and wrote the shared safe JSON.
The export preserves editor IDs/layout, matches generated business logic after
normalizing known omitted defaults, and excludes credentials, owner IDs, pins and
instance metadata. No local draft was overwritten. The generator preserves that
reviewed layout on regeneration. Drift/missing business parameters are rejected.

After the diagnostic revision: **39 bridge/helper Python tests**, **6 pure safe
export tests**, and **380 JavaScript regressions** pass. The rebuilt test image
passes the disposable actual-graph integration again on n8n **2.32.6**, and the
offline secret-file Docker test passes again. Only image builds were performed;
the new diagnostics were not used to send another real message.

Final Compose and strict OpenSpec validation plus `git diff --check` pass.
The final scan checked 30 intended text files against the current local secrets,
owner IDs and targeted credential patterns: none found. Shared JSON is verified
inactive, credential-free, owner-blank, effect-disabled and unpinned. Unrelated
`.DS_Store` files were excluded and preserved.

The shared export is inactive and default-off. Local n8n IDs/credentials are
preserved; both local effect flags were still true at read-only final inspection,
so restoring them to false in the editor remains an operator cleanup step unless
subsequently confirmed. The saved bridge send gate is false and no bridge process
was running at that checkpoint. No commit, push or PR had occurred. The following
authorized operational test supersedes the earlier publication status.

## Controlled published / continuous-mode acceptance — 2026-10-29

Before the authorized commit, David asked whether the bridge actually supports
continuous use. It already loops unless `--once` is supplied, but this had not
been verified against the published workflow. He explicitly authorized publishing
only HU-12, running a controlled continuous test and stopping the bridge afterward.

- Official CLI source inspection showed CLI publication would require restarting
  n8n. David published through the editor instead, avoiding a restart of other
  workflows. Preflight subsequently verified the active version, both effect
  flags and all required credential associations.
- Started **only** `shop-assistant-bridge` with `up -d --no-deps`, production URL
  `http://n8n:5678/webhook/hu12-shop-assistant` and a process-level send gate. Saved
  `.env` values were unchanged. Inspection verified the process was running
  without `--once`, no published ports and the production endpoint selected.
- David confirmed the weekly reply was correct without editor listening, then
  confirmed the monthly reply was correct. Sanitized bridge logs show two
  `workflow_reply_verified` events with `status=ok` and two `sent` outcomes.
- Stopped only the bridge after both confirmations; inspected **running=false,
  exit code 0**. State and unrelated services were preserved. The local workflow
  remains published and the bridge stopped; indefinite/unattended operation was
  not authorized or tested. Automatic restart and 24-hour/cloud hosting remain
  outside this delivery.
- Exported the **tested published version** with explicit `--published --write`.
  The shared JSON remains inactive/default-off, owner-blank, unpinned and
  credential-free. Behavior and editor layout match; no local draft was imported
  or replaced. The sanitizer has **8 tests**, including rejection of an active
  source without explicit published selection and an active source lacking an
  active version. Bridge tests remain 39 and JavaScript regressions 380.

Only the commit was authorized for Git publication at this stage. No push, PR,
merge, other service publication or unrelated container removal was authorized.
