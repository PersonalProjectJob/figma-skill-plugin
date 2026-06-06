---
name: frontend-code-standards
description: Ensure high-quality FE coding for this React 18 + Vite (JS/JSX, not TypeScript) dashboard by enforcing the data boundary (components -> data hooks -> repositories -> adapters), JSDoc prop documentation, security controls, architectural guidelines (component size limits, state separation), and compliance with project design tokens.
---

# Frontend Code Standards & Quality Guard Skill

This skill enforces strict standards for React and JavaScript (JS/JSX, not TypeScript) code in this codebase, covering the data boundary, static analysis, security safeguards, and architectural best practices.

**Repo profile (do not contradict):** React 18 + Vite, JS/JSX. Package manager = **pnpm** (build = `pnpm build`). Server state = `@tanstack/react-query` v5. Client/UI state = React local state + React Context (e.g. `src/auth/AuthProvider.jsx`). **No Zustand, no Redux, no TypeScript.** No path aliases in app code — imports use relative / `src/...` paths (there is no `@/` in `vite.config.js`; the `@` alias exists only in `vitest.config.js` for tests). Icons from `lucide-react`. Central logger at `src/utils/logger.js`.

## Why this skill exists

To ensure the Front-End codebase remains clean, secure, scalable, and visually consistent:
1. **Data Boundary Integrity**: Keeps domain data flowing through hooks -> repositories -> adapters so transport (storage today, API later) can switch without touching components.
2. **Prop Clarity (JSDoc)**: Ensures components have clear, documented contracts and correct imports, reducing runtime errors.
3. **Security & Best Practices**: Eliminates client-side vulnerabilities like XSS, hardcoded secrets, and unvalidated form submissions.
4. **Architectural Cleanliness**: Enforces strict component size limits, separates server state from UI state, and prevents prop drilling.
5. **Design Integrity**: Standardizes layout responsive design, safe zone scaling, and component reusability.

---

## Core Guidelines & Workflow

### 0. Data Boundary (MOST ENFORCED RULE)
Domain data (merchant, staff, customer, registration, notification, review, transaction, profile, auth) **MUST** flow through one direction:

```
components -> data hooks (src/data/hooks) -> repositories (src/data/repositories) -> adapters (src/data/adapters)
```

- **Components** render UI and call hooks. They must NOT parse storage or know transport details.
- **FORBIDDEN in components, contexts, and feature hooks**: direct `storage.*`, `localStorage.*`, or manual `JSON.parse` for persisted domain keys. Go through the repository/hook layer instead.
- **Data hooks** (`src/data/hooks/`) own TanStack Query integration: query keys come from `src/data/queryKeys.js` (never inline string keys), and every mutation MUST invalidate or update the relevant query cache.
- **Repositories** (`src/data/repositories/`) own domain operations and object-shape normalization. No React code (no hooks, no JSX) inside repositories. They are factories: `createXRepository(adapter, client)`.
- **Adapters** (`src/data/adapters/`) own transport. Storage today, API later — selected by `VITE_DATA_SOURCE` (`storage` | `api`) plus `VITE_API_BASE_URL`. **Component and hook APIs must stay stable across the switch**; transport-specific behavior lives only in adapters / the HTTP client (`src/lib/httpClient.js`).
- Preserve stored object shapes and identifier formats when changing a flow.

**Auth boundary (same principle):**
- UI reads auth via `src/auth/useAuth.js` only.
- Session lifecycle lives in `src/auth/AuthProvider.jsx`.
- Adapter-specific auth behavior lives in `src/auth/adapters/`.
- Do NOT import mock auth/session helpers directly into components.

### 1. Static Validation & Clean Imports (LSP & Module Health)
When editing or creating React components:
- **Prop Documentation (JSDoc-first)**: This repo is JS/JSX — there are no TypeScript interfaces. Document component props with a JSDoc block (`@param` / `@typedef`) above the component, describing each prop's name, type, and whether it is required. Keep it pragmatic: document the public contract, not every trivial internal value.
  ```jsx
  /**
   * @param {object} props
   * @param {string} props.merchantId - Domain identifier for the merchant.
   * @param {() => void} [props.onClose] - Optional close handler.
   */
  function MerchantPanel({ merchantId, onClose }) { /* ... */ }
  ```
- **Import Ordering**: App code declares **no path aliases** in `vite.config.js` (there is no `@/`). Use relative / `src/...` paths. Maintain a clean, consistent import hierarchy:
  1. React core and hooks.
  2. Third-party libraries (`@tanstack/react-query`, `lucide-react`).
  3. Internal modules by real folder, e.g. `src/data/hooks`, `src/data/repositories`, `src/data/adapters`, `src/auth`, `src/lib`, `src/components`, `src/utils`.
  4. Relative imports (`./`, `../`).
  5. Style imports.
- **Direct Imports**: Prefer importing specific exports directly rather than using large barrel files to prevent bundle bloating.
- **Build Verification**: Before completing any change, run the project's build command (`pnpm build`) to verify the code compiles without bundler warnings or errors.

### 2. Security Guard & Best Practices
Always check the front-end code for the following security and logger standards:
- **No Unsafe HTML Rendering (XSS Prevention)**: Never use `dangerouslySetInnerHTML` directly without sanitizing. If rendering HTML is unavoidable, wrap the input using a sanitization function (e.g., DOMPurify or custom sanitizer).
- **No Hardcoded Secrets**: Scan files to ensure API keys, private URLs, or credentials are NOT hardcoded. They must be fetched from environment variables via `import.meta.env.VITE_*` (Vite) or `process.env.*` (Node/Next).
- **Form Input Validation**: Validate all inputs at the boundary using clean patterns (e.g., regex patterns, standard validators, or zod schemas if available) to prevent invalid payloads.
- **Console Log Audit**: **No `console.*` in app code** (CLAUDE.md rule). Use the central logger at `src/utils/logger.js` for any runtime logging, and clean up temporary logs before committing.

### 3. Architecture & Style Standards
Ensure components align with the project design architecture and reusable patterns:
- **Atomic Design Principles (Design & Dev Sync)**:
  * **Atoms (Nguyên tử)**: The most basic, indivisible UI blocks (e.g., primary buttons, input fields, select boxes, labels, badges). Atoms do not contain other components and are highly reusable.
  * **Molecules (Phân tử)**: Combinations of two or more atoms (e.g., a search bar with an input and a button atom, or a form group combining a label, input, and validation error).
  * **Organisms (Sinh vật)**: Complex components composed of molecules and/or atoms (e.g., a Navigation Sidebar, a Dashboard Header, a specific Data Table, or a Card grid). They form distinct sections of the UI.
  * **Templates (Bản mẫu)**: Page-level skeleton structures or layouts determining where elements are placed.
  * **Pages (Trang)**: Routed components injecting real data and state into templates.
- **Strict Component Reusability & DRY Enforcements**:
  * **Zero Duplication**: Never copy and paste UI styling or structure across multiple pages. If a component (like a custom select, button style, modal dialog, or table row) is used on more than one page, it **must** be extracted into a shared folder (e.g., `/src/components/ui/`, `/src/components/common/`, or `/components/shared/`).
  * **Global Prop Propagation**: Creating a single source of truth for UI components ensures that when design updates occur, adjusting the shared component updates all views instantly.
- **Component Structure & Guidelines**:
  * **File naming**: PascalCase for components and pages, camelCase for hooks/utils/services.
  * **Size limits**: Keep components under **500 lines of code**. If exceeded, extract logical parts into reusable sub-components in the same feature folder.
  * **No Prop Drilling**: Maximum 3 layers of prop passing. Lift state to Context Provider or a state store if it exceeds this.
  * **State Separation**: Use **TanStack Query** for server/domain state (via the data hooks layer — see section 0). Use **React local state (`useState`/`useReducer`) and React Context** for client/UI state. **Do NOT introduce Zustand or Redux** (not in this stack), and never duplicate server data into a local/Context store — read it from the Query cache through hooks.
- **Design Tokens Adherence**:
  * Locate the project's design token definitions (e.g., a `DESIGN.md` file, Tailwind config, CSS variables sheet, or theme JSON).
  * All spacing, typography, colors, and border-radii must follow the project's defined tokens.
  * **No Arbitrary Styling**: Do NOT use hardcoded hex colors or arbitrary values (e.g. `p-[17px]` or `rounded-[9px]`); instead, map them to the project's spacing scale and border-radius scales.
- **Mobile-First & Apple Responsive Standards (Apple HIG & Safe Zone Rules)**:
  * **Scope**: This is a desktop-leaning merchant/staff/customer dashboard. The rules below apply to the **mobile / responsive views** of the dashboard — they are not mandatory for desktop-only panels. Apply touch-target, safe-area, and input-zoom rules when a surface is reachable on mobile/tablet breakpoints.
  * *Mobile-First Styling*: Write base CSS/Tailwind classes for mobile layout first (e.g., full width `w-full`, vertical stacks `flex-col`). Use responsive media queries (e.g. `md:flex-row`, `lg:w-1/2` in Tailwind) to build up complexity for desktop screens. Do NOT write desktop-first styles overridden by `max-width` queries.
  * *Viewport Configuration*: Ensure the HTML viewport meta tag in `index.html` includes `viewport-fit=cover` (e.g. `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`). Without `viewport-fit=cover`, Apple devices will letterbox the content and CSS safe-area environment variables (`env(safe-area-inset-*)`) will resolve to `0`.
  * *Safe Zone Insets (Safe Area)*: Interactive controls, navigation, and vital text must never overlap Apple's device safe areas (notch/sensor housing, Dynamic Island, or the bottom home indicator pill). Use:
    * `env(safe-area-inset-top)` for fixed headers, banners, or status bars.
    * `env(safe-area-inset-bottom)` for bottom navbars, floating action buttons, and fixed footers.
    * `env(safe-area-inset-left)` and `env(safe-area-inset-right)` to handle iPhone landscape layouts, iPad multitasking splits, or side menus.
  * *Background Bleeding vs Content Insets*: Background fills, graphics, and overlay containers must extend (bleed) to the physical edges of the display (filling the safe area). However, the actual text, icons, and buttons must be padded inward using safe area variables (e.g., `pb-[env(safe-area-inset-bottom)]`, `pt-[env(safe-area-inset-top)]`).
  * *Touch Target Targets*: Ensure all buttons, links, toggles, and form controls have a minimum touch target size of **44x44px** (following Apple's Human Interface Guidelines) to guarantee comfortable touch input on mobile.
  * *Input Zoom Prevention*: Form text inputs and selects must have a font size of at least `16px` (or equivalent body text style) to prevent iOS Safari from automatically zooming into the field upon focus, which breaks layout scaling.

### 4. Self-Criticism & Code Review Workflow
The AI Agent must perform an active self-review and self-critique phase before applying changes or declaring completion:
- **Design & Logic Simplification**:
  * *Simplicity (KISS)*: Can this logic be written simpler? Did I introduce unnecessary local states, redundant re-renders, or overly complex helper functions?
  * *Refactoring*: Can code chunks be cleaned up, simplified, or consolidated?
- **DRY & Reuse Critique**:
  * *Code Duplication*: Am I writing custom code for something that already exists in the codebase (e.g., distance calculations, API services, formatting utils, date formats)?
  * *UI Reuse*: Did I search for existing shared UI components (Atoms/Molecules) before writing custom layout blocks?
- **Component Single Responsibility**:
  * *Separation of Concerns*: Does the component do too many things? (e.g., managing state, calling API hooks, handling pagination, and rendering complex UI all in one file).
  * *Sub-component Extraction*: If it does, split it. Move server fetching to custom query hooks, and UI panels to sub-components.
- **Edge Case Analysis**:
  * *UX Robustness*: Did I handle standard loading states, API error overlays, empty list fallbacks, and button disabling during actions?
  * *Input Robustness*: Are inputs validated? Does the UI handle long overflow text cleanly without layout breakage?
- **Code Cleanliness Audit**:
  * *Debug Cleanups*: Ensure no `console.log`, `debugger`, or temporary mockup values are left.
  * *Import Health*: Remove all unused imports, dead variables, and redundant comments.

---

## Verification & Checks Checklist

Before declaring a Front-End task complete, perform these checks:
1. [ ] Data Boundary: Does domain data flow components -> data hooks -> repositories -> adapters? No direct `storage.*` / `localStorage.*` / `JSON.parse` of domain keys in components/contexts/feature hooks, query keys from `src/data/queryKeys.js`, mutations invalidate the cache, and auth read via `src/auth/useAuth.js`?
2. [ ] Component Size: Is the modified component file under 500 lines of code?
3. [ ] Atomic Alignment: Is the component placed in the correct hierarchy (atoms/molecules in shared directories, pages/organisms in app/feature directories)?
4. [ ] Reusability & DRY: Did you reuse existing shared UI components instead of creating inline, duplicated elements?
5. [ ] Token Compliance: Do all styles (colors, fonts, spaces, border-radii) follow the project design tokens without arbitrary values?
6. [ ] Class Reuse: Did you reuse pre-defined UI classes instead of duplicating styles?
7. [ ] Responsive (mobile views): For surfaces reachable on mobile/tablet, does the UI follow a Mobile-First layout, include Safe Area Insets, and have a minimum 44x44px touch target on interactive components?
8. [ ] Prop & State: Are React props documented with JSDoc, and is state correctly separated (TanStack Query for server state, local state/Context for UI — no Zustand/Redux, no duplicated server data)?
9. [ ] Security Check: Are there any un-sanitized dynamic HTML bindings or exposed secret keys?
10. [ ] Console / Logger: No `console.*` in app code — runtime logging goes through `src/utils/logger.js`.
11. [ ] Compilation: Does running `pnpm build` compile the application cleanly without errors?
12. [ ] Self-Criticism: Did you review the code changes for simplicity, single responsibility, edge cases, and clean imports?
