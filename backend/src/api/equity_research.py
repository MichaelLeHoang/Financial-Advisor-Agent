from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import StreamingResponse

from src.agent.equity_research.orchestrator import (
    create_research_run,
    get_research_store,
)
from src.auth.supabase import get_current_or_guest_user
from src.models.equity_research import (
    EquityResearchRun,
    EquityResearchRunCreate,
    EquityResearchRunDetail,
    EquityResearchShareUpdate,
    PublicEquityResearchReport,
    ResearchRunStatus,
)
from src.saas.models import AuthenticatedUser

router = APIRouter(prefix="/api/v1/equity-research", tags=["equity-research"])
GUEST_SESSION_HEADER = "X-Guest-Session-Id"


def _normalize_guest_owner_id(value: str | None) -> str | None:
    normalized = value.strip() if value else None
    if not normalized:
        return None
    return normalized[:128]


def _can_access(
    detail: EquityResearchRunDetail,
    user: AuthenticatedUser,
    guest_owner_id: str | None = None,
) -> bool:
    run = detail.run
    if run.user_id is None:
        return (
            user.is_guest
            and bool(run.guest_owner_id)
            and run.guest_owner_id == guest_owner_id
        )
    return run.user_id == user.id


def _get_detail_or_404(
    run_id: UUID, user: AuthenticatedUser, guest_owner_id: str | None = None
) -> EquityResearchRunDetail:
    detail = get_research_store().detail(run_id)
    if detail is None or not _can_access(detail, user, guest_owner_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    return detail


@router.post("/runs", response_model=EquityResearchRun)
async def create_run(
    payload: EquityResearchRunCreate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    guest_owner_id = _normalize_guest_owner_id(x_guest_session_id)
    if user.is_guest and guest_owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Guest session id is required.",
        )
    return await create_research_run(payload, user, guest_owner_id=guest_owner_id)


@router.get("/runs/{run_id}", response_model=EquityResearchRunDetail)
async def get_run(
    run_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    return _get_detail_or_404(
        run_id, user, _normalize_guest_owner_id(x_guest_session_id)
    )


@router.get("/runs/{run_id}/reports")
async def get_reports(
    run_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    _get_detail_or_404(run_id, user, _normalize_guest_owner_id(x_guest_session_id))
    reports = get_research_store().list_reports(run_id)
    if reports is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    return reports


@router.get("/runs/{run_id}/events/list")
async def list_events(
    run_id: UUID,
    after: int = 0,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    _get_detail_or_404(run_id, user, _normalize_guest_owner_id(x_guest_session_id))
    result = get_research_store().list_events(run_id, after=max(after, 0))
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    cursor, events = result
    return {"cursor": cursor, "events": events}


@router.get("/runs/{run_id}/events")
async def stream_events(
    run_id: UUID,
    after: int = 0,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    guest_owner_id = _normalize_guest_owner_id(x_guest_session_id)
    _get_detail_or_404(run_id, user, guest_owner_id)

    async def event_stream():
        cursor = max(after, 0)
        while True:
            detail = _get_detail_or_404(run_id, user, guest_owner_id)
            result = get_research_store().list_events(run_id, after=cursor)
            if result is None:
                yield 'event: error\ndata: {"detail":"Research run not found"}\n\n'
                return
            next_cursor, events = result
            first_sequence = next_cursor - len(events) + 1
            for offset, event in enumerate(events):
                sequence = first_sequence + offset
                yield f"id: {sequence}\nevent: {event.event_type.value}\ndata: {event.model_dump_json()}\n\n"
                cursor = sequence
            cursor = max(cursor, next_cursor)
            if (
                detail.run.status
                in {
                    ResearchRunStatus.COMPLETED,
                    ResearchRunStatus.FAILED,
                    ResearchRunStatus.CANCELLED,
                }
                and not events
            ):
                return
            await asyncio.sleep(0.75)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.patch("/runs/{run_id}/share", response_model=EquityResearchRun)
async def share_run(
    run_id: UUID,
    payload: EquityResearchShareUpdate,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    detail = _get_detail_or_404(
        run_id, user, _normalize_guest_owner_id(x_guest_session_id)
    )
    if detail.run.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sign in to share saved reports.",
        )
    if detail.run.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    run = get_research_store().share(run_id, payload.shared)
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    return run


@router.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_run(
    run_id: UUID,
    user: AuthenticatedUser = Depends(get_current_or_guest_user),
    x_guest_session_id: str | None = Header(default=None, alias=GUEST_SESSION_HEADER),
):
    detail = _get_detail_or_404(
        run_id, user, _normalize_guest_owner_id(x_guest_session_id)
    )
    if detail.run.user_id is not None and detail.run.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    if not get_research_store().delete_run(run_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Research run not found"
        )
    return None


@router.get("/shared/{share_slug}", response_model=PublicEquityResearchReport)
async def get_shared_report(share_slug: str):
    detail = get_research_store().get_shared(share_slug)
    if detail is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Shared report not found"
        )
    return PublicEquityResearchReport(
        run=detail.run,
        reports=detail.reports,
        snapshot=detail.snapshot,
        decision_workspace=detail.decision_workspace,
        overview=detail.overview,
    )
