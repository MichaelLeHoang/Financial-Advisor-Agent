from src.investment_policy.models import (
    InvestmentPolicyAlert,
    InvestmentPolicyRead,
    InvestmentPolicyValidationRead,
    InvestmentPolicyScopeValidationRead,
)
from src.saas.models import HoldingRead, PositionBook


def _policy_alerts(
    policy: InvestmentPolicyRead,
    holdings_by_portfolio: list[tuple[object, list[HoldingRead]]],
) -> list[InvestmentPolicyAlert]:
    alerts: list[InvestmentPolicyAlert] = []
    rows = [(portfolio_id, holding) for portfolio_id, holdings in holdings_by_portfolio for holding in holdings]
    investment_rows = [row for row in rows if row[1].book_type == PositionBook.INVESTMENT]
    exposures = {
        holding.id: max(0.0, holding.quantity * holding.average_cost)
        for _, holding in investment_rows
    }
    total_exposure = sum(exposures.values())

    allocation_total = sum(policy.target_allocation.values())
    if policy.target_allocation and abs(allocation_total - 100) > 0.01:
        alerts.append(InvestmentPolicyAlert(
            code="target_allocation_total",
            severity="breach",
            message="Target allocation must total 100%.",
            observed=round(allocation_total, 4),
            limit=100,
        ))

    for portfolio_id, holding in rows:
        if holding.book_type == PositionBook.UNCLASSIFIED:
            alerts.append(InvestmentPolicyAlert(
                code="unclassified_position",
                severity="warning",
                message=f"{holding.symbol} needs an owner-confirmed book before investment policy can apply.",
                symbol=holding.symbol,
                portfolio_ids=[portfolio_id],
                holding_ids=[holding.id],
            ))

    symbols: dict[str, list[tuple[object, HoldingRead]]] = {}
    for portfolio_id, holding in investment_rows:
        symbols.setdefault(holding.symbol.upper(), []).append((portfolio_id, holding))

    for symbol, symbol_rows in symbols.items():
        symbol_exposure = sum(exposures[holding.id] for _, holding in symbol_rows)
        weight = (symbol_exposure / total_exposure) * 100 if total_exposure else 0
        portfolio_ids = list(dict.fromkeys(portfolio_id for portfolio_id, _ in symbol_rows))
        holding_ids = [holding.id for _, holding in symbol_rows]
        if weight > policy.max_position_weight:
            alerts.append(InvestmentPolicyAlert(
                code="max_position_weight",
                severity="breach",
                message=f"{symbol} exceeds the maximum position weight.",
                symbol=symbol,
                observed=round(weight, 4),
                limit=policy.max_position_weight,
                portfolio_ids=portfolio_ids,
                holding_ids=holding_ids,
            ))
        disallowed = next((holding for _, holding in symbol_rows if policy.permitted_assets and holding.asset_type.lower() not in policy.permitted_assets), None)
        if disallowed:
            alerts.append(InvestmentPolicyAlert(
                code="asset_not_permitted",
                severity="breach",
                message=f"{symbol} uses an asset type not permitted by policy.",
                symbol=symbol,
                portfolio_ids=portfolio_ids,
                holding_ids=holding_ids,
            ))

    if total_exposure:
        cash_exposure = sum(
            exposures[holding.id]
            for _, holding in investment_rows
            if holding.asset_type.lower() == "cash" or holding.symbol.upper() in {"CASH", "USD", "CAD"}
        )
        cash_weight = (cash_exposure / total_exposure) * 100
        if cash_weight < policy.minimum_cash_weight:
            alerts.append(InvestmentPolicyAlert(
                code="minimum_cash_weight",
                severity="breach",
                message="Recorded Investment cash is below the policy minimum.",
                observed=round(cash_weight, 4),
                limit=policy.minimum_cash_weight,
            ))
    return alerts


def validate_investment_policy(
    policy: InvestmentPolicyRead,
    portfolio_id,
    holdings: list[HoldingRead],
) -> InvestmentPolicyValidationRead:
    """Validate one portfolio using Investment-book cost-basis facts only."""

    alerts = _policy_alerts(policy, [(portfolio_id, holdings)])

    return InvestmentPolicyValidationRead(
        policy_id=policy.id,
        portfolio_id=portfolio_id,
        compliant=not any(alert.severity == "breach" for alert in alerts),
        alerts=alerts,
    )


def validate_investment_policy_scope(
    policy: InvestmentPolicyRead,
    holdings_by_portfolio: list[tuple[object, list[HoldingRead]]],
) -> InvestmentPolicyScopeValidationRead:
    """Validate an owner-selected set of Investment portfolios as one scope."""

    portfolio_ids = [portfolio_id for portfolio_id, _ in holdings_by_portfolio]
    alerts = _policy_alerts(policy, holdings_by_portfolio)
    return InvestmentPolicyScopeValidationRead(
        policy_id=policy.id,
        portfolio_ids=portfolio_ids,
        compliant=not any(alert.severity == "breach" for alert in alerts),
        alerts=alerts,
    )
