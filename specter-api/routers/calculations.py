"""
Tool calculations — saved free-tool reports (Workspace persistence).

Routes (no plan gate — available to every plan incl. `free`):
  GET    /calculations            — list this merchant's saved calculations
  POST   /calculations            — save a new calculation
  GET    /calculations/{id}       — fetch one (to reload into a tool)
  PATCH  /calculations/{id}       — rename / re-save / archive
  DELETE /calculations/{id}       — permanently delete

Every row is scoped to the authenticated merchant; cross-merchant access
returns 404 (never leak existence). `inputs`/`results` are opaque per-tool
JSON blobs — this surface does not interpret them.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.supabase import get_current_merchant
from db import get_db
from models.merchants import Merchant
from models.tool_calculations import ToolCalculation

router = APIRouter(prefix="/calculations", tags=["calculations"])

# Hard ceiling on saved calculations per merchant. This surface is open to every
# plan (incl. `free`), so without a cap a single account could write unbounded
# rows — a cheap storage/DoS abuse vector at scale. The limit is generous enough
# that a real Workspace user never hits it; archived rows still count (they're
# the same storage). Soft-delete or delete to free room.
MAX_CALCULATIONS_PER_MERCHANT = 500


# ── Schemas ──────────────────────────────────────────────────────────────────

class CalculationCreate(BaseModel):
    tool_name: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    inputs: dict[str, Any]
    results: dict[str, Any]
    currency: Optional[str] = Field(default=None, max_length=8)


class CalculationPatch(BaseModel):
    """All fields optional — only provided fields are updated. `archived`
    toggles the soft-archive flag (True → set archived_at=now, False → clear)."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    inputs: Optional[dict[str, Any]] = None
    results: Optional[dict[str, Any]] = None
    currency: Optional[str] = Field(default=None, max_length=8)
    archived: Optional[bool] = None


class CalculationOut(BaseModel):
    id: uuid.UUID
    tool_name: str
    name: str
    inputs: dict[str, Any]
    results: dict[str, Any]
    currency: Optional[str]
    archived: bool
    created_at: str


# ── Pure serializer (unit-tested without a DB) ────────────────────────────────

def to_out(calc: ToolCalculation) -> CalculationOut:
    """Map a ToolCalculation row to its API shape. Reads attributes only, so
    plain objects (e.g. SimpleNamespace) work in tests."""
    return CalculationOut(
        id=calc.id,
        tool_name=calc.tool_name,
        name=calc.name,
        inputs=calc.inputs,
        results=calc.results,
        currency=calc.currency,
        archived=calc.archived_at is not None,
        created_at=calc.created_at.isoformat(),
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _owned_or_404(
    calc_id: uuid.UUID, merchant: Merchant, session: AsyncSession
) -> ToolCalculation:
    calc = await session.get(ToolCalculation, calc_id)
    if calc is None or calc.merchant_id != merchant.id:
        raise HTTPException(404, detail={"error": "calculation_not_found"})
    return calc


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("", response_model=list[CalculationOut])
async def list_calculations(
    include_archived: bool = Query(default=False),
    tool_name: Optional[str] = Query(default=None),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> list[CalculationOut]:
    stmt = select(ToolCalculation).where(ToolCalculation.merchant_id == merchant.id)
    if not include_archived:
        stmt = stmt.where(ToolCalculation.archived_at.is_(None))
    if tool_name:
        stmt = stmt.where(ToolCalculation.tool_name == tool_name)
    stmt = stmt.order_by(ToolCalculation.created_at.desc())
    rows = list((await session.execute(stmt)).scalars().all())
    return [to_out(c) for c in rows]


@router.post("", response_model=CalculationOut, status_code=status.HTTP_201_CREATED)
async def create_calculation(
    body: CalculationCreate,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> CalculationOut:
    count = (await session.execute(
        select(func.count()).where(ToolCalculation.merchant_id == merchant.id)
    )).scalar_one()
    if count >= MAX_CALCULATIONS_PER_MERCHANT:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "calculation_limit_reached",
                    "message": f"You can save up to {MAX_CALCULATIONS_PER_MERCHANT} "
                               "calculations. Delete some to make room."},
        )

    calc = ToolCalculation(
        merchant_id=merchant.id,
        tool_name=body.tool_name,
        name=body.name,
        inputs=body.inputs,
        results=body.results,
        currency=body.currency,
    )
    session.add(calc)
    await session.commit()
    await session.refresh(calc)
    return to_out(calc)


@router.get("/{calc_id}", response_model=CalculationOut)
async def get_calculation(
    calc_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> CalculationOut:
    calc = await _owned_or_404(calc_id, merchant, session)
    return to_out(calc)


@router.patch("/{calc_id}", response_model=CalculationOut)
async def update_calculation(
    calc_id: uuid.UUID,
    body: CalculationPatch,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> CalculationOut:
    calc = await _owned_or_404(calc_id, merchant, session)

    if body.name is not None:
        calc.name = body.name
    if body.inputs is not None:
        calc.inputs = body.inputs
    if body.results is not None:
        calc.results = body.results
    if body.currency is not None:
        calc.currency = body.currency
    if body.archived is not None:
        # tz-aware UTC: archived_at is a timestamptz column; a naive datetime.now()
        # would store local wall-clock as UTC (off by the server's tz offset) and
        # asyncpg may reject it outright.
        calc.archived_at = datetime.now(timezone.utc) if body.archived else None

    await session.commit()
    await session.refresh(calc)
    return to_out(calc)


@router.delete("/{calc_id}", status_code=status.HTTP_204_NO_CONTENT,
               response_class=Response)
async def delete_calculation(
    calc_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    calc = await _owned_or_404(calc_id, merchant, session)
    await session.delete(calc)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
