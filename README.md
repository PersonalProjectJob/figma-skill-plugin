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
Assembles and synchronizes pixel-perfect, highly responsive user interfaces directly in Figma.
- **Component-Driven Assembly**: Instantiates buttons, input fields, modals, and other complex widgets from the project's local component library instead of drawing raw shapes.
- **Token Synchronization**: Binds all properties (fills, strokes, text styles, padding, and border radius) to existing Figma variables and styles to prevent hardcoding.
- **Strict Auto Layout**: Configures correct parent Auto Layout rules, alignments, gap variables, and constraints (`Fill Container` / `Hug Contents`).
- **Robust Sizing & Wrapping**: Resolves layout clipping and configures text layer wrapping dynamically.

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
- **Reporting**: produces `test_plan.md` (cases by layer + P0–P3 priority with a Definition-of-Done gate) and `walkthrough.md`, and routes QA results to Telegram Thread 735. (Design-token compliance is delegated to the `frontend-code-standards` plugin.)

### 5. 🛡️ Frontend Code Standards (`frontend-code-standards`)
Enforces strict coding standards, the data boundary, security controls, and design-to-dev synchronization for a React 18 + Vite (JS/JSX) app.
- **Data Boundary (most enforced)**: Domain data must flow `components -> data hooks -> repositories -> adapters`; no direct `storage.*` / `localStorage.*` / `JSON.parse` of domain keys in components, query keys come from `src/data/queryKeys.js`, and every mutation invalidates its query cache.
- **Atomic Design Alignment**: Standardizes components into Atoms, Molecules, Organisms, Templates, and Pages for seamless sync between Figma design files and Dev files.
- **DRY & Component Reusability**: Mandates that any UI element used on 2 or more pages must be extracted to a shared directory (`src/components/ui/` or `src/components/common/`) to avoid inline duplicate styling.
- **Client-Side Security**: Checks for XSS vulnerabilities (enforcing sanitization before `dangerouslySetInnerHTML`), hardcoded secrets (requiring `import.meta.env.VITE_*`), and console-log audits (runtime logging via `src/utils/logger.js`).
- **Architectural Constraints**: Restricts component files to under 500 lines of code, documents props with JSDoc, limits prop drilling to 3 layers, and separates server state (TanStack Query) from client UI state (React local state + Context — **no Zustand/Redux**).

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

