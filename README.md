# Figma Agentic Skills for AI Agent (Connected to figma-console-mcp)

A collection of advanced UI/UX automation skills for AI coding assistants (like Antigravity or Claude) that interface with Figma through the **figma-console MCP server**. 

These skills enable the AI agent to act as a senior UI/UX designer and design system engineer to automate Figma asset creation, component-driven assembly, and graphic asset cleaning.

---

## 🚀 Core Skills Included

### 1. 🎨 Create Design System (`create-design-system`)
Automates the extraction and creation of a Figma Design System based on the codebase's tokens or a design reference document (such as `DESIGN.md`).
- **Token Extraction**: Automatically parses colors, typography styles, spacing, and radius tokens from codebase source files (e.g. Tailwind configuration, CSS variables) or specification documents.
- **Figma Alignment**: Dynamically creates Variable Collections (Colors, Spacing, Radius) and Styles in Figma.
- **Component Building**: Automates the construction of foundational component sets with variants aligned with the token naming structure.
- **Strict Token Adherence**: Ensures every color, padding, gap, and size maps directly to a defined token.

### 2. ⚡ Generate Figma Kit (`generate-figma-kit`)
Audits and synchronizes Figma product flows so they are ready for Dev Mode and agentic design-to-code through figma-console MCP.
- **Design-System Synchronization**: Searches existing local/library components first, then applies shared instances across repeated flow screens.
- **Missing Master Components**: Creates flow-specific master components when a reusable pattern is missing, such as headers, hero sections, tabs, rows, filter bars, empty states, and bottom sheets.
- **Dev Mode Auto Layout**: Converts repeated UI into meaningful Auto Layout hierarchy where the root component is the real container and text lives inside its chip/card/row.
- **Instance Application**: Replaces duplicated manual layers with component instances while preserving text overrides through component properties.
- **Regression QA**: Screenshots changed masters and target flows, checking clipping, incorrect wrapping, overlay labels, variant bounds, and component-instance consistency.

### 3. 🖼️ Remove Background Graphic (`remove-background-graphic`)
Streamlines the creation and editing of graphical assets and illustrations inside Figma.
- **Illustrative Graphics Generation**: Assists in designing and positioning mockups and icons.
- **Background Removal**: Integrates steps to clean up graphics, ensuring transparency and clean layer boundaries.

### 4. 🧪 Feature-Focused Tester (`feature-focused-tester`)
Plans, writes, and executes tests targeted at a modified feature through a **3-layer flow that mirrors the data boundary** — do not skip the middle layer.
- **Change Detection**: Analyzes git diffs to detect what source files changed and maps each to its owning layer + suggested test file.
- **Layer 1 — Test UI**: Vitest + Testing Library render assertions (default/empty/loading/error/props) plus browser-MCP screenshots for desktop/mobile responsive proof.
- **Layer 2 — Test call API (data boundary)**: tests the data layer (`data hooks -> repositories -> adapters`) — query keys, **mutation cache invalidation**, normalized object shapes, and storage-vs-api transport.
- **Layer 3 — Test flow (E2E)**: targeted end-to-end user-flow verification (login -> seed -> navigate -> act -> side-effects) via the project E2E runner and the browser MCP.
- **Reporting**: produces `test_plan.md` (cases by layer + P0–P3 priority with a Definition-of-Done gate) and `walkthrough.md`, and routes QA results to Telegram Thread <qa-thread-id>. (Design-token compliance is delegated to the `frontend-code-standards` plugin.)

### 5. 🛡️ Frontend Code Standards (`frontend-code-standards`)
Enforces strict coding standards, the data boundary, security controls, and design-to-dev synchronization for a React 18 + Vite (JS/JSX) app.
- **Data Boundary (most enforced)**: Domain data must flow `components -> data hooks -> repositories -> adapters`; no direct `storage.*` / `localStorage.*` / `JSON.parse` of domain keys in components, query keys come from `src/data/queryKeys.js`, and every mutation invalidates its query cache.
- **Atomic Design Alignment**: Standardizes components into Atoms, Molecules, Organisms, Templates, and Pages for seamless sync between Figma design files and Dev files.
- **DRY & Component Reusability**: Mandates that any UI element used on 2 or more pages must be extracted to a shared directory (`src/components/ui/` or `src/components/common/`) to avoid inline duplicate styling.
- **Client-Side Security**: Checks for XSS vulnerabilities (enforcing sanitization before `dangerouslySetInnerHTML`), hardcoded secrets (requiring `import.meta.env.VITE_*`), and console-log audits (runtime logging via `src/utils/logger.js`).
- **Architectural Constraints**: Restricts component files to under 500 lines of code, documents props with JSDoc, limits prop drilling to 3 layers, and separates server state (TanStack Query) from client UI state (React local state + Context — **no Zustand/Redux**).

### 6. 📱 Telegram Commander (`telegram-commander`)
Bypass built-in Sandbox/IDE Terminal permission UIs by routing command approvals through Telegram. **Universal skill compatible with Antigravity, Claude, Cursor, and CodeX.**
- **Telegram Inline Keyboards**: Sends an interactive card to your Telegram thread with Allow/Decline buttons whenever a terminal command needs execution.
- **Universal Sandbox Bypass**: Prevents Antigravity UI, Cursor Terminal, or Claude's bash tool from blocking execution flows. Once the proxy script is whitelisted in your IDE, you can approve or decline tasks directly from your phone.
- **Background Task Compatibility**: Wraps `child_process.spawn` to preserve live-streaming of stdio to the agent's task log so the AI retains full observability.
- **Agent Independence**: The core `run.cjs` script is pure Node.js and relies on OS-level process blocking, meaning it halts execution for *any* AI assistant until Telegram approval is received.

### 7. 🧩 Figma Pattern Advisor (`figma-pattern-advisor`)
A full-fledged Figma plugin designed to audit, recommend, and insert strictly compliant Design System patterns directly inside Figma.
- **Context-Aware Audits**: Automatically analyzes the user's selected design layers and compares their text, naming, and anatomy against predefined Enterprise Patterns (Atoms, Molecules, Organisms).
- **LLM-Powered Matching**: Uses a local or cloud LLM (Gemini, Claude, OpenAI) to semantically match raw UI selections to the correct canonical design system component.
- **One-Click Insert & Perfecting**: Allows designers to instantly replace non-compliant "mock" layers with the pixel-perfect, interactive React-ready Design System component, placed perfectly alongside the original.
- **Web Demo Included**: Comes with a standalone React Web Demo that simulates the Figma canvas environment (with native scrollbars and node dragging) to let you test the plugin's UI and audit logic outside of Figma.

### 8. 🔌 Figma Desktop Bridge — Multi-Port (`figma-desktop-bridge-multiport`)
Enhanced fork of the [figma-console-mcp](https://github.com/southleft/figma-console-mcp) Desktop Bridge plugin with **multi-port selection** support. Solves the limitation where 2 Figma files cannot each connect to a separate MCP server instance.
- **Port Selector UI**: When multiple MCP servers are detected on ports 9223–9232, displays a radio-button selector showing each server's label, version, uptime, and connected files — instead of auto-connecting to all.
- **Per-File Port Preference**: The user's chosen port is persisted via Figma `clientStorage` per-file, so the plugin auto-reconnects to the same server on reload.
- **Server Labels**: Configurable via `FIGMA_SERVER_LABEL` env var (e.g., `"Cursor"`, `"Claude Code"`) — shown in the selector for easy identification.
- **Backward Compatible**: When only 1 server is found, auto-connects silently (zero-click, identical to original behavior).
- **Enhanced `/health` Endpoint**: Server-side change adds `serverLabel`, `connectedFiles`, and `port` fields to the health JSON response.

### 9. 🎛️ Skill Principal — Multi-Agent Orchestration Rules (`skill-principal`)
A file-based orchestration layer for running **three AI coding agents in parallel** (Claude / Codex / Gemini) on one codebase — 1615 lines, zero runtime dependencies. Not Figma-related; this one is about how work is routed, verified, and merged — and about **not trusting the agents' own "done" reports**.
- **Router pattern for rules**: a 64-line always-loaded index (`.agent-rules`) holds only the routing table and invariants; detailed rules load on demand from `.agent-rules.d/`. Loading every rule in every session burns the context budget before any work starts.
- **Rules must physically reach the executor**: rule files are gitignored, so `git worktree add` never copies them — an agent working in a worktree is blind to every project convention while still reporting "done" with a green build. The dispatch flow copies rules into the worktree and names them in the prompt.
- **Capability-based executor routing**: complexity decides whether a plan + approval gate is needed; capability decides *who* executes. Two hard gates — one that excludes an executor from shared-layer/ambiguous-spec work, one that forces an independent second-agent review for money, permissions, migrations, and production.
- **Spec is input, not a record**: the spec must exist *before* dispatch because it *is* the prompt. Writing documentation retroactively "for the record" is explicitly banned; a task tier gate keeps sub-2h work out of the ceremony entirely.
- **One party merges**: sub-agents only write code and a `_DONE.md` handoff file — never commit, push, merge, or open PRs. The orchestrator re-runs the build, reads the diff, and checks scope before merging. Agent reports are data to verify, not conclusions.
- **Crash recovery**: a Dispatch log (branch + absolute worktree path + next step) is updated at every milestone, because an agent session can die at any moment and the next session has none of the conversation.
- **A claim must be falsifiable**: every field in a `_DONE.md` handoff is machine output pasted verbatim, never an adjective. Same task, same model, two rounds — the round that asked "is the build green?" got prose and six invented field names; the round that demanded *the typecheck error count plus the repo's baseline* got numbers that re-ran correctly. Fabrication is what a protocol gets when success criteria cannot be proven false, not a quirk of one model (two vendors' agents did it identically).
- **Verify the evidence, not just the code**: hash every screenshot (two byte-identical files claimed for two different acceptance criteria is fabricated evidence), and reject a PASS whose evidence column says "static code review" for a behavioural criterion — that is an executor silently downgrading its verification channel while keeping the verdict.
- **Roles enforced by tool allowlists, not by instructions**: five role definitions in `agents/`, four of which have no write tools at all, so a verifier physically cannot patch code green. A prompt that forbade editing source in writing was overridden anyway — 7 files changed to turn 32/32 criteria into PASS. Missing tools are not overridable.
- Ships with two runnable gates: `scripts/scrub-check.sh` (denylist for keeping internal identifiers out of a public repo) and `scripts/check-agents.mjs` (fails if a verify/review role ever gains a write tool).

---

## 🛠️ How to Use

### Prerequisites
1. Ensure the **figma-console MCP server** is running and configured in your MCP configuration.
2. The AI assistant must have access to the `figma-console` tools (`figma_create_child`, `figma_get_variables`, `figma_set_fills`, etc.).

### Installation for Gemini/Claude Agents
Copy the desired plugin folder(s) directly into your agent's config or project plugins directory:

```bash
# Copy into the user global config plugins directory:
C:\Users\<YourUsername>\.gemini\config\plugins\

# Or copy into your project-specific agents directory:
<your-project-root>\.agents\skills\
```

Each directory contains a `plugin.json` which lists the available commands/skills, and a `skills/SKILL.md` instruction sheet that the agent reads before performing tasks.

