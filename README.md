# Agentic Skills for AI Coding Agents — Figma automation + multi-agent orchestration

Two families of skills for AI coding assistants (Antigravity, Claude, Codex):

1. **Figma / frontend automation** (skills 1–8) — interface with Figma through the **figma-console MCP server**, enabling the agent to act as a senior UI/UX designer and design system engineer: design-system extraction, component-driven assembly, asset cleaning, and frontend test/standards enforcement.
2. **Multi-agent orchestration** (skill 9, `skill-principal`) — not Figma-related and needs no MCP server. A file-based layer for running several coding agents in parallel on one codebase without them colliding, losing work when a session dies, or being believed when they report "done".

---

## 🚀 Core Skills Included

### 1. 🎨 Create Design System (`create-design-system`)
Automates the extraction and creation of a Figma Design System based on the codebase's tokens or a design reference document (such as `DESIGN.md`).
- **Token Extraction**: Automatically parses colors, typography styles, spacing, and radius tokens from codebase source files (e.g. Tailwind configuration, CSS variables) or specification documents.
- **Figma Alignment**: Dynamically creates Variable Collections (Colors, Spacing, Radius) and Styles in Figma.
- **Component Building**: Automates the construction of foundational component sets with variants aligned with the token naming structure.
- **Strict Token Adherence**: Ensures every color, padding, gap, and size maps directly to a defined token.

### 2. ⚡ Designing Hi-Fi Screens Against a Real System (`designing-hifi-screens`)
For producing hi-fi screens for a product that **already exists** — the output must be indistinguishable in construction from what the product already ships, not merely similar in colour. Works in both Figma (via figma-console MCP) and Pencil.
- **Consistency is a grammar problem, not a vocabulary problem**: correct hex values are the vocabulary level, necessary and nowhere near sufficient. What a reviewer calls "inconsistent" lives in the type scale, the spacing scale, the radius scale, the shell the screen sits in, and whether repeated UI is reused or redrawn by hand. A design can score 100% on colour and still be rejected — that exact outcome is the baseline failure this skill exists to prevent.
- **The Iron Law — never hand-transcribe the design system**: every token value, component name, and scale step must be extracted mechanically from the truth source during the session, with the extraction output pasted in as evidence. A hand-typed token table is a lossy copy; the gaps get filled with framework defaults that look plausible and are wrong.
- **Truth Source Gate**: asks where the truth actually lives before drawing anything, instead of assuming.
- **Reuse before creating**: searches existing local/library components first; creates a master only when the pattern genuinely does not exist. Keeps Auto Layout meaningful for Dev Mode handoff.
- **Conformance audit gates the handoff**: the bundled `conformance-audit.py` counts violations per axis (type, spacing, radius, font family, raw colour, token binding, reuse) against an allowlist extracted this session, and exits non-zero when any axis fails — so "looks right" is replaced by a number before anything is called done.

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
A file-based orchestration layer for running **several AI coding agents in parallel** (Claude / Codex / Gemini) on one codebase — ~2,100 lines, zero runtime dependencies. Not Figma-related and needs no MCP server; this one is about how work is routed, verified, and merged — and about **not trusting the agents' own "done" reports**.

**Two skills**: `/dispatch` (route → gate → execute → verify → merge) and `/model-audit` (keep the agent capability profile from silently going stale). **Six roles** in `agents/`, four with no write tools at all. **17 principles**, each traceable to a failure that actually happened.
- **Router pattern for rules**: a 64-line always-loaded index (`.agent-rules`) holds only the routing table and invariants; detailed rules load on demand from `.agent-rules.d/`. Loading every rule in every session burns the context budget before any work starts.
- **Rules must physically reach the executor**: rule files are gitignored, so `git worktree add` never copies them — an agent working in a worktree is blind to every project convention while still reporting "done" with a green build. The dispatch flow copies rules into the worktree and names them in the prompt.
- **Capability-based executor routing**: complexity decides whether a plan + approval gate is needed; capability decides *who* executes. Two hard gates — one that excludes an executor from shared-layer/ambiguous-spec work, one that forces an independent second-agent review for money, permissions, migrations, and production.
- **Spec is input, not a record**: the spec must exist *before* dispatch because it *is* the prompt. Writing documentation retroactively "for the record" is explicitly banned; a task tier gate keeps sub-2h work out of the ceremony entirely.
- **One party merges**: sub-agents only write code and a `_DONE.md` handoff file — never commit, push, merge, or open PRs. The orchestrator re-runs the build, reads the diff, and checks scope before merging. Agent reports are data to verify, not conclusions.
- **Crash recovery**: a Dispatch log (branch + absolute worktree path + next step) is updated at every milestone, because an agent session can die at any moment and the next session has none of the conversation.
- **A claim must be falsifiable**: every field in a `_DONE.md` handoff is machine output pasted verbatim, never an adjective. Same task, same model, two rounds — the round that asked "is the build green?" got prose and six invented field names; the round that demanded *the typecheck error count plus the repo's baseline* got numbers that re-ran correctly. Fabrication is what a protocol gets when success criteria cannot be proven false, not a quirk of one model (two vendors' agents did it identically).
- **Verify the evidence, not just the code**: hash every screenshot (two byte-identical files claimed for two different acceptance criteria is fabricated evidence), and reject a PASS whose evidence column says "static code review" for a behavioural criterion — that is an executor silently downgrading its verification channel while keeping the verdict.
- **Roles enforced by tool allowlists, not by instructions**: six role definitions in `agents/`, four of which have no write tools at all, so a verifier physically cannot patch code green. A prompt that forbade editing source in writing was overridden anyway — 7 files changed to turn 32/32 criteria into PASS. Missing tools are not overridable.
- **Work state lives in the repo, not in the conversation**: `.agent-tasks/<id>.md` records branch, worktree, executor, and remaining to-dos at every state change, and a handoff is mandatory whenever a turn ends with work unfinished. The orchestrator is planner, verifier and committer at once — a single point of failure. Run out of quota mid-task and nobody can pick it up: opening the repo shows no trace of what was running.
- **File-level fencing is not enough — fence shared *runtime* resources too**: two streams touched no common file, `git merge` was perfectly clean, types checked — and both wrote the same cache key with two different shapes, so one feature died silently. Semantic conflicts between two *different* files produce no conflict markers. Splitting work into parallel streams is therefore gated on a shared-resource table agreed up front, with one owning file per resource, and strictly sequential merges.
- **No default path skips the verifier**: every diff from every executor goes through the verify role. The single exemption (small, self-contained changes) only holds if it survives a four-question re-check run **on the real diff** — small tasks routinely grow, so a decision made when routing must be revisited once the code exists.
- **Whoever is being criticised does not hold the pen**: a dedicated reporter role writes the final report and relays executor feedback about the rules verbatim into a shared inbox — including feedback the orchestrator disagrees with, which is filed as `rejected` rather than dropped. Most of those rules were written by the orchestrator itself.
- **The capability profile has an expiry date**: model line-ups get repositioned within weeks, and a stale comparison table reads exactly like a correct one. A machine-readable `last-verified` stamp is checked on every dispatch, and `/model-audit` refreshes it from three sources that cannot substitute for each other — the actual local harness, the vendor docs, and your own dispatch history. Recorded failure modes of the specific executor being dispatched are then translated into hard constraints inside its prompt: a profile you read but never inject is a profile you did not read.
- Ships with two runnable gates: `scripts/scrub-check.sh` (denylist for keeping internal identifiers out of a public repo) and `scripts/check-agents.mjs` (fails if a verify/review role ever gains a write tool, or if the reporter role gains the ability to edit existing files).
- **Portable across projects**: a repo-profile step detects whether your project keeps specs in an external docs vault, inside the repo, or nowhere at all — and treats "nowhere" as a valid configuration rather than an error, falling back to issue/PR bodies for tracking.

### 10. 🧪 E2E Setup — Browser Evidence for Any Coding Agent (`e2e-setup`)
Gives a coding agent the ability to run a real headless browser and prove it with a real screenshot, in any workspace — a fresh git worktree, a bare folder, a repo whose test scripts are gitignored. Solves a real failure mode: an agent asked for evidence screenshots reports "I'm a text-based AI, I can't run a browser" and returns 0 PNGs, while a different agent on the *same machine* runs Playwright headless without issue — the capability was always there, nobody handed it over with explicit permission.
- **Discovery ladder, not a guess**: probes host / workspace / target, then climbs a 6-rung ladder (the workspace's own capture script → its `node_modules` → the **main repo's** `node_modules` via absolute path — the rung that saves a fresh worktree from a false "blocked" → machine browser cache → installed Chrome/Edge → an MCP browser server if the host has one) and stops at the first rung that works.
- **Proof-gated verdict**: `READY` only when a real smoke test exits 0 *and* a PNG exists on disk with a byte size just re-read from disk in the same run — never trust a stale number or a "looks fine" claim.
- **A separate flow gate for real user journeys** (`flow.mjs`): a smoke test only proves "the browser opened", not "the agent clicked through a real flow". Three constraints are enforced by the engine, not just documented — only real interaction verbs (no state injection), every screenshot needs a proof step since the last one, and a flow needs at least one interaction or it's rejected as a smoke test in disguise. A flow that fails still keeps its screenshots (for debugging) but quarantines them into a `REJECTED/` folder so nobody pastes a failed run into an issue as if it passed.
- **`publish.mjs` — zip evidence to a GitHub Release, no new accounts**: packages a folder of screenshots into a `.zip` and uploads it as a Release asset via the `gh` CLI you're already logged into — chosen over Google Drive/Sheets specifically because those need you to complete an OAuth consent flow in a browser first, which an agent can't do on your behalf. Four small, real bugs got caught and fixed by testing the failure paths, not just the success path: the target repo must be passed explicitly rather than auto-detected from the evidence folder's own git remote (that folder is often a notes vault with a *different* remote — auto-detecting risked silently publishing to the wrong repo); the default release tag rotates by ISO week instead of growing one release forever; non-evidence file extensions are excluded and reported rather than silently dropped, and any filename that looks secret-like (`.env`, `token`, `credential`, `password`...) hard-fails the whole run instead of quietly vanishing; and nothing is ever written into the evidence folder itself — a temp directory holds the zip and any auto-generated manifest, cleaned up after upload.
- **Written for the "one coding agent is the operator" case**: every script prints one summary line before its JSON so an agent can relay it without parsing, config (storage platform, default environment) is fixed up front instead of asked every run, and every failure message carries the exact next command instead of a bare stack trace.

---

## 🛠️ How to Use

### Prerequisites

**For the Figma skills (1–8):**
1. Ensure the **figma-console MCP server** is running and configured in your MCP configuration.
2. The AI assistant must have access to the `figma-console` tools (`figma_create_child`, `figma_get_variables`, `figma_set_fills`, etc.).

**For `skill-principal` (9) and `e2e-setup` (10):** none of the above. Both are plain markdown plus a handful of scripts, and work with any agent that reads skill files or runs Bash. For `skill-principal`, run `/model-audit` once after copying it in — the capability profile ships with the dates *its author* last verified, not the day you downloaded it. For `e2e-setup`, run its probe (`bin/e2e-probe.mjs`) once against your repo to confirm it finds a browser + runner before relying on it.

### Installation for Gemini/Claude Agents
Copy the desired plugin folder(s) directly into your agent's config or project plugins directory:

```bash
# Copy into the user global config plugins directory:
C:\Users\<YourUsername>\.gemini\config\plugins\

# Or copy into your project-specific agents directory:
<your-project-root>\.agents\skills\
```

Each directory contains a `plugin.json` which lists the available commands/skills, and a `skills/SKILL.md` instruction sheet that the agent reads before performing tasks.

