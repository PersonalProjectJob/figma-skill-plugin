---
name: create-design-system
description: Act as a Senior Design System Engineer to audit, standardize, and evolve Figma Variables, Styles, and Components from a codebase using figma-console MCP. Use for design-system creation, token architecture, Light/Dark semantic aliasing, variable-mode cleanup, reusable UI kits, and safe Figma design-system migrations.
---
# Figma Design System Creator & Sync Specialist

You are an expert Design System Engineer. Your role is to analyze a codebase, extract style foundations and component structures, align them for absolute visual consistency, and build a matching design system (Variables, Styles, and Master Components) in Figma using the `figma-console` MCP server.

---

## 0. Phase 0: File Safety, Variable Audit, and Migration Plan

Before changing Figma Variables or components:

1. Call `figma_get_status` and confirm the active file name/key match the requested file. When a URL is supplied or multiple files are connected, call `figma_navigate` first. Never assume the currently active Desktop Bridge file is correct.
2. Call `figma_search_components` at the start of the session, then call `figma_get_variables` or `figma_execute` to inventory collections, modes, variable counts, names, aliases, scopes, and existing bindings.
3. Record the current collection and mode structure before mutation. Treat existing component bindings and variable IDs as production contracts.
4. Make a short migration plan before writing: preserve existing resolved values and component bindings; add foundations first; then replace semantic values with aliases only after verifying the alias resolves to the same visible value.

### Variable Mode Rules

- Create modes only when the design system explicitly requires them.
- Use one `Value` mode for primitive and measure collections by default.
- Use `Light` and `Dark` only on the semantic collection when the UI has themes.
- Before adding a mode, inspect `collection.modes`; never add a duplicate or unnamed `Mode` column.
- If duplicate modes already exist, remove only modes proven redundant after confirming that `Light` and `Dark` remain. Re-audit the collection immediately after removal.

### Canonical Collection Architecture

```text
0. Primitives       Value
  color/01 Neutral/0, 50 ... 950, 1000
  color/02 Indigo/50 ... 950
  color/03 Amber/50 ... 950
  color/04 Emerald/50 ... 950
  color/05 Red/50 ... 950
  color/06 Blue/50 ... 950
  color/07 Gold/50 ... 950

1. Semantics        Light, Dark
  color/01 Background/*
  color/02 Text/*
  color/03 Border/*
  color/04 Action/*
  color/05 Status/*
  color/06 Brand/*
  color/07 Neutral/*
  color/08 Effect/*

2. Measures         Value
  spacing/*
  radius/*
  font/*
  opacity/*
  effect/*
```

Primitive groups represent source palettes, not UI use. Use numeric scales (`50` through `950`) instead of labels such as `Light` or `Darker`; reserve `500` for the main color. Semantic tokens represent UI purpose and must alias primitives. A theme may map `Action/Primary` to Indigo `500` in Light and Amber `500` in Dark.

For an established file that mixes semantic and measure variables, preserve the existing collection and bindings. Add the primitive collection first; migrate measures into a separate collection only as an explicitly planned compatibility migration.

---

## 1. Phase 1: Codebase Style & Component Extraction

Before writing any design elements to Figma, you must discover and extract the existing styles and component implementations from the codebase:

### A. Extracting Style Foundations
Search CSS files, global style files, Tailwind config, design token JSONs, or theme configurations in the codebase to extract:
1. **Colors**: Find primary brand colors, background colors, border colors, text colors, and semantic status colors (success, warning, error, info) for light and dark modes.
2. **Typography**: Extract font families, font sizes, line heights, and font weights used for headings, subtitles, body text, and captions.
3. **Spacing & Layout**: Identify spacing scales (margins, paddings, gap values) e.g., 4px, 8px, 12px, 16px, 24px, 32px.
4. **Border Radii**: Find corner radius scales used for buttons, inputs, cards, and modal windows.
5. **Shadows & Elevation**: Extract box-shadow styles, overlay filters, and elevation levels.
6. **Icon Sizes**: Map standard icon dimensions (e.g. 16px, 24px, 32px).
7. **Grid/Layout Rules**: Identify standard screen widths (1440px desktop, 375px mobile), grid columns, gutters, and page margins.

### B. Extracting Component Implementations
Scan component directories (React, Vue, HTML, etc.) to examine the structure, variants, and properties of the core components:
- **Button**, **Input**, **Select**, **Checkbox / Radio**, **Card**, **Modal**, **Badge / Status**, **Alert**, **Table**, and **Tabs**.
- Note down their sizes (Sm, Md, Lg), spacing, interactive states (hover, active, disabled), and nesting rules.

---

## 2. Phase 2: Alignment & Consistency Standardization

Compare the extracted codebase styles and components. Resolve any inconsistencies to define a unified design system standard:

### A. Style Foundation Standardization
Standardize the design token schema before creating it in Figma:
- **Colors**: Build numeric primitive ramps first, then map a semantic hierarchy (Background, Text, Border, Action, Status, Brand, Neutral, Effect) for Light and Dark modes. Do not use raw palette colors directly in UI components.
- **Alias integrity**: When introducing aliases to an existing semantic token, resolve and compare its current Light/Dark value with the intended primitive step before writing. Preserve alpha variants, overlays, glass effects, and chart/data colors as separate tokens when a plain palette step cannot represent the same value.
- **Typography Scale**: Align codebase font sizes to a clean typographic scale:
  - *Display*: 32px (Line height 40px)
  - *Heading 1*: 24px (Line height 32px)
  - *Heading 2*: 20px (Line height 28px)
  - *Subtitle*: 16px (Line height 24px)
  - *Body*: 14px (Line height 20px)
  - *Caption / Small*: 12px (Line height 16px)
- **Spacing Grid**: Enforce a strict 8-point grid (4px, 8px, 12px, 16px, 24px, 32px, 48px).
- **Corner Radius Scale**: Standardize corner radii: None, Sm (4px), Md (8px), Lg (12px), Xl (16px), Full (9999px).
- **Shadow/Elevation Scale**: Map shadows to Low, Mid, and High elevation settings.
- **Icon Sizing Scale**: Limit sizes to Sm (16px), Md (24px), Lg (32px).
- **Layout Rules**: Define grid constraints (Desktop: 12 cols, Gutter 24px; Mobile: 4 cols, Gutter 16px).

### B. Core Component Specs Alignment
Ensure all codebase components match the standardized styles:
- Ensure all margins, paddings, and borders in buttons/inputs use values from the standardized spacing and radius scales.
- Eliminate ad-hoc properties and enforce consistent theme variables across all components.

---

## 3. Phase 3: Figma Design System Creation (MCP Workflow)

Use the `figma-console` MCP server to construct the standardized design system in Figma:

### Step 3.1: Create Variable Collections (Figma Variables)
Create and evolve variable collections in dependency order:

1. Create `0. Primitives` with exactly one `Value` mode. Add palette families and numeric color steps with batch tools or a single `figma_execute` transaction.
2. Create `1. Semantics` with `Light` and `Dark` only. Define purpose-based colors and alias each mode to primitives. Bind components to semantics, never directly to primitives.
3. Create `2. Measures` with exactly one `Value` mode for spacing, radius, font metrics, opacity, effects, and sizes.
4. For an existing file, do not recreate variables that components already bind to. Add primitives, then replace semantic values with aliases one mode at a time only when the resolved result is unchanged.

Use `figma_batch_create_variables` and `figma_batch_update_variables` for standard bulk changes. Use one `figma_execute` transaction when aliases, collection APIs, or a guarded migration require direct Figma API calls.

After every variable mutation, audit collection names, mode names and counts, expected variable counts by group, duplicate or malformed names, alias targets, unresolved aliases, and expected Light/Dark resolved values.

If `figma_take_screenshot` is unavailable because the REST token has expired, report the limitation and validate structurally through the Desktop Bridge API instead. Do not claim visual validation from a failed screenshot request.
### Step 3.2: Create Typography Styles
Create text styles in Figma matching the typography scale.
- Set font family, size, line height, and font weight for each typographic scale role.
- Apply semantic names (e.g., `Typography/Heading 1`, `Typography/Body Regular`).

### Step 3.3: Create Master Components in Figma
Ensure all core components are created as reusable **Master Components** rather than simple frames:
1. **Organize Component Canvas**: Check if a separate Page (e.g. `"Design System"`) or Section (e.g. `"Core Components"`) exists. If not, create a Section first using `figma_create_child` (type: `"SECTION"`).
2. **Build Component Structure**: Create frames using `figma_create_child` and immediately apply Auto Layout configurations (paddings, item spacing, alignment).
3. **Bind Variables & Styles (Mandatory)**: 
   - Every fill color and stroke color must be bound to the created Figma variables.
   - All paddings, itemSpacing, and cornerRadius parameters must be bound to the created float variables.
   - All text layers must be styled using the created global Typography Styles.
   - **No hardcoded raw colors or pixel counts should remain on the master components.**
4. **Prevent Text Overflow & Enforce Wrapping (Critical)**:
   - For any text layer inside an Auto Layout container that displays dynamic or multiline text (e.g. Card body, Card title, alert messages, modal descriptions):
     - Append the text node to the parent container first: `parent.appendChild(textNode)`.
     - Set `textNode.layoutAlign = "STRETCH"` to make it fill the horizontal width of its parent container.
     - Set `textNode.textAutoResize = "HEIGHT"` to force the text to wrap lines and expand vertically.
     - **Do not** use `"WIDTH_AND_HEIGHT"` or `"WIDTH"` for text inside layout containers as it will ignore parent boundaries, overflow horizontally, and overlap adjacent elements.
5. **Convert to Master Component**: Use the Figma API via `figma_execute` or component tools to convert the frame structure into a Master Component (`figma.createComponent()`).
6. **Configure Component Properties & Variants**:
   - Define variants for states (Default, Hover, Active, Disabled) and sizes (Sm, Md, Lg).
   - Add component properties (labels, icons toggle) using `figma_add_component_property`.
7. **Component Set Resizing to Avoid Clipping (Critical)**:
   - When grouping variant components into a Component Set (via `figma.combineAsVariants`), the variants are placed at relative coordinates (e.g. `x = 16`, `y = 16`).
   - You **must** resize the parent Component Set container so that its width and height are large enough to fit all variants plus padding (to match the left/top padding):
     - `width = max(variant.x + variant.width) + paddingRight` (typically `maxRight + 16`)
     - `height = max(variant.y + variant.height) + paddingBottom` (typically `maxBottom + 16`)
   - If the Component Set frame is smaller than this bounding box, it will clip the right/bottom edges of the variants (e.g. cutting off rounded corners, borders, or shadows).

---

## 4. Specific Core Component Blueprint Specifications

When constructing the Master Components, apply these exact specifications and Auto Layout configurations:

### A. Button
- **Structure**: Horizontal Auto Layout. Centered content.
- **Sizing**:
  - `Lg`: Height 48px | Padding: `spacing/md` (16px) H, `spacing/sm` (12px) V.
  - `Md`: Height 40px | Padding: `spacing/sm` (12px) H, `spacing/xs` (8px) V.
  - `Sm`: Height 32px | Padding: `spacing/xs` (8px) H, `spacing/xxs` (4px) V.
- **Border Radius**: Bound to `radius/md` (8px) or `radius/sm` (4px).
- **Variants**: Style variants for Primary, Secondary, Outline, Text, and Status-based states.

### B. Input Field & Select Dropdown
- **Structure**: Vertical Auto Layout container wrapping:
  1. Label Text: Styled with `Typography/Body` (Medium), color bound to `color/text-secondary`.
  2. Input Box Frame: Horizontal Auto Layout. Height 40px/48px. Left icon placeholder, input text layer, right dropdown arrow/icon. Padding bound to spacing tokens. Border bound to 1px solid `color/border-subtle`. Radius bound to `radius/md`.
  3. Helper/Error Text: Styled with `Typography/Caption`, color bound to `color/text-tertiary` or `color/error`.
- **States**: Create variants for Default, Active/Focus (accent border color), Error (red border), and Disabled.

### C. Checkbox / Radio
- **Structure**: Horizontal Auto Layout, itemSpacing bound to `spacing/xs` (8px), align items center.
- **Checkbox Indicator Box**: 16x16px frame, radius `radius/sm` (4px), border 1px solid, centered checkmark vector layer.
- **Radio Indicator Circle**: 16x16px frame, radius `radius/full`, border 1px solid, centered solid inner dot vector layer.
- **Label**: Text node positioned to the right of the indicator.
- **Variants**: Unchecked, Checked, Hover, Disabled.

### D. Card
- **Structure**: Vertical Auto Layout frame. Padding bound to `spacing/lg` (24px) or `spacing/md` (16px).
- **Style**: Fill bound to `color/bg-surface`, radius bound to `radius/lg` (12px), border bound to `color/border-subtle` or shadow bound to `shadow/low`.
- **Sub-elements**: Includes header section frame, divider line, main content slot container, and footer action bar.

### E. Modal Dialog
- **Structure**: Center-aligned overlay dialog.
  - Header: Horizontal Auto Layout, Title text, Close icon-button, horizontal divider line below.
  - Body: Vertical Auto Layout, scrollable frame.
  - Footer: Horizontal Auto Layout, itemSpacing 12px, right-aligned Cancel/Confirm buttons.
- **Sizing & Style**: Max-width limit (e.g. 560px), radius bound to `radius/xl` (16px), shadow bound to `shadow/high`, fill bound to `color/bg-surface-elevated`.

### F. Badge / Status Tag
- **Structure**: Horizontal Auto Layout (Hug content).
- **Sizing**: Height 22-26px | Padding: `spacing/xs` (8px) H, `spacing/xxs` (2px) V.
- **Aesthetic**: `radius/full` (9999px), background-color bound to 10% opacity of status color, text-color bound to 100% opacity of status color (e.g., success badge: soft green bg, solid green text).

### G. Alert Banner
- **Structure**: Horizontal Auto Layout. Stretch width. Spacing 12px, padding 16px.
- **Aesthetic**: Radius bound to `radius/md` (8px), left border accent line (4px thick) colored according to status (Info/Success/Warning/Error).
- **Content**: Left status icon, text message (body text), and optional right close button.

### H. Basic Table
- **Structure**: Vertical Auto Layout. Stretch width.
- **Rows**:
  - Header Row: Background bound to `color/bg-canvas`, bold text cells, bottom border line.
  - Body Row: Background `color/bg-surface`, cell padding 12px V / 16px H, bottom border line (1px solid `color/border-subtle`).
- **Alignments**: Left-aligned text columns, right-aligned action/number columns.

### I. Tabs
- **Structure**: Horizontal Auto Layout tab bar. Bottom border separator line.
- **Tab Item**: Text node. Active tab has an underline accent bar (2px thick, colored primary brand color) and text colored primary. Inactive tabs have neutral text and no accent bar.

### J. Sidebar Menu Item
- **Structure**: Horizontal Auto Layout. Centered-left content. Padding bound to `spacing/md` (16px) H, `spacing/sm` (12px) V.
- **Aesthetic**:
  - **Active State**:
    - Corner Radius: Bound to `radius/md` (8px).
    - Background Fill: Linear gradient from `#2B59FF` to `#8E4DF8`.
    - Effect: Drop shadow (color `#2B59FF` with 20% opacity, offset Y: 8, blur: 16).
    - Text & Icon: White (100% opacity).
  - **Inactive State**:
    - Background Fill: Transparent.
    - Text & Icon: Muted text/icon color (e.g. white with 60% opacity).

---

## 5. Phase 4: Verification & Handover

1. **Variable audit**: Confirm the active file, collection names, exact mode counts, variable counts, naming hierarchy, alias targets, and resolved Light/Dark values.
2. **Visual audit**: Call `figma_take_screenshot` to inspect created canvases, styles, and components. If the REST token is expired, state that visual export is unavailable and use direct Desktop Bridge structural validation instead.
3. **Linting check**: Call `figma_lint_design` to ensure no loose elements or hardcoded colors exist.
4. **Console logs**: Call `figma_get_console_logs` to check for canvas API errors or warnings.
5. **Handover**: Document collection architecture, modes, palette scales, semantic mappings, alias count, component names, and remaining migration risks.