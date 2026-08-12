from datetime import datetime, timezone
from uuid import UUID

from src.saas.models import (
    HoldingRead,
    PortfolioBookTotal,
    PortfolioBooksRead,
    PortfolioRiskContext,
    PositionBook,
)


def build_portfolio_books(
    portfolio_id: UUID,
    base_currency: str,
    holdings: list[HoldingRead],
) -> PortfolioBooksRead:
    """Aggregate the position book using deterministic recorded cost basis."""

    exposures = {book: 0.0 for book in PositionBook}
    counts = {book: 0 for book in PositionBook}
    position_exposures: list[float] = []

    for holding in holdings:
        exposure = max(0.0, holding.quantity * holding.average_cost)
        exposures[holding.book_type] += exposure
        counts[holding.book_type] += 1
        position_exposures.append(exposure)

    total = sum(exposures.values())

    def weight(value: float) -> float:
        return round((value / total) * 100, 4) if total else 0.0

    books = [
        PortfolioBookTotal(
            book_type=book,
            holding_count=counts[book],
            cost_basis=round(exposures[book], 2),
            portfolio_weight=weight(exposures[book]),
        )
        for book in PositionBook
    ]

    return PortfolioBooksRead(
        portfolio_id=portfolio_id,
        base_currency=base_currency.upper(),
        as_of=datetime.now(timezone.utc),
        total_cost_basis=round(total, 2),
        books=books,
        risk=PortfolioRiskContext(
            gross_exposure=round(total, 2),
            largest_position_weight=weight(max(position_exposures, default=0.0)),
            investment_weight=weight(exposures[PositionBook.INVESTMENT]),
            trading_weight=weight(exposures[PositionBook.TRADING]),
            unclassified_weight=weight(exposures[PositionBook.UNCLASSIFIED]),
            unclassified_count=counts[PositionBook.UNCLASSIFIED],
        ),
    )
