---
name: designing-hifi-screens
description: Use when designing hi-fi screens in Figma or Pencil for a product that already has shipped code or a design system, or when a hi-fi deliverable was rejected as inconsistent with the existing system, off-brand, or "looks like a generic dashboard".
---

# Designing Hi-Fi Screens Against a Real System

## Overview

You are acting as a UX/UI Designer producing hi-fi screens for a product that **already exists**. The screens must be indistinguishable in construction from what the product already ships — not merely similar in colour.

**Core principle: consistency is a grammar problem, not a vocabulary problem.**

Using the product's exact colour values is the *vocabulary* level. It is necessary and nowhere near sufficient. What a reviewer perceives as "inconsistent" lives at the *grammar* level: the type scale, the spacing scale, the radius scale, the shell the screen sits in, and whether repeated UI is reused or redrawn by hand.

A design can use 100% correct hex values and still be rejected. That exact outcome is the baseline failure this skill exists to prevent (see Baseline Failure).

## When to Use

- Designing new hi-fi screens for an existing product, in **Figma** or **Pencil**
- A hi-fi deliverable came back as "not consistent with the system", "doesn't follow the design system", or with a low conformance score
- Extending a product with a new module that must slot into existing navigation
- Porting a design or prototype from another product into this one
- Remediating an existing flow to the design system (the original scope of this skill)

**Do NOT use for:** greenfield products with no design system and no shipped code — there is no truth source to conform to, so do exploratory visual direction instead. Also not for pure wireframes where visual fidelity is explicitly out of scope.

## The Iron Law

```
NEVER HAND-TRANSCRIBE THE DESIGN SYSTEM.
```

Every token value, component name, and scale step you use must be **extracted mechanically from the truth source during this session**, with the extraction output pasted into your report as evidence.

The moment a human or an upstream agent types a token table into your brief by hand, that table is a lossy copy: it will be incomplete, and you will fill the gaps with framework defaults that look plausible and are wrong.

**No exceptions:**
- Not when the brief "already includes the tokens" — verify the list is complete against source, and say so
- Not when you only need "one more colour"
- Not when the value is "obviously" the standard one for that framework
- A token you need but cannot find is a **BLOCKED** condition, not an invitation to invent one

## Step 0 — Truth Source Gate (ASK, never assume)

Before any extraction, establish which artefact is authoritative. **Ask the user.** Do not choose for them.

| Option | Truth source | Use when |
|---|---|---|
| **A. Source code** | Shipped repo: theme/config file, CSS custom properties, real screen components, routing/menu config | Code exists and is deployed. Strongest — it is what users actually see. |
| **B. Design system file** | Figma variables, text styles, published component library | No code yet, or code lags the design system |
| **C. Both, with precedence** | Both, user names which wins on conflict | Both exist. Default recommendation: **code wins** (it ships); log every divergence found. |

Record the chosen option and exact paths / file keys in your report. If the user does not answer, **stop** — do not default silently. A wrong truth source invalidates everything downstream.

## Step 1 — Mechanical extraction

Run extraction against the chosen source. Paste raw output into your report.

**Option A — source code:**
- Locate the theme source: `tailwind.config.*`, `theme.*`, `tokens.*`, `:root{--*}` in global CSS, or the design-token package
- Extract **every** token in the product namespace — colour, radius, spacing, font size, shadow. Count them. If your brief lists fewer, the brief is wrong; use source
- Extract the real construction of 2–3 **existing screens of the same type** as the one you are designing. Record actual class strings / style props for: page header, list row, primary button, input, chip, toggle, empty state
- Extract the real navigation structure from routing/menu config

**Option B — design system file (Figma):**
- `figma.variables.getLocalVariableCollectionsAsync()` → every collection, every variable, resolved per mode
- `figma.getLocalTextStylesAsync()` → the complete type ramp
- `figma_search_components` → component / component-set inventory with node IDs and variant axes
- Screenshot 2+ **assembled real screens** and look at them. Reading a token table is not seeing the product.

**Output is a Token Manifest**: the complete allowlist of values you may use. Anything not in it is forbidden.

Never guess node IDs from memory — re-read current file state in the active session.

## Step 2 — Reuse before creating

Repeated UI must be a reused unit, never redrawn per screen. The mechanism differs by tool; the requirement does not.

### Figma

Search existing components first — buttons, cards, badges/chips, tabs, navigation, headers, rows/list items, empty states, sheets. If a suitable component exists, instantiate it and configure through variants or component properties.

Create a new master component only when:
- The pattern appears in two or more places
- The pattern is part of a flow contract (row, tab strip, hero, screen header, sheet, empty state)
- Existing components are too generic or have the wrong anatomy for Dev Mode

Place new components inside a dedicated Section or Frame, never loose on canvas. Name deterministically — `Product / Pattern vN` — with explicit variant axes (`State=Active`, `Context=Meal Plan`, `Size=Small`).

### Pencil

Pencil has no published-component-instance model equivalent to Figma's. This is a real constraint with a real consequence: **hand-redrawing every screen is how drift happens.** Compensate explicitly:

1. Build a **base set** first — one canonical instance of each repeated unit (row, chip, button, input, header, empty state) in a dedicated frame
2. Build every screen by duplicating from the base set, never by drawing a new one
3. Register token values as document variables and reference them; never inline a literal
4. If the design must live on as a system of record, say so: recommend Figma and state why

**Never** redraw a unit that already exists elsewhere in the file.

## Step 3 — Structural conformance (the grammar level)

These are the checks a reviewer performs by eye. Enforce them yourself first.

| Axis | Rule |
|---|---|
| **Type** | Every text node's size is a step in the extracted ramp. No intermediate sizes. One family unless the system defines more. |
| **Spacing** | Every gap and padding is a step in the extracted spacing scale. |
| **Radius** | Every corner radius is an extracted value. Buttons/inputs and cards usually differ — do not collapse them to one value. |
| **Colour** | Zero raw literals. Every fill and stroke references a token. |
| **Shell** | The screen sits inside the product's **real** chrome — real navigation, real hierarchy, real menu labels from Step 1. Never invent an app frame. |
| **Density** | Content occupies the frame the way shipped screens do. 45% dead space at the bottom does not match a product whose real screens fill the viewport. |

**On the shell specifically:** this is the single most visible failure. If the product has persistent side navigation, a screen drawn with a top tab bar reads as a different product no matter how correct the palette is.

## Step 4 — Dev Mode friendly structure (Figma)

Structure must describe the UI, not just look like it.

**Component root must be the real container.**

Correct:
```text
Product / Food Row v2 (COMPONENT, Auto Layout HORIZONTAL, card fill/stroke/radius)
  icon
  name
  count
```

Incorrect:
```text
Product / Food Row v2 (COMPONENT, layout NONE)
  UI Kit Instance / Card - Food 0
  Food Icon 0
  Food Name 0
  Food Count 0
```

The incorrect structure looks right visually but produces poor Dev Mode output and weak design-to-code mapping.

**No overlay labels for chips, cards, or rows.** Never a background layer plus separate sibling text overlays.

Correct chip anatomy:
```text
Filter Bar (Auto Layout HORIZONTAL)
  Filter Chip 1 (Auto Layout HORIZONTAL)
    label
```

Incorrect chip anatomy:
```text
Filter Bar (layout NONE)
  Badge background 1
  Badge label 1
```

**Layout settings by pattern:**
```text
Row:     HORIZONTAL, fixed height; padding L/R; itemSpacing
         icon: fixed · text: Fill container · meta/chevron: Hug contents
Chip:    HORIZONTAL, hug width, centered; label WIDTH_AND_HEIGHT single-line
Screen:  VERTICAL; header = component instance; body = Fill container
```

**Text rules:** use text styles, never raw font sizes. `Fill container` for text that should wrap, `Hug` for labels that must not.

## Step 5 — Mutate incrementally, validate visually

Use small write calls. Each write returns created/mutated node IDs, component names, variant names, and any component properties changed. Do not run parallel writes against the same document — reads can be parallel, writes must be sequential.

After each component or screen:
1. Capture a screenshot
2. **Look at it** — spacing, alignment, clipping, text wrapping, hierarchy, contrast
3. Fix regressions before moving on; cap at 3 iterations per screen, then record what you could not fix
4. Measure with a layout snapshot rather than estimating by eye

## Step 6 — Conformance audit before claiming done

Run `conformance-audit.py` (this skill directory) against the design file and paste its output. It reports, with counts:

- Font sizes off-ramp
- Spacing values off-scale
- Radius values off-scale
- Raw colour literals not bound to a token
- Font families beyond the system's
- Reuse ratio: hand-drawn units vs instances

**A claim of conformance without this output is not a claim, it is an assertion.** Any non-zero off-scale count must be fixed, or listed explicitly as a known deviation with a reason.

## Baseline Failure (what happens without this skill)

Observed in production, not hypothetical. An agent was asked to produce hi-fi screens for a POS module, given a hand-written brief containing 10 of the product's 23 colour tokens:

| What it did | Why |
|---|---|
| Used `#10B981` for success | The brief had no success token; it substituted the CSS framework default. The product's real value was `#00B873`. |
| Invented `BrandLight`, `SuccessBg`, `WarningBg` | It needed tint backgrounds; the brief had none. The product deliberately has no `*Bg` tokens. |
| Drew a top tab bar as app chrome | Nothing told it the product has persistent navy side navigation. |
| Built a 4-column table with headers | The product's equivalent screens are drag-reorderable row lists. |
| Redrew every screen by hand | Pencil offers no instances, and nothing told it to build a base set first. |

Verification that only counted hex strings passed it. The Product Designer scored it **3/10**.

Running `conformance-audit.py` on the same file afterwards produced what the eye had already seen:

```text
[FAIL] Type scale:            56 off-scale (18% of 311)   9px x31, 13px x15, 28px x4, 15px x3
       largest ramp steps never used: [76, 24] -- headers hand-sized
[FAIL] Spacing (gaps):       105 off-scale (44% of 241)   6 x46, 2 x18, 1 x14, 10 x13
[FAIL] Spacing (padding):    171 off-scale (48% of 353)   10 x78, 6 x37, 20 x14
[FAIL] Colour token binding: 666 unbound (85% of 779)     0 token-bound vs 779 raw literals
```

Nearly half of every spacing decision in the file was freehand pixel-pushing, and the top of the type ramp was never touched — page titles were sized by hand at 18px where the product mandates 24px.

### The neutrals are where it actually died

The loud brand colours were **correct**. The quiet ones were Tailwind's defaults:

| Role | Product's value | What the design used | Nodes |
|---|---|---|---|
| text | `#0B1220` | `#0F172A` — Tailwind `slate-900` | 102 |
| muted | `#4D5870` | `#64748B` — Tailwind `slate-500` | 73 |
| border | `#DDE5EF` | `#E2E8F0` — Tailwind `slate-200` | 73 |
| canvas | `#F7F9FC` | `#F8FAFC` — Tailwind `slate-50` | 54 |
| brand | `#4648D8` | `#4648D8` ✓ | 137 |
| success | `#00B873` | `#00B873` ✓ | 63 |

**302 nodes wore near-miss Tailwind neutrals; 245 wore correct brand colours.** Spot-checking the brand palette passes the design; the neutrals are what cover the surface area and set the feel.

This is why the rejection said "looks like a generic dashboard" — it *was* wearing a generic dashboard's palette. Brand colours are distinctive, so agents remember to look them up. Neutrals are forgettable, so agents reach for the framework default that is 2–4 hex points away.

**Audit the neutrals before the brand colours.** A near-miss neutral is invisible in isolation and unmistakable in aggregate.

Every failure above traces to one root: **the design system reached the designer as a hand-typed summary instead of a mechanical extraction.**

## Rationalization Table

| Excuse | Reality |
|---|---|
| "The brief already lists the tokens" | Briefs are lossy copies. A brief listing 10 of 23 is worse than none — it looks authoritative. Verify against source. |
| "I only need one more colour" | That one colour is exactly where drift enters. Missing token = BLOCKED. |
| "It's the standard value for this framework" | The product overrode the framework. That override is the brand. |
| "Colours are all correct, so it's consistent" | Colour is vocabulary. Reviewers judge grammar: type, spacing, radius, shell, reuse. |
| "I checked the brand colours and they match" | Brand colours are the ones you remember to look up. Check the **neutrals** — text, muted, border, canvas. They cover more surface and drift to framework defaults 2-4 hex points away. |
| "Pencil has no components, so I must redraw" | Then build a base set and duplicate from it. The tool limits the mechanism, not the requirement. |
| "The shell isn't in scope for this screen" | The shell is what makes it recognisably this product. Always include the real one. |
| "It looks fine" / "design is clean" | Unmeasurable. Run the audit, paste counts. |
| "I'll match the design system as I go" | Extraction happens before the first node, not alongside it. |
| "Detaching the instance was faster" | Detaching destroys the link that makes it a system. Fix the component instead. |

## Red Flags — STOP

- About to type a colour literal into a shape
- About to pick a font size that "looks about right"
- Copying a token table from a brief without checking it against source
- Drawing a second copy of a unit that already exists
- Inventing a token name because the one you need is missing
- Detaching or deleting an instance to make something fit
- Writing "PASS" for a requirement you did not execute
- Reporting conformance without audit output

**All of these mean: stop, return to Step 1, extract from the truth source.**

## Regression Checklist

Before handing off:

- [ ] Truth source recorded, with paths/keys
- [ ] Token Manifest extracted mechanically, with a count
- [ ] Repeated UI is instances (Figma) or duplicated from a base set (Pencil)
- [ ] Type, spacing, radius all on-scale — audit output pasted
- [ ] Zero raw colour literals
- [ ] Real product shell, real menu labels
- [ ] Every screen screenshotted and actually looked at
- [ ] No detached instances left behind
- [ ] Known deviations listed with reasons
- [ ] "What I could not verify" section is non-empty

## Reporting

Every item backed by output pasted from the session:

1. Truth source chosen (Step 0) + exact paths/keys
2. Token Manifest with a count, and confirmation it came from extraction, not from the brief
3. Component reuse: what was instantiated vs newly created, and why each new one was justified
4. Conformance audit output (Step 6), verbatim
5. Deviations knowingly shipped, with reasons
6. **What you could not verify and why** — an empty section here invalidates the report

Do not write self-assessing summaries ("clean", "consistent", "PASS"). State what you ran and what it returned.
