# Agent Specialists Module

## Purpose
Defines the five QuanAd 2.0 specialist roles that produce structured opinions for consensus.

## Responsibilities
- Bind domain-appropriate existing tools.
- Convert LLM output into `AgentOpinion` records.
- Provide quant research, quant analysis, data science, portfolio, and risk perspectives.
- Degrade safely when tools or models fail.

## Key Files
- `base.py`: shared specialist execution and structured parsing.
- `quant_researcher.py`, `quant_analyst.py`, `data_scientist.py`, `portfolio_analytics.py`, `risk_analyst.py`: role definitions.

## Boundaries
Specialists should compose tools from `agent/tools.py` and calculations from domain modules. They must not create separate market, risk, prediction, or portfolio implementations.

## Testing
Mock LLM and tool outputs; cover structured parsing, fallback opinions, model disagreement, and risk-veto inputs.

## Latest Change
- Updated prediction-facing specialist behavior to consume the richer ensemble output, including model weights, validation metrics, agreement, confidence, and caveats.
