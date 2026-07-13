---
name: purposeful-ui-animation
description: Audit, design, implement, or review interface animation so motion is purposeful, fast, accessible, and appropriate to interaction frequency. Use for UI motion, transitions, micro-interactions, hover or press feedback, dialogs, menus, toasts, loading indicators, page or list reveals, keyboard-driven interfaces, reduced-motion support, and requests to remove excessive or sluggish animation in web or native apps.
---

# Purposeful UI Animation

Use motion to explain state, preserve spatial continuity, acknowledge direct manipulation, or add rare delight. Prefer an instant state change when motion does not materially help the user.

Read [principles.md](references/principles.md) before auditing or changing an interface.

## Workflow

1. Inventory animations, transitions, loading motion, and state changes. Include CSS, framework animation APIs, component-library defaults, and SVG/canvas motion.
2. Identify the trigger and expected frequency for each motion: pointer, touch, keyboard, system event, navigation, or passive storytelling.
3. Write a one-line purpose for every animation. Remove it if the purpose is only “make it feel polished” and the interaction is frequent.
4. Classify the surface:
   - Keep explanatory or spatial motion when it makes the result easier to understand.
   - Use immediate press feedback for direct manipulation.
   - Make high-frequency and keyboard-driven state changes instant.
   - Reserve expressive sequencing for rare or marketing experiences.
5. Implement the smallest motion that serves the purpose. Prefer opacity and transform; avoid layout-heavy properties unless spatial continuity requires them.
6. Keep ordinary product UI motion under 300 ms. Start at 120–180 ms for controls and 180–240 ms for overlays. Treat 300 ms as a ceiling, not a target.
7. Preserve direction between enter and exit when it communicates origin or dismissal direction.
8. Support `prefers-reduced-motion` and ensure the final state remains understandable with motion disabled.
9. Test pointer, touch, keyboard, repeated use, slow devices, interrupted transitions, and reduced-motion mode.

## Implementation Rules

- Scope transitions to the properties that change. Avoid `transition: all` when explicit properties are practical.
- Do not delay keyboard highlights, roving focus, command palettes, tab changes, or inline editing.
- Do not stagger frequently updated lists or workbench results.
- Use short press feedback such as a slight scale or one-pixel translation only while the control is actively pressed.
- Animate loading indicators continuously only when they communicate ongoing work. Do not add decorative infinite motion to application chrome.
- Let toasts enter and leave from a consistent direction so swipe-to-dismiss behavior feels spatially coherent.
- Avoid blur on frequently mounted application content; it adds visual latency and rendering cost.
- Preserve slower animation on storytelling surfaces only when it explains the product or creates infrequent delight.
- Do not introduce an animation dependency when CSS or the existing stack can express the behavior clearly.

## Handoff

Report:

- which motion was removed, shortened, or retained;
- the purpose of retained motion;
- how keyboard and reduced-motion behavior were verified;
- any intentionally slower marketing or explanatory sequence.
