"""Authenticated CRUD routes for user-controlled agent memory."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from src.auth.supabase import get_current_user
from src.models.memory import (
    MemoryCreateRequest,
    MemoryListResponse,
    MemorySettings,
    MemorySettingsUpdate,
    MemoryStatus,
    MemoryStatusFilter,
    MemoryUpdateRequest,
    UserMemory,
)
from src.saas.models import AuthenticatedUser
from src.services.user_memory import UserMemoryService

router = APIRouter(prefix="/api/v1/agent/memories", tags=["agent-memory"])


def _service() -> UserMemoryService:
    return UserMemoryService()


@router.get("", response_model=MemoryListResponse)
async def list_memories(
    memory_status: MemoryStatusFilter = Query(default="confirmed", alias="status"),
    session_id: str | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
):
    service = _service()
    return MemoryListResponse(
        memories=service.list_memories(
            str(user.id), status=memory_status, session_id=session_id
        ),
        settings=service.get_settings(str(user.id)),
    )


@router.get("/settings", response_model=MemorySettings)
async def get_memory_settings(
    user: AuthenticatedUser = Depends(get_current_user),
):
    return _service().get_settings(str(user.id))


@router.patch("/settings", response_model=MemorySettings)
async def update_memory_settings(
    payload: MemorySettingsUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return _service().set_enabled(str(user.id), payload.enabled)


@router.post("", response_model=UserMemory, status_code=status.HTTP_201_CREATED)
async def create_memory(
    payload: MemoryCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return _service().create_memory(str(user.id), payload)


@router.patch("/{memory_id}", response_model=UserMemory)
async def update_memory(
    memory_id: str,
    payload: MemoryUpdateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        memory = _service().update_memory(
            str(user.id),
            memory_id,
            label=payload.label,
            value_json=payload.value_json,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


def _set_status(
    memory_id: str, user: AuthenticatedUser, value: MemoryStatus
) -> UserMemory:
    memory = _service().set_status(str(user.id), memory_id, value)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found")
    return memory


@router.post("/{memory_id}/confirm", response_model=UserMemory)
async def confirm_memory(
    memory_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return _set_status(memory_id, user, MemoryStatus.CONFIRMED)


@router.post("/{memory_id}/reject", response_model=UserMemory)
async def reject_memory(
    memory_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return _set_status(memory_id, user, MemoryStatus.REJECTED)


@router.delete("/{memory_id}")
async def delete_memory(
    memory_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not _service().delete_memory(str(user.id), memory_id):
        raise HTTPException(status_code=404, detail="Memory not found")
    return {"status": "ok", "memory_id": memory_id}


@router.delete("")
async def clear_memories(
    user: AuthenticatedUser = Depends(get_current_user),
):
    return {"status": "ok", "deleted_count": _service().clear_memories(str(user.id))}
