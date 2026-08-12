import json
from io import BytesIO
from urllib.error import HTTPError
from uuid import uuid4

import pytest

from src.saas import repository
from src.saas.models import RecurringBuyCreate
from src.saas.repository import SupabaseRestStore, SupabaseSchemaUnavailableError


def _postgrest_error(table: str, code: str = "PGRST205") -> HTTPError:
    payload = {
        "code": code,
        "message": f"Could not find the table 'public.{table}' in the schema cache",
    }
    return HTTPError(
        url=f"https://example.supabase.co/rest/v1/{table}",
        code=404,
        msg="Not Found",
        hdrs=None,
        fp=BytesIO(json.dumps(payload).encode("utf-8")),
    )


def test_supabase_request_maps_missing_relation_to_schema_error(monkeypatch):
    table = "portfolio_recurring_buys"

    def missing_relation(*args, **kwargs):
        raise _postgrest_error(table)

    monkeypatch.setattr(repository, "urlopen", missing_relation)
    supabase = SupabaseRestStore("https://example.supabase.co", "service-role-key")

    with pytest.raises(SupabaseSchemaUnavailableError, match=table):
        supabase._request("GET", table, {"select": "*"})


def test_supabase_request_preserves_unrelated_not_found_errors(monkeypatch):
    table = "portfolio_recurring_buys"

    def unrelated_not_found(*args, **kwargs):
        payload = {"code": "PGRST116", "message": "The result contains 0 rows"}
        raise HTTPError(
            url=f"https://example.supabase.co/rest/v1/{table}",
            code=404,
            msg="Not Found",
            hdrs=None,
            fp=BytesIO(json.dumps(payload).encode("utf-8")),
        )

    monkeypatch.setattr(repository, "urlopen", unrelated_not_found)
    supabase = SupabaseRestStore("https://example.supabase.co", "service-role-key")

    with pytest.raises(HTTPError) as error:
        supabase._request("GET", table, {"select": "*"})

    assert json.loads(error.value.read())["code"] == "PGRST116"


def test_recurring_buy_list_is_empty_when_optional_schema_is_unavailable(monkeypatch):
    supabase = SupabaseRestStore("https://example.supabase.co", "service-role-key")
    monkeypatch.setattr(
        supabase, "get_portfolio", lambda user_id, portfolio_id: object()
    )
    monkeypatch.setattr(
        supabase,
        "_request",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            SupabaseSchemaUnavailableError("portfolio_recurring_buys")
        ),
    )

    assert supabase.list_recurring_buys(uuid4(), uuid4()) == []


def test_recurring_buy_create_checks_schema_before_syncing_holding(monkeypatch):
    supabase = SupabaseRestStore("https://example.supabase.co", "service-role-key")
    monkeypatch.setattr(
        supabase, "get_portfolio", lambda user_id, portfolio_id: object()
    )
    monkeypatch.setattr(
        supabase,
        "_request",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            SupabaseSchemaUnavailableError("portfolio_recurring_buys")
        ),
    )
    holding_sync_attempted = False

    def sync_holding(*args, **kwargs):
        nonlocal holding_sync_attempted
        holding_sync_attempted = True

    monkeypatch.setattr(supabase, "_sync_holding_for_recurring_buy", sync_holding)

    with pytest.raises(SupabaseSchemaUnavailableError):
        supabase.add_recurring_buy(
            uuid4(),
            uuid4(),
            RecurringBuyCreate(
                symbol="AMD",
                entered_amount=100,
                filled_quantity=1,
                fill_price=100,
            ),
        )

    assert holding_sync_attempted is False
