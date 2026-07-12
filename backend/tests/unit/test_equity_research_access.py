from datetime import date
from uuid import uuid4

from src.api.equity_research import _can_access
from src.models.equity_research import EquityResearchRun, EquityResearchRunDetail
from src.saas.models import AuthenticatedUser, Plan


def _user(user_id=None, *, is_guest=False):
    return AuthenticatedUser(
        id=user_id or uuid4(),
        email=None if is_guest else "user@example.com",
        plan=Plan.FREE,
        is_guest=is_guest,
    )


def _detail(owner_id, *, guest_owner_id=None, share_slug=None):
    return EquityResearchRunDetail(
        run=EquityResearchRun(
            user_id=owner_id,
            guest_owner_id=guest_owner_id,
            ticker="AAPL",
            analysis_date=date.today(),
            share_slug=share_slug,
        )
    )


def test_shared_slug_does_not_grant_run_endpoint_access_to_other_user():
    owner_id = uuid4()
    other = _user()

    assert _can_access(_detail(owner_id, share_slug="aapl-shared"), other) is False


def test_owner_can_access_own_research_run():
    owner = _user()

    assert _can_access(_detail(owner.id, share_slug="aapl-shared"), owner) is True


def test_guest_created_research_run_stays_guest_accessible():
    guest = _user(is_guest=True)

    assert _can_access(_detail(None, guest_owner_id="guest-session-1"), guest, "guest-session-1") is True


def test_guest_research_run_requires_matching_guest_owner_token():
    guest = _user(is_guest=True)

    assert _can_access(_detail(None, guest_owner_id="guest-session-1"), guest, "guest-session-2") is False
    assert _can_access(_detail(None, guest_owner_id="guest-session-1"), guest, None) is False


def test_authenticated_user_cannot_access_guest_research_run_by_id():
    signed_in = _user()

    assert _can_access(_detail(None, guest_owner_id="guest-session-1"), signed_in, "guest-session-1") is False
