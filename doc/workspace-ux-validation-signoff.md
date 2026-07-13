# Workspace UX Validation Sign-Off

## Status

- **Decision:** Approved for Stage B functional implementation
- **Validated:** 2026-07-13
- **Branch:** `feature/investment-trading-workspaces`
- **Boundary:** Approval covers interaction models and responsive behavior, not fixture accuracy or backend persistence.

## Approved Workflows

| Area | Decision | Evidence |
|---|---|---|
| Public entry and onboarding | Approved | Safe internal destinations, first-time preference flow, skip, and return routing are covered by browser tests. |
| Authenticated navigation | Approved | Global and workspace navigation remain usable across desktop, tablet, and mobile. Legacy destinations resolve to canonical workspace routes. |
| Unified Home | Approved | Investment Book, Trading Book, attention, and continuation entry points establish the shared command-center model. |
| Investment slice | Approved | Classification, thesis, policy check, reversible decision review, and Journal recording form one understandable sequence. |
| Trading slice | Approved | Symbol selection, timeframe, risk sizing, stateful desk views, focus-trapped paper review, simulated fill, and Journal recording are coherent. |
| Strategy Studio | Approved | Mode selection, nested rules, deterministic validation, accepted or dismissed proposals, undo/redo, versions, Backtest Lab handoff, and paper approval are inspectable. |
| Responsive behavior | Approved | Playwright covers 1440px desktop, 1024px tablet, and iPhone mobile layouts without document overflow. |
| Accessibility foundation | Approved for prototype | Consequential dialogs trap and restore focus, custom tabs support arrow keys, controls expose state, and reduced-motion overrides are present. |
| Theme parity | Approved for prototype | Primary authenticated workflows remain available under Deep Space and White themes. |

## Decisions Locked For Stage B

- Keep one global application with Invest and Trade as focused workspaces.
- Keep the horizontal workspace subnavigation and stacked mobile Studio panels.
- Preserve deterministic policy, sizing, validation, and execution checks outside LLM reasoning.
- Require explicit acceptance for Architect changes and explicit confirmation for paper or future live execution.
- Use the unified Decision Journal for investment, trading, and strategy events.
- Reuse the current Backtest Lab through typed adapters while the versioned strategy engine is developed.
- Continue scoping prototype browser state by authenticated user or the explicit guest namespace.

## Deferred Functionality

The following items are intentionally not implied by this sign-off:

- Persistent onboarding preferences and route guards backed by Supabase.
- Shared Investment, Trading, and Unclassified portfolio books.
- Persistent policies, theses, trade plans, strategies, versions, deployments, and Journal events.
- Live Strategy Architect LLM tools or autonomous strategy execution.
- Paper schedulers, signal generation, broker connections, or live orders.
- Production market-data accuracy, brokerage reconciliation, analytics, observability, and release monitoring.

These items move through Phases 7-15 and must retain the approved interaction and safety boundaries.

## Validation Commands

```text
cd frontend && npx tsc --noEmit
cd frontend && npm run test:e2e
cd frontend && npm run build
git diff --check
```

The frontend suite includes first-time and returning entry flows, investor and trader workflows, Strategy Studio, canonical redirects, keyboard navigation, reduced motion, light theme, and responsive viewport containment.
