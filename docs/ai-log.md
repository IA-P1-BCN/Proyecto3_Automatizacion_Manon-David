# AI Assistance Log

## 2026-10-22 — Agent instructions

- **Scope:** Create the root `AGENTS.md` from the assignment, application guide, and the team's decisions. No GitHub issue number was provided for this documentation task; the issue link remains pending.
- **Tool/model:** OpenCode with `openai/gpt-6.1-sol` for this session. Groq is the agreed provider inside future workflows; no Groq model has been selected or tested here.
- **Key requests:** Read and understand the project; ask questions before defining agent instructions; use one branch per issue from `dev`; write technical documentation and branch names in English, and customer/business messages in Spanish for Spain.
- **Accepted decisions:** Essential level first, followed by medium; independent local environments; Gmail, Google Sheets, and Groq; version workflow JSON in Git; manual import/export as the baseline with n8n-mcp assistance when configured.
- **Corrected agent error:** The agent interpreted autonomy as permission for commits, push, and PR creation. The user clarified that autonomy covers branches and n8n JSON, while each of those Git operations requires explicit permission. `AGENTS.md` records the corrected boundary.
- **Rejected proposal:** A shared n8n environment was discussed but declined. Each agent must target its teammate's local instance.
- **Pending decisions/setup:** Commit and PR language, whether both teammates use OpenCode, separate test mailboxes/Sheets per teammate, Gmail account creation, OAuth setup, Groq model selection, and n8n-mcp connection.
- **Implementation:** Created local `dev` from the existing `main`, then `docs/agents-guidelines` from `dev`; added `AGENTS.md` and this log. No commit, push, PR, account creation, or workflow activation was performed.
- **Verification scope:** Documentation and Git topology checks only; no application or workflow integration tests are claimed for this task.

## 2026-10-22 — Issue traceability and dev-merge automation

- **Issue metadata:** Queried GitHub and identified #17 — Crear Agents.md, assigned to `davidlafuentem`. The initial entry above describes the information available before that lookup. #18 — Crear Bitacora is a separate assigned task, not completed by this activity entry.
- **Key request:** Use actual issue numbers, names, and assignments, and automate closure and the Done transition after merging reviewed PRs into `dev`. The team supplied Project #43 and authorized implementation, but not commit, push, or PR creation.
- **Implementation:** Renamed the local documentation branch to `docs/17-agent-guidelines`, added traceability rules to `AGENTS.md`, and prepared a GitHub Actions workflow with a separately testable closing script and setup guide.
- **Decision:** Close issues using explicit completion lines in merged PR descriptions, then let the native Project `Item closed` rule set Done. Do not introduce a project-access secret into Actions.
- **Access blocker:** `gh auth refresh --hostname github.com --scopes read:project` reached browser authorization but timed out. The token still lacks `read:project`. Project fields and native workflows have not been inspected or changed.
- **Verification scope:** Local mocked script tests and syntax/configuration checks; remote issue closure and Project status changes require installation and an authorized real merge. No remote completion is claimed.
- **Local results:** Seven Node.js tests passed, the closing script passed its syntax check, Ruby parsed the workflow YAML, and whitespace checks passed for all six changed/new files. `actionlint` was not available; YAML parsing is not full GitHub Actions validation.

## 2026-10-22 — Authorization and branch publication preparation

- **Resolved access blocker:** The user completed GitHub browser authorization. The agent verified `read:project` access to Project #43 and the Status options `Todo`, `In Progress`, `In Review`, and `Done`. The native workflow settings themselves remain unverified through the available API.
- **Permission:** The user authorized the proposed English commit and publishing `dev` and `docs/17-agent-guidelines`. PR creation and merging remain outside that authorization.
- **Scope:** Publish the existing issue #17 branch and its supporting automation. The earlier entries record historical permissions and blockers, not the current authorization state.
