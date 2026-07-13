# Purposeful animation principles

Source inspiration: Emil Kowalski, [“You Don’t Need Animations”](https://emilkowal.ski/ui/you-dont-need-animations).

Use this reference as a decision framework, not as a mandate to remove all motion.

## Decision matrix

| Context | Default | Reason |
| --- | --- | --- |
| Keyboard navigation or repeated commands | No animation | Motion disconnects the state change from rapid input. |
| High-frequency workbench controls | Instant or 120 ms color feedback | Repetition turns delight into friction. |
| Button press | Brief scale or one-pixel translation | Confirms direct manipulation immediately. |
| Menu, popover, or dialog | 120–240 ms enter/exit | Prevents abrupt appearance while staying responsive. |
| Toast | 180–240 ms with consistent direction | Explains where it came from and supports dismissal direction. |
| Loading indicator | Fast, legible activity motion | Perceived speed matters even when actual latency is unchanged. |
| Marketing explanation | Purpose-dependent, may exceed 300 ms | Storytelling can justify slower sequencing. |
| Rare delight | Purpose-dependent | Surprise works when repetition is low. |

## Audit questions

For each motion, ask:

1. What does this help the user understand or feel?
2. How often will the same user encounter it?
3. Is the action driven by a keyboard or repeated rapidly?
4. Does motion make the interface feel faster or slower?
5. Are enter and exit directions spatially consistent?
6. Can opacity or transform express it without layout work?
7. Does reduced-motion mode preserve meaning and focus behavior?

If the first answer is unclear, remove the animation and compare. If the interaction is frequent or keyboard-driven, default to instant feedback.

## Timing guidance

- Press feedback: immediate while active; release promptly.
- Color and opacity feedback: 100–180 ms.
- Menus and popovers: 120–180 ms.
- Dialogs and sheets: 180–240 ms.
- Ordinary product UI: stay below 300 ms.
- Marketing and explanatory sequences: justify duration from content, not convention.

Do not slow a transition merely to make it noticeable. A user noticing the interface response matters more than noticing the animation.
