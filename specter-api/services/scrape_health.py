"""Scrape-health reporting — aggregates the append-only `scrape_audit` trail into
operator-facing reliability metrics (parser/crawl success, blocked/failed rates)
overall and per-domain, across rolling 24h / 7d / 30d windows.

Split so the rate math is pure and unit-testable without a DB:
  compute_rates(counts)            — pure: status counts → rate record
  scrape_health(session, now)      — effectful: query scrape_audit per window

`scrape_audit.status` is one of: 'stored' | 'unchanged' | 'duplicate' | 'failed'
| 'blocked' | 'excluded' (see models/scrape_audit.py + routers/internal.py).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.scrape_audit import ScrapeAudit

# Rolling windows surfaced by the report, in label → lookback order (widest last).
WINDOWS: dict[str, timedelta] = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

# Statuses that mean we fetched AND parsed a price (a write, a skipped-write
# because unchanged, or an idempotent retry of one). These are "successes".
_SUCCESS_STATUSES = ("stored", "unchanged", "duplicate")


def compute_rates(counts: dict[str, int]) -> dict:
    """Pure: turn per-status counts into a rate record.

    - parser_success_rate: of fetches that reached the parser (success + failed,
      i.e. excluding blocked/excluded which never parsed), the fraction that
      yielded a price. None when there were no parse attempts.
    - crawl_success_rate:  of ALL outcomes, the fraction that fetched + parsed.
    - blocked_rate / failed_rate / excluded_rate: share of all outcomes.
    Rates are None (not 0) when their denominator is 0, so an empty window is
    distinguishable from a genuine 0%.
    """
    counts = {k: int(v) for k, v in counts.items()}
    total = sum(counts.values())
    success = sum(counts.get(s, 0) for s in _SUCCESS_STATUSES)
    failed = counts.get("failed", 0)
    blocked = counts.get("blocked", 0)
    excluded = counts.get("excluded", 0)
    parse_attempts = success + failed  # blocked/excluded never reached the parser

    def rate(num: int, den: int) -> float | None:
        return round(num / den, 4) if den > 0 else None

    return {
        "total": total,
        "counts": counts,
        "parser_success_rate": rate(success, parse_attempts),
        "crawl_success_rate": rate(success, total),
        "blocked_rate": rate(blocked, total),
        "failed_rate": rate(failed, total),
        "excluded_rate": rate(excluded, total),
    }


def _assemble_window(rows: list[tuple[str, str, int]]) -> dict:
    """Fold (domain, status, count) rows into an overall summary + per-domain
    list (worst first by blocked+failed share)."""
    overall: dict[str, int] = {}
    per_domain: dict[str, dict[str, int]] = {}
    for domain, status, count in rows:
        overall[status] = overall.get(status, 0) + int(count)
        per_domain.setdefault(domain, {})[status] = int(count)

    domains = []
    for domain, counts in per_domain.items():
        rec = compute_rates(counts)
        rec["domain"] = domain
        domains.append(rec)
    # Worst first: highest combined failure+block share floats to the top so an
    # operator sees the domains whose layout/anti-bot posture needs attention.
    domains.sort(
        key=lambda r: (r["failed_rate"] or 0.0) + (r["blocked_rate"] or 0.0),
        reverse=True,
    )

    summary = compute_rates(overall)
    summary["domains"] = domains
    return summary


async def scrape_health(session: AsyncSession, now: datetime | None = None) -> dict:
    """Aggregate scrape_audit into {window_label: summary} for each WINDOW.

    One grouped COUNT per window (3 total), each served by the
    ix_scrape_audit_domain_created index.
    """
    now = now or datetime.now(timezone.utc)
    out: dict[str, dict] = {}
    for label, delta in WINDOWS.items():
        cutoff = now - delta
        rows = (await session.execute(
            select(ScrapeAudit.domain, ScrapeAudit.status, func.count())
            .where(ScrapeAudit.created_at >= cutoff)
            .group_by(ScrapeAudit.domain, ScrapeAudit.status)
        )).all()
        out[label] = _assemble_window([(d, s, c) for d, s, c in rows])
    return out
