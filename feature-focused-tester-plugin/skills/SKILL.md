---
name: feature-focused-tester
description: Plan, write, and execute tests targeted at a newly added or modified feature in this React 18 + Vite (JS/JSX) repo. Drives a 3-layer progression that maps to the repo data boundary — Layer 1 Test UI (component render/states/responsive), Layer 2 Test call API (data hooks -> repositories -> adapters, query keys + mutation invalidation), Layer 3 Test flow (E2E user journey). Produces test_plan.md and walkthrough.md artifacts, runs targeted (not full-suite) tests, and reports QA results to Telegram Thread 735.
---

# Feature-Focused Tester Skill

Design, write, and run tests focused on one target feature or change. Tests progress through **three layers** that mirror the repo's data boundary (`components -> data hooks -> repositories -> adapters`). Do not skip the middle layer.

## Why this skill exists

1. **Targeted verification** — test only the feature under change; avoid slow full-suite runs.
2. **Layered coverage** — UI render, then the data layer (hooks/repositories/adapters), then the full user flow. The middle layer is where most regressions hide (query keys, cache invalidation, normalized shapes, storage-vs-api transport).
3. **Real-browser confidence** — verify the actual flow (login -> seed -> navigate -> act -> side-effects) under a running dev server.

Token / design-system compliance is **out of scope** here — it belongs to the `frontend-code-standards` skill. This skill may run `pnpm lint:tokens` as a quick gate (see Layer 1) but does not re-document token rules.

---

## Repo facts (do not contradict)

- React 18 + Vite, **JavaScript/JSX (not TypeScript)**. Package manager = **pnpm**.
- Test runner = **Vitest v2** with `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. **Config already exists** — do not recreate it:
  - `vitest.config.js`: `environment: 'jsdom'`, `globals: true`, `setupFiles: './src/setupTests.js'`, `include: ['tests/unit/**/*.test.{js,jsx}']`, and a `@` -> `./src` alias (usable in tests).
  - `src/setupTests.js` **auto-wraps every `render()` with a `QueryClientProvider`** and **pre-seeds the Query cache from `localStorage`** for domain keys (`nexora_notifications`, `nexora_transactions`, `nexora_reviews`, `nexora_merchant_setup`, `nexora_profile_settings`, `nexora_pending_accounts`). So you do **not** add your own QueryClient wrapper, and seeding `localStorage` before `render()` makes the data visible immediately.
- Dev server port = **3000** -> `http://localhost:3000` (e2e uses `http://127.0.0.1:3000`).
- Scripts: `pnpm dev`, `pnpm build`, `pnpm test` (= `vitest run`), `pnpm test:watch`, `pnpm test:e2e` (= `node scripts/run-e2e.cjs`, spawns the dev server then runs `tests/e2e/**`), `pnpm lint:tokens`, `pnpm test:impact` (= the `detect-changes.cjs` in this skill), `pnpm seed:staff-demo`.
- Data boundary: `components -> data hooks (src/data/hooks) -> repositories (src/data/repositories) -> adapters (src/data/adapters)`. Query keys in `src/data/queryKeys.js`. TanStack Query owns cached domain data; **mutations MUST invalidate the relevant query cache**. Transport is selected by `VITE_DATA_SOURCE` (`storage` | `api`); repositories are factories `createXRepository(adapter, client)`.
- Existing tests to mirror (don't reinvent style): `tests/unit/*.test.jsx` (component + hook tests, e.g. `Dashboard.test.jsx`, `dataHooks.test.jsx`), `src/data/repositories/__tests__/*.test.js` (repository tests), `tests/e2e/*.test.js` (flow tests).

---

## Workflow

### 1. Scope detection & feature analysis

- Identify the user stories, functional requirements, and the affected source files.
- Map each affected file to its owning layer: UI component, data hook, repository, adapter, route/flow.
- Run `pnpm test:impact` (the `detect-changes.cjs` script) to list changed `src/` files and suggested test paths.

### 2. Generate test plan (`test_plan.md` artifact)

Before writing or running anything, create `test_plan.md`. Classify every test case **by layer** and **by priority**, and define the acceptance gate.

**Layer classification** (each case belongs to exactly one):
- **L1 — Test UI**: render, props, empty/loading/error states, responsive desktop/mobile.
- **L2 — Test call API (data boundary)**: data hook + repository + adapter — query keys, mutation invalidation, loading/error, normalized object shape, storage-vs-api transport.
- **L3 — Test flow (E2E)**: full user journey in a browser.

**Priority** (drives the Definition of Done):
| Priority | Meaning | Examples |
|----------|---------|----------|
| **P0** | Blocks release if it fails | component renders without crashing, no console errors, mutation invalidates cache, primary happy-path flow works, `pnpm build` passes |
| **P1** | Degraded UX if it fails | responsive layout, error-state rendering, secondary flows |
| **P2** | Workaround exists | edge cases, empty states, rapid interactions |
| **P3** | Cosmetic | spacing/label polish |

Each test case must state: id, layer (L1/L2/L3), priority, precondition, steps, expected result (functional + visual where relevant).

**Acceptance Criteria / Definition of Done** (gate at the top of `test_plan.md`):
- [ ] All **P0** cases pass (mandatory — no exceptions).
- [ ] All **P1** cases pass (document any exception with reason).
- [ ] No console errors during Layer 1 render or Layer 3 flow.
- [ ] `pnpm build` succeeds.
- [ ] Mutations under test invalidate or update the correct query cache.
- [ ] P2/P3 may be deferred to a follow-up ticket.

### 3. Write / update test scripts

Add tests next to the layer they cover, matching existing conventions:
- L1 component tests: `tests/unit/<Name>.test.jsx`.
- L2 hook tests: `tests/unit/<hook>.test.jsx`; repository tests: `src/data/repositories/__tests__/<domain>.test.js`.
- L3 flow tests: `tests/e2e/<flow>.test.js` (run by `pnpm test:e2e`).

Then execute the layers **in order**.

---

## Layer 1 — Test UI

**Goal:** the component renders correctly across props and states, and looks right at desktop + mobile.

**Tech:** Testing Library `render` (already auto-wrapped with a QueryClient by `src/setupTests.js`) for structure/state assertions; browser MCP screenshots for visual/responsive proof.

**Render assertions** — call `render()` directly. To make a component that reads domain data show data, seed `localStorage` with the matching `nexora_*` key **before** `render()` (the setup file seeds the Query cache from it):

```jsx
import { render, screen } from '@testing-library/react';
import { beforeEach } from 'vitest';
import AnalyticsView from '@/components/.../AnalyticsView';

beforeEach(() => {
  localStorage.clear();
});

test('renders empty state when no transactions', () => {
  render(<AnalyticsView />);
  expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
});

test('renders seeded transactions', () => {
  localStorage.setItem('nexora_transactions', JSON.stringify([{ id: 't1', amount: 100 }]));
  render(<AnalyticsView />);
  expect(screen.getByText(/100/)).toBeInTheDocument();
});
```

Cover at minimum: default render, empty, loading, error, and any prop variants.

**Run it (targeted, not full suite):**

```bash
pnpm vitest run tests/unit/AnalyticsView.test.jsx
# iterate while editing:
pnpm test:watch tests/unit/AnalyticsView.test.jsx
```

**Responsive / visual proof (browser MCP):**
1. Start the dev server: `pnpm dev` (serves `http://localhost:3000`).
2. `mcp__Claude_Preview__preview_start` with the feature URL.
3. `mcp__Claude_Preview__preview_resize` to a desktop width, then a mobile width; capture each with `mcp__Claude_Preview__preview_screenshot`.
4. `mcp__Claude_Preview__preview_console_logs` — assert no errors/warnings.

(Chrome-based alternative: `mcp__Claude_in_Chrome__navigate`, `mcp__Claude_in_Chrome__resize_window`, `mcp__Claude_in_Chrome__computer` for screenshots, `mcp__Claude_in_Chrome__read_console_messages`.)

**Quick token gate (delegated, not owned here):** `pnpm lint:tokens`. Failures are a `frontend-code-standards` concern — report them, don't re-audit tokens.

---

## Layer 2 — Test call API (data boundary)

**Goal:** the data layer behaves correctly. Today "API" means the **repository + adapter (storage)**, not real HTTP; tomorrow the same repository drives the **api adapter / httpClient**. Test the repository contract and the hook's cache behavior.

### 2a. Repository tests (mirror `src/data/repositories/__tests__/merchants.test.js`)

Repositories are factories `createXRepository(adapter, client)`. Inject mock `adapter` (`get`/`set`/`remove`) and mock `client` (`get`/`post`/`put`/`upload`), switch transport with `vi.stubEnv('VITE_DATA_SOURCE', ...)`, and assert the right transport is used with the right storage key / endpoint.

```js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMerchantsRepository } from '../merchants';

describe('merchantsRepository', () => {
  let mockAdapter, mockClient;
  beforeEach(() => {
    mockAdapter = { get: vi.fn(), set: vi.fn(), remove: vi.fn() };
    mockClient = { get: vi.fn(), post: vi.fn(), put: vi.fn(), upload: vi.fn() };
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  describe('Storage Mode (VITE_DATA_SOURCE=storage)', () => {
    beforeEach(() => vi.stubEnv('VITE_DATA_SOURCE', 'storage'));

    it('reads setup from the storage adapter with the domain key', async () => {
      const repo = createMerchantsRepository(mockAdapter, mockClient);
      mockAdapter.get.mockResolvedValue({ businessInfo: { name: 'Biz' } });
      const res = await repo.getSetup();
      expect(mockAdapter.get).toHaveBeenCalledWith('nexora_merchant_setup');
      expect(res).toEqual({ businessInfo: { name: 'Biz' } });
    });
  });

  describe('API Mode (VITE_DATA_SOURCE=api)', () => {
    beforeEach(() => vi.stubEnv('VITE_DATA_SOURCE', 'api'));

    it('reads setup from the http client, not storage', async () => {
      const repo = createMerchantsRepository(mockAdapter, mockClient);
      mockClient.get.mockResolvedValue({ businessInfo: { name: 'Biz' } });
      await repo.getSetup();
      expect(mockClient.get).toHaveBeenCalled();
      expect(mockAdapter.get).not.toHaveBeenCalled();
    });
  });
});
```

Assert: the **normalized object shape** the repository returns, correct **storage key / endpoint**, and that storage mode never hits the client (and vice versa).

### 2b. Data-hook tests (mirror `tests/unit/dataHooks.test.jsx`)

`render`/`renderHook` already get a QueryClient from the setup file. Assert the hook uses the key from `src/data/queryKeys.js`, surfaces loading/error, and that a **mutation invalidates** the relevant query.

```jsx
import { renderHook, waitFor, act } from '@testing-library/react';
import { queryKeys } from '@/data/queryKeys';
// hook under test reads through the repository layer (mock the repository or adapter as the seam)

test('mutation invalidates the merchant setup query', async () => {
  const { result } = renderHook(() => useSaveMerchantSetup());
  await act(async () => { await result.current.mutateAsync({ businessInfo: {} }); });
  // assert the relevant queryKeys.* entry was invalidated/updated
});
```

Mock at the **adapter / repository seam**, not the hook itself. Adjust hook names and `queryKeys.*` accessors to the actual files under test.

**Run it:**

```bash
pnpm vitest run tests/unit/dataHooks.test.jsx
pnpm vitest run src/data/repositories/__tests__/merchants.test.js
```

---

## Layer 3 — Test flow (E2E)

**Goal:** the real user journey works end to end with side-effects intact (notifications, route transitions, cross-side data).

**Tooling:** the project E2E runner, plus the browser MCP for visual confirmation.

```bash
# Runs scripts/run-e2e.cjs: spawns the dev server on http://127.0.0.1:3000 and runs tests/e2e/**
pnpm test:e2e

# Targeted single flow:
pnpm vitest run tests/e2e/staffDashboard.test.js
```

Add new flow tests under `tests/e2e/<flow>.test.js`, mirroring `tests/e2e/dashboard.test.js` / `staffDashboard.test.js`. Seed demo data with `pnpm seed:staff-demo` when the flow needs it.

**Visual / interactive flow (browser MCP):**
1. `mcp__Claude_Preview__preview_start` -> `http://localhost:3000`.
2. **Login**: `mcp__Claude_Preview__preview_fill` credentials, `mcp__Claude_Preview__preview_click` submit.
3. **Navigate**: `mcp__Claude_Preview__preview_click` through to the feature route.
4. **Action**: perform the feature steps (`preview_fill` / `preview_click`).
5. **Verify side-effects**: assert the route transition, the notification that should fire, and that staff/customer-side data updated. Use `mcp__Claude_Preview__preview_screenshot` at each key step and `mcp__Claude_Preview__preview_console_logs` to confirm no errors.

(Chrome equivalents: `mcp__Claude_in_Chrome__navigate`, `mcp__Claude_in_Chrome__form_input`, `mcp__Claude_in_Chrome__computer`, `mcp__Claude_in_Chrome__find`, `mcp__Claude_in_Chrome__read_network_requests`.)

When a registration/setup action changes data, check **both** the owner and the staff/customer side effects, and confirm notification side-effects stay intact (per CLAUDE.md domain workflow notes).

---

## Report & walkthrough (`walkthrough.md` artifact)

Create/update `walkthrough.md` summarizing:
- Each executed test case with layer (L1/L2/L3), priority, and status (Pass/Fail).
- Desktop + mobile screenshots from Layer 1 and the Layer 3 flow.
- Command outputs / failing assertions.
- Definition-of-Done status: P0 all-pass? P1 status + any documented exceptions.

---

## Telegram QA reporting (Thread 735)

Per project rules, **QA results route to Telegram Thread 735** via the project's QA script — not a generic `sendMessage` POST.

- Use the project QA script, e.g. `node test-pre-commit.js --telegram` (or `pnpm run test:pre-commit:telegram` if defined), which posts to Thread 735.
- **Send when:** the pre-commit/QA suite completes (pass or fail), a quality gate flips (PASS <-> FAIL), or a P0 failure / UI bug / server crash is detected.
- **Routing rules:** Thread 735 is QA-only. Do **not** send QA results to Thread 727 (design/dev) or Thread 718 (changelog/releases).
- Always send on failure with the failing test names and a short error snippet, and state whether the P0 gate passed (READY_FOR_COMMIT vs NOT_READY).
