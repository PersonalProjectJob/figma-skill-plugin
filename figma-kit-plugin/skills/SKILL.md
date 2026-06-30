---
name: generate-figma-kit
description: Audit and synchronize Figma flows with the project design system through figma-console MCP: reuse existing components, create missing master components, enforce Dev Mode friendly Auto Layout, and replace duplicated manual UI with component instances.
---

# Figma Kit Design-System Synchronizer

Use this skill when the user asks to fix, synchronize, generate, or prepare a Figma flow for design-to-code through `figma-console` MCP.

The goal is not only visual cleanup. The final Figma file must be useful for engineers and agents reading Dev Mode: repeated UI should be represented by shared master components, component instances should replace manual duplicates, and Auto Layout should describe the actual structure of the UI.

This skill is based on the NiFit Meal flow remediation session:
- Synced repeated screens to a shared design system.
- Created missing master components for a full app flow.
- Converted manual Figma layers into Dev Mode friendly Auto Layout.
- Replaced repeated screen sections with component instances.
- Fixed broken component anatomy such as card backgrounds plus overlay text, chip backgrounds plus overlay labels, and inconsistent variant layouts.

---

## 1. Non-Negotiable Workflow

### 1.1 Connect and inspect first

Before any write:

1. Call `figma_list_open_files` and confirm the active file is correct.
2. Call `figma_search_components` for the project prefix and for the target flow keywords.
3. Inspect the target node with `figma_execute`.
4. Return a short gap analysis:
   - Existing design-system components that can be reused.
   - Missing master components.
   - Manual duplicated UI that should become instances.
   - Auto Layout or layer structure problems that block design-to-code.

Never guess node IDs from memory. Re-read the current file state in the active Figma session.

### 1.2 Mutate incrementally

Use small `figma_execute` scripts. Each write must return:

- Created or mutated node IDs.
- Component names.
- Variant names.
- Any component properties created or changed.

Do not run parallel write calls against Figma. Read-only calls can be parallelized, but Figma mutations should be sequential.

### 1.3 Visual validation is required

After creating or modifying visual design:

1. Capture the changed master component or flow node with `figma_capture_screenshot`.
2. Inspect spacing, alignment, clipping, text wrapping, and hierarchy.
3. Fix regressions before moving to the next component.
4. Capture a final screenshot of the target flow or section.

---

## 2. Design-System Sync Rules

### 2.1 Reuse before creating

Search local and library components first:

- Buttons
- Cards
- Badges / chips
- Tabs
- Bottom navigation
- Headers
- Rows / list items
- Empty states
- Bottom sheets
- Flow-specific sections

If a suitable component exists, use an instance and configure it through variants or component properties.

### 2.2 Create missing master components when needed

Create a new master component only when:

- The same UI pattern appears in two or more places.
- The pattern is part of a flow contract, such as a row, tab strip, hero, screen header, bottom sheet, or empty state.
- Existing library components are too generic or have the wrong anatomy for Dev Mode.

Put new components inside a dedicated Section or Frame, for example:

```text
NiFit Meal Flow Components
```

Do not place new components loose on the canvas.

### 2.3 Name components and variants deterministically

Use product and flow names:

```text
NiFit / Meal Header v2
NiFit / Meal Hero Section v2
NiFit / Meal Tabs v2
NiFit / Meal Food Row v2
NiFit / Meal Guideline Row v2
NiFit / Meal Supplement Filter Bar v2
```

Use explicit variant axes:

```text
Active=Day Plan
Active=Food
Active=Guidelines
Active=Supps
Context=Meal Plan
Context=Supplements
Kind=Coach Note
Kind=Guideline
Plan=Normal
Plan=Busy IF
```

---

## 3. Dev Mode Friendly Auto Layout

### 3.1 Component root must be the real container

The root component or variant should be the actual visual container whenever possible.

Correct:

```text
NiFit / Meal Food Row v2 (COMPONENT, Auto Layout HORIZONTAL, card fill/stroke/radius)
  icon
  name
  count
```

Incorrect:

```text
NiFit / Meal Food Row v2 (COMPONENT, layout NONE)
  UI Kit Instance / Card - Food 0
  Food Icon 0
  Food Name 0
  Food Count 0
```

The incorrect structure looks right visually but produces poor Dev Mode output and weak design-to-code mapping.

### 3.2 No overlay labels for chips, cards, or rows

Avoid a background layer plus separate sibling text overlays.

Correct chip anatomy:

```text
Filter Bar (Auto Layout HORIZONTAL)
  Filter Chip 1 (Auto Layout HORIZONTAL)
    label
  Filter Chip 2 (Auto Layout HORIZONTAL)
    label
```

Incorrect chip anatomy:

```text
Filter Bar (layout NONE)
  Badge background 1
  Badge label 1
  Badge background 2
  Badge label 2
```

Correct card anatomy:

```text
Kind=Coach Note (COMPONENT variant, Auto Layout VERTICAL, card fill/stroke/radius)
  title
  subtitle
```

Incorrect card anatomy:

```text
Kind=Coach Note
  UI Kit Instance / Card - Coach Notes
  Coach T
  Coach B
```

### 3.3 Recommended layout settings by pattern

Food row:

```text
Root: HORIZONTAL, fixed 342 x 58
paddingLeft/right: 20
itemSpacing: 12
children:
  icon: fixed 28 x 28
  name: Fill container, textAutoResize HEIGHT
  count: Hug contents, right aligned
```

Guideline / coach note row:

```text
Root variant: VERTICAL, fixed 342 x 72
paddingLeft/right: 20
paddingTop: 15
paddingBottom: 14
itemSpacing: 6
children:
  title: Fill container, Hug height
  subtitle: Fill container, Hug/HEIGHT
```

Supplement filter bar:

```text
Root: HORIZONTAL, fixed flow width
itemSpacing: 8
children:
  Filter Chip: HORIZONTAL, fixed/hug width, centered
    label: WIDTH_AND_HEIGHT when single-line, or HEIGHT when wrapping is intended
```

Schedule row:

```text
Root: HORIZONTAL, fixed row height
children:
  icon/status
  text stack: Fill container
  meta / chevron: Hug contents
```

Screen section:

```text
Root screen: VERTICAL
Header: component instance
Hero: component instance
Selector: component instance
Tabs: component instance
Content list: component instance or Auto Layout group of row instances
Bottom nav: component instance
```

### 3.4 Text rules

For dynamic text inside Auto Layout:

- Append the text to its parent first.
- Use `layoutSizingHorizontal = "FILL"` for long labels or body copy.
- Use `layoutSizingHorizontal = "HUG"` only for short metadata or count labels.
- Use `textAutoResize = "HEIGHT"` for wrapping text.
- Use `textAutoResize = "WIDTH_AND_HEIGHT"` only when the label is intentionally single-line and the container is sized to fit it.
- Load the current font before writing text or changing text sizing.

---

## 4. Missing Component Creation Workflow

### 4.1 Identify patterns across the flow

Common missing flow-level components:

- Screen Header
- Hero Section
- Day Type Selector / segmented control
- Tabs
- Row item
- List composition
- Filter bar / chip group
- Empty State
- Detail metric row
- Bottom Sheet

Create masters from the most correct screen, then normalize structure before applying them elsewhere.

### 4.2 Build component sets from variants

When creating variants:

1. Clone or rebuild each state.
2. Convert each variant into a component.
3. Combine as variants.
4. Lay out variants in a readable grid.
5. Resize the component set so variants and shadows are not clipped.
6. Screenshot and inspect.

For component sets, avoid binding the same text property to all variants when variants need different default copy. Text properties on component sets are useful only when all variants share the same semantic text slots.

### 4.3 Add component properties carefully

Use text component properties for reusable override fields:

```text
Food Row:
  Name
  Count

Guideline Row:
  Title
  Subtitle

Supplement Filter Bar:
  Filter 1
  Filter 2
  Filter 3
  Filter 4

Empty State:
  Title
  Body
  Action Label
```

When replacing manual UI with instances, preserve the old text by reading it first and setting instance properties immediately after insertion.

---

## 5. Applying Components to a Flow

### 5.1 Replace duplicated UI with instances

After masters are valid:

1. Inspect the target flow container.
2. Find each screen frame.
3. Replace repeated blocks with instances:
   - Header
   - Hero
   - Tabs
   - Selectors
   - Lists and rows
   - Empty states
   - Bottom sheets
4. Preserve each block's position and size.
5. Preserve old text overrides through instance properties.
6. Keep unrelated screen-specific content unchanged.

### 5.2 Do not blindly detach or delete

Never delete broad matches. Only replace the exact node group that corresponds to the new master component.

When replacing a manual row group:

1. Collect the background, icon, title, subtitle/count nodes.
2. Insert the component instance at the first node's index.
3. Set x/y to the old group position.
4. Apply text properties.
5. Remove the old nodes.

### 5.3 Re-audit after replacement

Return an audit such as:

```text
screenCount: 9
totalFlowInstances: 48
perScreen:
  Meal / Food Tab Library: Header, Hero, Tabs, 5 Food Row instances
  Meal / Guidelines Tab: Header, Hero, Tabs, 4 Guideline Row instances
```

Then screenshot the full flow node and any changed master components.

---

## 6. Regression Checklist

Before final response, verify:

- No master component is built from a background instance plus overlay sibling text.
- Text sits inside the chip/card/row it belongs to.
- Dynamic text does not clip or wrap unexpectedly.
- Component variants are not stacked at `(0,0)`.
- Component set bounds include shadows and borders.
- Root components have meaningful Auto Layout.
- Instances in flow point back to the intended master components.
- Variant text such as `Context=Supplements` is correct in the master, not only in a single instance.
- Screens still match the visual language of the flow.

---

## 7. Communication Pattern

When working in Figma:

1. Briefly state the component or flow section being audited.
2. Report the structural issue in concrete layer terms.
3. Apply the smallest safe fix.
4. Screenshot and validate.
5. Summarize the changed master component names and affected screens.

Example:

```text
The Supplement Filter Bar was using badge backgrounds plus overlay text siblings.
I rebuilt the master as an Auto Layout bar containing chip frames, each with its own label child.
The flow instance now updates from the master and the labels no longer wrap or drift.
```
