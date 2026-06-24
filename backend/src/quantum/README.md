# Quantum Module

## Purpose
Implements classical portfolio optimization and experimental quantum QAOA asset selection.

## Responsibilities
- Prepare returns and covariance inputs.
- Run constrained Markowitz optimization.
- Build QUBO matrices and execute QAOA selection.
- Return research-oriented allocation and probability outputs.

## Key Files
- `portfolio.py`: portfolio data preparation and classical/quantum entry points.
- `qaoa.py`: QUBO construction and PennyLane QAOA execution.

## Boundaries
Market history comes from existing data helpers. Entitlement enforcement and API transport belong in SaaS/agent/API layers.

## Testing
Use small deterministic frames. Cover weights summing to one, non-negative allocations, single-asset behavior, QUBO shape, and selection output.

## Latest Change
- Integrated portfolio optimization into the agent tool flow and shared progress reporting.
