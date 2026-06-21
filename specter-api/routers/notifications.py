"""In-app notification endpoints (dashboard bell + /notifications page).

All routes are scoped to the authenticated merchant (get_current_merchant): a row
is only ever readable/mutable by its owner, so an id the caller doesn't own returns
404 (never leaks another merchant's notifications).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth.supabase import get_current_merchant
from db import get_db
from models.merchants import Merchant
from models.notifications import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    severity: str
    title: str
    body: str
    link: Optional[str]
    read: bool
    created_at: datetime

    @classmethod
    def of(cls, n: Notification) -> "NotificationOut":
        return cls(
            id=n.id, type=n.type, severity=n.severity, title=n.title, body=n.body,
            link=n.link, read=n.read_at is not None, created_at=n.created_at,
        )


class NotificationList(BaseModel):
    items: list[NotificationOut]
    total: int
    unread: int


class UnreadCount(BaseModel):
    unread: int


@router.get("", response_model=NotificationList)
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    type: Optional[str] = Query(None),
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> NotificationList:
    """Paginated, newest-first. Optional `type` filter. Also returns total (for the
    filtered set) and the merchant-wide unread count (for the badge)."""
    where = [Notification.merchant_id == merchant.id]
    if type:
        where.append(Notification.type == type)

    rows = list((await session.execute(
        select(Notification).where(*where)
        .order_by(Notification.created_at.desc())
        .limit(limit).offset(offset)
    )).scalars().all())

    total = (await session.execute(
        select(func.count()).select_from(Notification).where(*where)
    )).scalar_one()

    unread = (await session.execute(
        select(func.count()).select_from(Notification).where(
            Notification.merchant_id == merchant.id,
            Notification.read_at.is_(None),
        )
    )).scalar_one()

    return NotificationList(
        items=[NotificationOut.of(n) for n in rows], total=total, unread=unread,
    )


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> UnreadCount:
    """Cheap unread count for the polled bell badge (uses the
    (merchant_id, read_at) index)."""
    n = (await session.execute(
        select(func.count()).select_from(Notification).where(
            Notification.merchant_id == merchant.id,
            Notification.read_at.is_(None),
        )
    )).scalar_one()
    return UnreadCount(unread=n)


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT,
             response_class=Response)
async def mark_read(
    notification_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Mark one notification read. 404 for a row the caller doesn't own."""
    res = await session.execute(
        update(Notification)
        .where(Notification.id == notification_id,
               Notification.merchant_id == merchant.id)
        .values(read_at=datetime.now(timezone.utc))
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail={"error": "notification_not_found"})
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT,
             response_class=Response)
async def mark_all_read(
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Mark every unread notification for the merchant as read."""
    await session.execute(
        update(Notification)
        .where(Notification.merchant_id == merchant.id,
               Notification.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc))
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT,
               response_class=Response)
async def dismiss(
    notification_id: uuid.UUID,
    merchant: Merchant = Depends(get_current_merchant),
    session: AsyncSession = Depends(get_db),
) -> Response:
    """Permanently dismiss (delete) one notification. 404 if not owned."""
    res = await session.execute(
        delete(Notification).where(
            Notification.id == notification_id,
            Notification.merchant_id == merchant.id,
        )
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail={"error": "notification_not_found"})
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
