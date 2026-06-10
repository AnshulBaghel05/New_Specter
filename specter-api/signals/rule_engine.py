"""
Rule-based signal engine — pure function, no I/O.

Decision priority (prevents conflicting signals):
  1. LOWER  — merchant > 5% above market median → overpriced, act first
  2. RAISE  — any in-stock competitor charges more AND merchant not already overpriced
  3. HOLD   — price is competitive or no actionable data

Confidence formula (F4 AC#6):
  base     = min(1.0, enabled_tracking_count / 5)
  final    = min(base, 0.60)  if in_stock_count < 2
           = base              otherwise
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal, Optional

SignalType = Literal["RAISE", "LOWER", "HOLD"]

# Thresholds — kept as named constants so tests can reference them directly.
LOWER_THRESHOLD = Decimal("1.05")   # merchant > median × 1.05  → LOWER
HOLD_BAND       = Decimal("0.02")   # |merchant − median| / median ≤ 0.02 → within hold band
CONFIDENCE_LOW_INSTOCK_CAP = Decimal("0.60")
CONFIDENCE_DIVISOR = Decimal("5")
MIN_CONFIDENCE = Decimal("0.10")


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass(frozen=True)
class CompetitorDataPoint:
    """
    Latest price_snapshot data for one enabled competitor_tracking.
    Caller (dispatcher) is responsible for fetching the most recent snapshot
    per tracking and filtering to a consistent currency before passing here.

    The optional fields (domain, competitor_url_id, scraped_at) are used by the
    AI engine for prompt construction and hash computation; the rule engine ignores
    them entirely.  They have safe defaults so existing callers need no changes.
    """
    tracking_id: str        # competitor_trackings.id (UUID str)
    price: Decimal          # parsed price from price_snapshots
    in_stock: bool          # in_stock flag from price_snapshots
    currency: str           # ISO 4217 code (e.g. 'USD')
    # AI-engine extras — rule engine ignores these
    domain: str = field(default="")
    competitor_url_id: str = field(default="")
    scraped_at: Optional[datetime] = field(default=None)


@dataclass(frozen=True)
class SignalResult:
    signal_type: SignalType
    confidence: Decimal     # 0.10 – 1.00, stored as NUMERIC(3,2)
    reasoning: str          # ≤120 chars; shown on /signals page


# ── Core computation ──────────────────────────────────────────────────────────

def compute_signal(
    merchant_price: Decimal,
    enabled_trackings: list[CompetitorDataPoint],
) -> Optional[SignalResult]:
    """
    Compute a RAISE/LOWER/HOLD signal from competitor price data.

    Returns None when merchant_price is absent or zero (no price set on the SKU).
    Callers should pass only `competitor_trackings` with `enabled=True` that have
    at least one price_snapshot; trackings without snapshots should be excluded.
    """
    if not merchant_price or merchant_price <= 0:
        return None

    enabled_count = len(enabled_trackings)
    instock = [c for c in enabled_trackings if c.in_stock]
    instock_count = len(instock)

    # ── Confidence scoring ────────────────────────────────────────────────────
    base_confidence = min(
        Decimal("1.0"),
        Decimal(enabled_count) / CONFIDENCE_DIVISOR,
    )
    confidence = (
        min(base_confidence, CONFIDENCE_LOW_INSTOCK_CAP)
        if instock_count < 2
        else base_confidence
    )
    confidence = max(confidence, MIN_CONFIDENCE)
    # Quantise to 2 decimal places (NUMERIC(3,2) column constraint).
    confidence = confidence.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    # ── No in-stock competitor data ───────────────────────────────────────────
    if not instock:
        if enabled_count == 0:
            reason = "No competitor trackings enabled — add competitors to unlock signals"
        else:
            reason = (
                f"All {enabled_count} tracked competitor"
                f"{'s' if enabled_count > 1 else ''} are out of stock — no live pricing data"
            )
        return SignalResult("HOLD", confidence, reason[:120])

    # ── Compute statistics on in-stock prices ────────────────────────────────
    # Outlier guard: exclude prices > 5× the median of the other prices to prevent
    # bad parse results (e.g. $999 for a $20 product) from corrupting the signal.
    raw_prices = [c.price for c in instock]
    median_all = Decimal(str(statistics.median(float(p) for p in raw_prices)))
    filtered = [p for p in raw_prices if p <= median_all * 5]
    if not filtered:
        filtered = raw_prices  # fallback: all prices were "outliers" (unusual distribution)

    median_price = Decimal(str(statistics.median(float(p) for p in filtered)))
    max_competitor_price = max(filtered)
    instock_filtered_count = len(filtered)

    pct_diff = (merchant_price - median_price) / median_price

    # ── Priority 1: LOWER ─────────────────────────────────────────────────────
    # Merchant is more than 5% above the in-stock market median. Loss of sales risk.
    if merchant_price > median_price * LOWER_THRESHOLD:
        pct_str = f"{float(pct_diff) * 100:.1f}%"
        reason = (
            f"Your ${merchant_price:.2f} is {pct_str} above market median "
            f"${median_price:.2f} ({instock_filtered_count} in-stock competitor"
            f"{'s' if instock_filtered_count > 1 else ''})"
        )
        return SignalResult("LOWER", confidence, reason[:120])

    # ── Priority 2: RAISE ─────────────────────────────────────────────────────
    # At least one in-stock competitor charges more. Market evidences a higher price
    # ceiling; merchant is leaving margin on the table.
    above_merchant = [p for p in filtered if p > merchant_price]
    if above_merchant:
        count_above = len(above_merchant)
        max_above = max(above_merchant)
        gain = max_above - merchant_price
        reason = (
            f"{count_above} competitor{'s' if count_above > 1 else ''} "
            f"pricing up to ${max_above:.2f} — raise from ${merchant_price:.2f} "
            f"(+${gain:.2f} potential)"
        )
        return SignalResult("RAISE", confidence, reason[:120])

    # ── Priority 3: HOLD ──────────────────────────────────────────────────────
    # Merchant is at or above all competitor prices and not in LOWER territory,
    # OR price is within the ±2% competitive band.
    abs_pct = abs(float(pct_diff))
    if abs_pct <= float(HOLD_BAND):
        reason = (
            f"Your ${merchant_price:.2f} is within 2% of market median "
            f"${median_price:.2f} — pricing is competitive"
        )
    elif merchant_price < median_price:
        # Below median, no one is above merchant — merchant is the cheapest
        reason = (
            f"Your ${merchant_price:.2f} is {abs_pct * 100:.1f}% below market median "
            f"${median_price:.2f} — you are the lowest-priced option"
        )
    else:
        # Above median but < LOWER threshold, and no competitor is more expensive
        reason = (
            f"Your ${merchant_price:.2f} is {abs_pct * 100:.1f}% above market median "
            f"${median_price:.2f} — priced highest; monitor competitor restocks"
        )
    return SignalResult("HOLD", confidence, reason[:120])
