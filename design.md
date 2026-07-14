# Quanfora design system

This document is the visual and interaction contract for Quanfora's marketing
site and signed-in product. It is based on the two strongest current references:

- The landing page establishes the brand: quiet, capable, technical, and
  evidence-first.
- The Investment Portfolio page establishes the application experience: dense
  but calm, decision-oriented, and designed around trustworthy financial data.

The goal is one system with two modes, not two unrelated visual languages.
Marketing may use more atmosphere and editorial scale; the application must
prioritize scanability, comparability, and clear next actions.

## Design principles

1. **Confidence without noise.** Use a nearly black base, restrained contrast,
   thin borders, and deliberate type. Avoid decorative gradients, excessive
   glass, or several competing accent colors in one view.
2. **Evidence before persuasion.** Surface the value, date, scope, benchmark,
   and caveat close to the financial claim they qualify. Do not use color alone
   to communicate status or performance.
3. **Progressive disclosure.** A page should start with the essential decision
   frame, then expose detail through sections, drawers, and linked views.
4. **One clear primary action.** Each page or panel has at most one visually
   dominant action. Supporting actions are quiet outlines, text links, or icon
   controls.
5. **Calm density.** Use whitespace and hierarchy to group data instead of
   hiding all information behind cards. Prefer rows, dividers, and aligned
   values for comparable financial data.
6. **Theme-safe by default.** Components consume semantic tokens, never bake in
   dark-mode colors, except intentionally landing-only artwork.

## Foundations

### Color and semantic tokens

`frontend/src/app/globals.css` is the implementation source of truth. It
already provides the tokens below for Deep Space (default) and White themes.
New UI must use these semantic values instead of raw white, black, or gray
utilities.

| Purpose | Token | Deep Space intent | White theme intent |
| --- | --- | --- | --- |
| Page canvas | `--background` | near-black `#07080b` | warm off-white `#f7f5f2` |
| Primary text | `--text-primary` | 92% white | ink `#121a2c` |
| Supporting text | `--text-secondary`, `--text-muted`, `--text-subtle` | descending white opacity | dark slate to muted gray |
| Standard border | `--theme-border` | low-contrast white | warm gray |
| Strong border / control | `--theme-border-strong` | visible white | pale indigo |
| Card | `--surface-card` | translucent white surface | near-white |
| Hovered card / row | `--surface-card-hover` | brighter translucent white | soft warm gray |
| Selected control | `--surface-selected` | white tint | pale indigo |
| Controls / popovers | `--surface-control`, `--surface-popover`, `--surface-dialog` | dark elevated surfaces | white elevated surfaces |
| Brand | `--color-indigo-primary` | `#6366f1` | `#4f46e5` |
| Secondary accent | `--color-cyan-secondary` | `#22d3ee` | indigo-adjacent |
| Positive / negative / warning | `--color-green-positive`, `--color-red-negative`, `--color-amber-warning` | emerald / coral / amber | accessible darker equivalents |

Use `--background` for page canvas. Existing occurrences of
`bg-[var(--theme-bg)]` are a migration issue: `--theme-bg` is not currently a
defined token. New work should not extend that pattern.

### Brand color behavior

- **Indigo** is the product identity: key focus rings, primary app actions,
  selected navigation, and intentionally featured research/product moments.
- In-app primary action surfaces are solid indigo/purple with no gradient or
  glow. The Crimson theme resolves the same semantic action surface to solid
  red. Hover feedback may adjust the solid color slightly, but must not add a
  gradient or luminous shadow.
- **Cyan** is a supporting analytical accent: secondary data visualization or
  a single adjacent highlight, never a second primary CTA.
- **Emerald, rose, and amber** are semantic. In investment UI they describe
  gains/healthy states, losses/breaches, and attention/review respectively.
  Pair each with an icon, label, sign, or explanatory text.
- The landing page may use indigo/cyan glow softly. In-app surfaces should
  remain flatter; reserve glow for focused primary actions, popovers, and
  deliberate premium states.

### Typography

The application loads these fonts in `frontend/src/app/layout.tsx`:

| Role | Font token | Use |
| --- | --- | --- |
| Body and data | `font-sans` / Inter | body copy, tables, forms, values |
| Headings | `font-heading` / Geist | page titles, section titles, prominent value statements |
| Labels and controls | `font-label` / Hanken Grotesk | buttons, nav, tabs, menu items, compact labels |

- Landing hero: editorial and spacious; `2.5rem` to `4.5rem`, normal weight,
  tight tracking, short lines.
- App page title: `text-2xl` on compact pages or `text-3xl sm:text-4xl` in the
  standard workspace header, semibold.
- Section title: `text-xl` or `text-lg`, semibold. Panel title: `text-sm` to
  `text-base`, semibold.
- Body: `text-sm` with `leading-6` where explanation is needed. Metadata and
  table support text: `text-xs`.
- Financial amounts use `tabular-nums`; preserve the explicit sign for changes
  and align comparable values to the end of a row.

### Shape, spacing, and elevation

- Base spacing follows the Tailwind 4px scale. Default panel padding is `p-5`;
  page spacing is `px-4 py-5` on small screens and `lg:px-7` to `lg:px-10` on
  desktop.
- Application content is capped at `1500px` to `1680px`, depending on whether
  the page contains a dense analysis layout. Landing sections use wider,
  editorial containers up to `1360px` or `max-w-7xl`.
- Standard app cards and panels use a modest `rounded-lg`. Menus, dialogs, and
  form controls may use `rounded-xl` or `rounded-2xl`; reserve `rounded-3xl`
  and large radii for overlays.
- Use `--shadow-card`, `--shadow-control`, `--shadow-popover`, and
  `--shadow-dialog` rather than new custom shadows. Borders create most of the
  structure; shadows communicate elevation only. Elevation shadows must remain
  neutral black/slate; do not tint them indigo, cyan, emerald, or red. Brand
  marks, selected navigation, status dots, controls, and primary actions must
  not use glow shadows.

## Component rules

### Page shell and hierarchy

Use the shared `WorkspacePage` in `frontend/src/components/workspace/WorkspaceUI.tsx`
when its standard header fits. Custom investment pages should keep its visual
contract: page canvas, centered max width, title and context at the top,
actions aligned to the right on large screens, then content separated by a
clear vertical rhythm.

For a decision dashboard such as Investment Portfolio:

1. Page title, freshness/scope, and actions.
2. Primary financial outcome and its chart or evidence.
3. Small supporting insights and an actionable review rail.
4. Detailed accounts, positions, activity, or research below divider-led
   sections.

Do not place every group inside a card. The investment page deliberately gives
the primary performance chart open canvas space and uses cards for independent
side panels and comparable summaries.

### Actions

- **Primary:** one per context. Solid white with black text is the default
  Deep Space app treatment used for decisive actions such as “Run review”.
  Use the `theme-primary-action` family when a branded indigo primary is the
  intended product pattern. Use `theme-accent-surface` for the shared solid
  theme-colored treatment. In Deep Space and White it resolves to purple; in
  Crimson it resolves to red. These action treatments must not use gradients
  or glow shadows.
- **Secondary:** border `--theme-border-strong`, transparent or control
  surface, normal text color. Use for navigation or non-destructive choices.
- **Tertiary:** text/arrow treatment, often emerald for a positive drill-down
  in investment contexts. It must remain clearly interactive on hover and
  focus.
- **Icon button:** 40px circular target for header utilities; include an
  accessible name through visible text, `aria-label`, or `title`.
- Do not use a bright treatment for both “connect” and “run” actions in the
  same header. The priority must be legible at a glance.

### Panels, rows, and metrics

- Standard panel: `border-[var(--theme-border)] bg-[var(--surface-card)] p-5`.
  Use `Panel` when possible.
- Panel header: title plus concise metadata or a single trailing utility.
- Dense lists use `divide-y divide-[var(--theme-border)]`; rows have generous
  vertical padding (`py-4`) and a soft hover surface, not heavy individual
  card outlines.
- Metric cards contain a small number of decision-relevant facts (normally
  three). Labels are muted; values are semibold and tabular when numeric.
- Empty states use a dashed border, a plain explanation, and one recovery
  action. Loading and error states occupy the same visual region as the
  content they replace.

### Inputs, menus, and selection

- Controls use semantic surfaces and existing primitives from
  `frontend/src/components/ui/` (`Button`, `Input`, `Textarea`,
  `WorkspaceSelectMenu`, `DropdownMenu`). Extend these before creating a page
  local variant.
- Selection has a quiet filled pill or selected surface; use `aria-pressed`,
  `aria-selected`, or native state as appropriate.
- Compact time-range controls are pill groups. Larger information
  architectures use underline tabs, as in Strategy Studio. Do not mix the two
  patterns within one control.
- Slider and progress tracks use a single solid semantic series color for the
  completed portion. Do not blend indigo into cyan or add a glow to the thumb.
- Menus and dialogs elevate above the page with semantic popover/dialog tokens
  and a clear focus ring.

### Data visualization

- Chart color conveys series identity, not only performance. Investment
  Portfolio uses emerald for the portfolio and slate for its benchmark; keep
  the legend adjacent to the chart.
- Prefer one emphasized series plus muted comparison series. Avoid rainbow
  palettes.
- Provide formatted axes, labeled tooltips, and an empty state. Respect privacy
  mode in every chart value and tooltip.
- Every metric needs its scope/timeframe nearby: for example, “past 1M”,
  “estimated”, “vs SPY”, or “updated 4m ago”.

### Status and financial meaning

| Meaning | Color | Required non-color cue |
| --- | --- | --- |
| Positive / healthy | emerald | plus sign, “Healthy”, or check icon |
| Negative / breach | rose | minus sign, “Breach”, or alert icon |
| Needs attention | amber | “Review”, “Needs review”, or warning icon |
| Informational | sky/cyan or muted text | explicit label or information icon |

Performance color must reflect the signed value. Never color a raw price as a
gain/loss unless the context makes the comparison explicit.

## Responsive and accessibility requirements

- Start with one column. Introduce a second rail at `xl` only when its minimum
  useful width is preserved (the investment page uses a 340px minimum rail).
- Keep controls horizontally scrollable when a compact set will not wrap
  cleanly, such as performance ranges. Do not shrink text below `text-xs` to
  force fit.
- Preserve a minimum 40px target for standalone icon controls and 44px for
  primary touch actions where practical.
- Use semantic landmarks, named tabs, `aria-pressed` for toggles, focus-visible
  rings, and keyboard-operable menus/drawers.
- Honor `prefers-reduced-motion`. Existing global CSS reduces motion, and
  Motion components should use `useReducedMotion` before adding substantial
  movement.
- Motion is feedback, not decoration: 120ms for small state changes, 180ms for
  normal UI transitions, and about 220ms for overlays. Use the shared motion
  tokens and the existing ease-out curve.

## Landing-to-app translation

| Landing page cue | In-app interpretation |
| --- | --- |
| Near-black, restrained indigo identity | Semantic dark surfaces with indigo for focus/primary product moments |
| Large editorial hierarchy | Compact but decisive page title and primary portfolio value |
| Rounded primary/secondary CTAs | Clear one-primary action hierarchy with the same rounded control language |
| Thin white borders and quiet panels | Tokenized borders/surfaces, divider-led financial lists |
| Product preview’s layered depth | Elevation only for drawers, dialogs, menus, and key feature moments |
| Purposeful reveal and hover motion | Brief feedback on state changes; no continuous or distracting app motion |

## Adoption rules

1. Add or adjust a semantic token in `globals.css` when a visual concept is
   reused across components. Do not solve shared needs with page-local hex
   values.
2. Reuse or extend primitives in `frontend/src/components/ui/` and
   `WorkspaceUI.tsx` before adding a duplicate control or panel.
3. Build and verify both Deep Space and White themes for every shared component.
4. For finance-facing UI, verify loading, empty, error, privacy, positive,
   negative, and warning states—not just the happy path.
5. Treat the landing page as brand direction and Investment Portfolio as the
   default reference for signed-in financial work. A new page may depart only
   when its task demands it, and should document the reason in its component or
   pull request.

## Source references

- `frontend/src/app/globals.css` — tokens, theme overrides, motion, and shared
  utility classes.
- `frontend/src/app/layout.tsx` — font loading, theme application, reduced
  motion configuration.
- `frontend/src/app/introduction/` — landing brand, editorial hierarchy, CTA
  language, and promotional motion.
- `frontend/src/app/invest/page.tsx` — default in-app financial dashboard
  composition, data density, review rail, chart, and status treatment.
- `frontend/src/components/workspace/WorkspaceUI.tsx` — reusable signed-in
  page, panel, metric, status, and action building blocks.
