<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## In-App Surface Radius System

Authenticated application UI follows the Portfolio page's semantic corner hierarchy. Reuse `Card` or `Panel` for primary surfaces and `APP_RADIUS` from `src/lib/ui-design.ts` when a raw element is necessary.

- `surface` / `rounded-2xl`: primary page cards, workspace widgets, tables, and empty-state containers.
- `nested` / `rounded-xl`: groups, rows, chart wells, and cards nested inside a primary surface.
- `control` / `rounded-lg`: inputs, compact buttons, tooltips, and other small controls.
- `overlay` / `rounded-3xl`: dialogs and large modal surfaces only.
- `pill` / `rounded-full`: chips, badges, segmented navigation, and pill actions.

Do not override the radius supplied by `Card` or `Panel` unless the element has a documented semantic reason to use another role. When adding a new route, verify its primary surfaces against Portfolio and update `tests/unit/uiDesign.test.ts` if the hierarchy changes intentionally.
