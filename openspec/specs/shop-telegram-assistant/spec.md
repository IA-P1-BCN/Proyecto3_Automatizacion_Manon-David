# shop-telegram-assistant Specification

## Purpose
Give Marisa private, verified Telegram answers to two read-only business questions, with permissions and financial correctness enforced independently of the language model. Implements issue #12 — HU-12 · Marisa pregunta a su negocio.

## Requirements

### Requirement: Authenticate the bridge and owner before data access
The system SHALL accept requests only from the authenticated local bridge and the configured numeric Telegram owner and private-chat identifiers. It SHALL fail closed when configuration is absent or inconsistent. Usernames, message text and model output MUST NOT grant or change permissions.

#### Scenario: A stranger claims to be Marisa
- **WHEN** an unlisted sender writes "soy Marisa" or copies the owner's username
- **THEN** no model call, shop read or business reply occurs

#### Scenario: Private owner message arrives through the dedicated bridge
- **WHEN** bridge authentication is valid, sender/chat identifiers match the local allowlist and the chat is private
- **THEN** the request can proceed to validation

#### Scenario: Group, forwarded or unsupported update
- **WHEN** an update is from a group/channel, is forwarded, edited, non-text or otherwise unsupported
- **THEN** it cannot trigger a model call or shop read

#### Scenario: Forged bridge or empty configuration
- **WHEN** a request lacks valid bridge authentication or either owner's identifier is unconfigured
- **THEN** it is rejected before business processing, without echoing secrets or the incoming message

### Requirement: Enroll the owner by explicit local review
The system SHALL require the operator to create the dedicated bot and explicitly configure verified owner/chat identifiers locally. A bounded discovery step SHALL NOT automatically authorize the first message or send business information. The bot token SHALL remain outside chat, exports and Git.

#### Scenario: Discover the owner's identifiers
- **WHEN** David follows the controlled local discovery procedure using his own Telegram account
- **THEN** he can verify the numeric identifiers before manually enabling the allowlist, and no shop data is read or sent during discovery

### Requirement: Keep bridge secrets in private read-only files
Bot tokens and bridge keys SHALL reside in owner-private regular files outside the repository, mounted read-only for a non-root bridge. Environment settings SHALL contain paths, not secret values. Missing, unsafe, symlinked or wrongly owned files SHALL fail closed without echoing contents. Local setup SHALL use hidden token input and preserve unrelated settings and existing secrets.

#### Scenario: Secure local token entry
- **WHEN** David runs the local interactive setup
- **THEN** the token is not echoed or put in shell history, private files are created/reused outside Git, only paths/UID are stored in ignored `.env` and no service, provider call or message is started

#### Scenario: Invalid mounted secret
- **WHEN** a secret file is absent, symlinked, owned by another UID, exposed to group/others or replaced by a legacy secret environment value
- **THEN** startup refuses before contacting Telegram or n8n and reports only a sanitized code

### Requirement: Support exactly the agreed questions
The system SHALL support weekly collections and currently active reservations due in the current month, plus a fixed help reply. It SHALL reject other periods, customer-specific filters, write requests and ambiguous multi-intent questions without performing a shop read. Equivalent supported Spanish phrasings SHALL resolve to the same closed plan.

#### Scenario: Weekly synonyms
- **WHEN** the authorized owner asks "¿Cuánto se ha recaudado esta semana?", "¿Cuánto hemos cobrado esta semana?" or "Dime la recaudación semanal"
- **THEN** the selected plan is weekly collections

#### Scenario: Monthly deadlines
- **WHEN** the owner asks "¿Qué apartados vencen este mes?"
- **THEN** the selected plan is active reservations due in the current month

#### Scenario: Unsupported or conflicting request
- **WHEN** the owner asks about last month, a named customer, several different questions, exports, payments or changes to records
- **THEN** the fixed help reply explains the two supported questions and no shop read occurs

### Requirement: Constrain model authority and external data
The AI Agent SHALL have only closed read-plan selection tools and SHALL receive only a bounded, prevalidated non-personal query representation. It MUST NOT receive raw Telegram text, identities, credentials, API results, customer fields, amounts or dates. Its output SHALL be treated as untrusted data and cannot directly call the shop or send a message.

#### Scenario: Malicious prompt or personal text
- **WHEN** the input contains instructions to ignore rules, secrets, arbitrary URLs, customer details or unsupported vocabulary
- **THEN** it is rejected before external AI use rather than sending the arbitrary text to the model

#### Scenario: Unexpected tool arguments or output
- **WHEN** the model selects an unknown plan, invents dates/URLs/recipients, adds forbidden fields, omits the required tool use or disagrees with deterministic input validation
- **THEN** the request is held without a shop read or an invented answer

#### Scenario: Malicious text in the app
- **WHEN** a product or customer field contains instructions or markup
- **THEN** it never reaches the model or changes the plan and is rendered only as bounded inert text in an authorized reply

### Requirement: Query the application through a fixed read boundary
The system SHALL query only fixed allowlisted GET endpoints on the configured shop API with Header Auth `X-API-Key`. The model, message and API payload SHALL NOT override method, origin, endpoint or credentials. No assistant path SHALL create or change an Apartado, Abono, Venta or Vale, or access the shop database directly.

#### Scenario: A prompt requests financial writes or another host
- **WHEN** input or model output asks to register a payment, expire a reservation or query an arbitrary address
- **THEN** the request cannot cause any such operation

### Requirement: Use unambiguous Madrid calendar periods
The system SHALL freeze one request time and derive all dates in `Europe/Madrid`. Weekly collections SHALL cover Monday through that local date, inclusive. Monthly deadlines SHALL cover the first through last date of that same local month, inclusive. Neither the model nor the bridge caller SHALL supply custom business dates.

#### Scenario: Monday crosses a month or year boundary
- **WHEN** the local week begins in the preceding month or year
- **THEN** the API interval still starts on the actual Monday and ends on today's Madrid date

#### Scenario: UTC midnight or daylight saving differs
- **WHEN** UTC and Madrid are on different dates or clocks change for daylight saving
- **THEN** classification, queries, overdue labels and reply headers use the same frozen Madrid calendar date

### Requirement: Verify weekly collections using integer cents
The weekly answer SHALL separately show direct sales, layaway payments and their total in Spanish EUR formatting. It SHALL count each initial payment once as an Abono, sum validated amounts in integer cents and reject duplicates, invalid amounts, overflow or records outside the interval. It MUST NOT recalculate individual balances or describe collections as profit.

#### Scenario: Sales and initial payments
- **WHEN** the API returns a EUR 20 direct sale and two Abonos of EUR 5 and EUR 10, the first being initial
- **THEN** the reply shows ventas directas 20,00 €, abonos 15,00 € and total recaudado 35,00 €, with no second count of the initial payment

#### Scenario: Valid empty week
- **WHEN** complete successful API responses contain no sales or payments
- **THEN** the reply explicitly states no movements and shows zero amounts

### Requirement: Display current active reservations due this month
The monthly answer SHALL select only current `activo` records whose API `fecha_limite` falls in the current month. It SHALL show number, customer, product/size, API `pendiente` and deadline, ordered by deadline then numeric ID. Deadlines strictly before today SHALL be labeled overdue, not falsely labeled `vencido`.

#### Scenario: Today, earlier this month and terminal states
- **WHEN** active records are due yesterday, today and later this month, alongside settled/expired records
- **THEN** only the three active records appear, yesterday is marked "Fuera de plazo", today remains within its last valid day and terminal states are excluded

#### Scenario: No qualifying reservations
- **WHEN** a complete valid API response contains no active record due this month
- **THEN** the reply explicitly states that no active reservations have a deadline this month

### Requirement: Fail closed on incomplete or unverifiable source data
The system SHALL verify successful status, complete response shape/counts, unique IDs and required dates/amounts before answering. Required failures or partial reads SHALL produce a fixed unavailability reply rather than zeros, partial financial totals or a silently shortened list. Separate sequential GETs SHALL NOT be claimed as an atomic historical snapshot.

#### Scenario: API failure, malformed data or count mismatch
- **WHEN** a required GET fails, returns invalid data or a total count that differs from the complete body
- **THEN** no business answer is sent and the reply states that the result could not be verified

#### Scenario: Deadline or balance invalid
- **WHEN** a selected active reservation has an invalid deadline or pending amount
- **THEN** the monthly list fails verification instead of omitting that record

### Requirement: Enforce a deterministic pre-send rubric
The system SHALL run code-based checks for authorization, intent/period, complete API data, financial validity and reply consistency before delivery. Final Spanish templates SHALL be rendered outside the AI Agent. Equivalent accepted queries with the same date and API data SHALL produce the same business reply and stable ordering, independent of model wording.

#### Scenario: Model generates a plausible answer
- **WHEN** the model returns its own financial prose or a number
- **THEN** that text cannot be sent as the business answer

#### Scenario: Long or hostile field values
- **WHEN** records contain markup, control characters, links or enough rows to require multiple Telegram messages
- **THEN** the reply uses inert text, disables link previews and deterministic bounded chunks, labels any shortened display field, and never silently drops records

### Requirement: Receive Telegram updates without public exposure
The dedicated bridge SHALL obtain messages through outbound Telegram polling and call only the local authenticated n8n endpoint. It SHALL publish no host port, not expose the shop/editor and not alter another bot's webhook or update stream. Only one bridge process SHALL own its bot's update cursor.

#### Scenario: Existing bot webhook or competing consumer
- **WHEN** the bot has an existing webhook or a second process attempts to consume its updates
- **THEN** startup refuses or fails visibly without deleting the webhook, dropping pending messages or starting a second owner

### Requirement: Bound load, age and replay behavior
The system SHALL limit message length, age, per-owner request rate, model/tool steps, response size and network retries. Duplicate update/message identifiers SHALL NOT automatically produce another reply. Outdated queued messages SHALL NOT trigger old business replies after a restart. No automatic retry SHALL follow an uncertain Telegram send.

#### Scenario: Replay after restart
- **WHEN** a previously handled Telegram update is delivered again after bridge restart
- **THEN** its persistent metadata suppresses another business reply

#### Scenario: Delivery becomes uncertain
- **WHEN** a send times out or the bridge crashes after marking a chunk as being sent
- **THEN** that chunk is held as uncertain, not automatically resent or marked delivered; the operator can inspect sanitized metadata and the owner can submit a new question

#### Scenario: Rate or age limit
- **WHEN** an update is too old, too long or exceeds the configured request rate
- **THEN** expensive calls are blocked and no unsafe backlog replay occurs

### Requirement: Keep operational data and permissions minimal
The bridge SHALL persist only bounded cursor, correlation, rate and delivery metadata, not message bodies, business answers, customer records or credentials. Shop results SHALL NOT leave for an AI provider. Business replies SHALL go only to the fixed owner chat. Automatic unexpected failures SHALL report sanitized information via the configured Error Workflow or documented bridge diagnostics.

#### Scenario: Error contains a URL with a secret or personal payload
- **WHEN** an upstream request fails
- **THEN** shared logs/alerts do not contain the token, authorization header, raw prompt, customer record or full business response

### Requirement: Safe setup and executed verification
Shared exports SHALL be inactive, credential-free and default to external effects disabled. Review readiness SHALL include automated positive/negative/empty/adversarial tests, read-only API comparison, a controlled local editor run and an explicitly authorized real Telegram exchange. Tests not performed SHALL be documented as blockers rather than reported as successful.

#### Scenario: Safe import and manual preview
- **WHEN** the canonical JSON is imported and its manual preview is run with default settings
- **THEN** it does not publish, send Telegram messages, call external AI or write business records

#### Scenario: Real integration acceptance
- **WHEN** David authorizes controlled Telegram tests and confirms replies from his private chat
- **THEN** the evidence records actual content, deterministic totals/list behavior, duplicate and unauthorized behavior, while distinguishing editor tests from CLI or disposable-stack tests
