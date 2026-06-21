"""Currency / FX service.

The signal engine compares a merchant's product price against competitor snapshot
prices. Those prices can be denominated in different currencies (a EUR competitor
page vs a USD product), so before any RAISE/LOWER/HOLD math we convert every
competitor price into the product's currency. This module owns that conversion.

Design:
  * Rates are held as "units of CCY per 1 USD" (USD is the pivot). Cross-rates are
    `amount / rate[from] * rate[to]`.
  * `STATIC_USD_RATES` is an embedded, version-controlled snapshot used as the
    always-available fallback so signal cycles never depend on a live network call.
  * `get_usd_rates(redis)` prefers a Redis-cached live table (key `fx:rates:usd`,
    populated out-of-band by `refresh_usd_rates`) layered OVER the static table, so
    a partial/stale cache can only improve on the embedded defaults, never break.
  * All public helpers are defensive: a bad cache, a Redis outage, or an unknown
    competitor currency degrade to a safe pass-through, never an exception in the
    hot path. The pure `convert` is the one function that raises (callers guard).
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

RATES_CACHE_KEY = "fx:rates:usd"
RATES_CACHE_TTL_SECONDS = 24 * 60 * 60  # refresh daily; static fallback covers gaps

# ISO-4217 code → display symbol. This set bounds what a merchant may pick for a
# product currency (validated at the API) and what we know how to format.
SUPPORTED_CURRENCIES: dict[str, str] = {
    "USD": "$", "EUR": "€", "GBP": "£", "INR": "₹", "CAD": "C$", "AUD": "A$",
    "JPY": "¥", "CNY": "¥", "SGD": "S$", "AED": "د.إ", "BRL": "R$", "ZAR": "R",
    "MXN": "Mex$", "NZD": "NZ$", "CHF": "CHF", "SEK": "kr", "NOK": "kr",
    "DKK": "kr", "PLN": "zł", "HKD": "HK$",
}

# Embedded fallback rates (units per 1 USD), approximate as of 2026-06. Kept only
# accurate enough that a missing live feed still yields sane signals; the live
# refresh supersedes these whenever the cache is warm.
STATIC_USD_RATES: dict[str, float] = {
    "USD": 1.0, "EUR": 0.92, "GBP": 0.79, "INR": 83.0, "CAD": 1.36, "AUD": 1.52,
    "JPY": 157.0, "CNY": 7.24, "SGD": 1.35, "AED": 3.67, "BRL": 5.05, "ZAR": 18.4,
    "MXN": 17.1, "NZD": 1.64, "CHF": 0.90, "SEK": 10.5, "NOK": 10.7, "DKK": 6.85,
    "PLN": 3.95, "HKD": 7.81,
}

DEFAULT_CURRENCY = "USD"


class UnsupportedCurrency(ValueError):
    """Raised by `convert` when a code has no rate in the supplied table."""


def is_supported(code: str | None) -> bool:
    return bool(code) and code.upper() in SUPPORTED_CURRENCIES


def symbol_for(code: str | None) -> str:
    return SUPPORTED_CURRENCIES.get((code or "").upper(), (code or "").upper())


def convert(amount: Decimal, from_ccy: str, to_ccy: str, rates: dict[str, float]) -> Decimal:
    """Convert `amount` from one currency to another using a USD-pivot rate table.

    Pure. Same currency is identity (no rounding drift). Raises UnsupportedCurrency
    if either code is absent from `rates`. Result is quantized to 2 decimals."""
    src, dst = (from_ccy or "").upper(), (to_ccy or "").upper()
    if src == dst:
        return amount
    if src not in rates or dst not in rates:
        raise UnsupportedCurrency(f"no rate for {src!r}→{dst!r}")
    usd = Decimal(str(amount)) / Decimal(str(rates[src]))
    out = usd * Decimal(str(rates[dst]))
    return out.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def normalize_prices(
    priced: list[tuple[Decimal, str]], target_ccy: str, rates: dict[str, float]
) -> list[Decimal]:
    """Convert a list of (price, currency) into `target_ccy`.

    An unknown/unsupported source currency is passed through unchanged rather than
    dropped or raised — one un-mappable competitor must never break a whole signal
    cycle. Such cases are logged at debug for observability."""
    out: list[Decimal] = []
    for price, ccy in priced:
        try:
            out.append(convert(price, ccy or target_ccy, target_ccy, rates))
        except UnsupportedCurrency:
            logger.debug("fx: passing through unconvertible %s %s → %s", price, ccy, target_ccy)
            out.append(price)
    return out


def get_usd_rates(redis_client) -> dict[str, float]:
    """Live-cached USD-base rates layered over the static fallback.

    Always returns a complete, usable table: the Redis cache (if present and valid)
    overrides individual static rates; any Redis/parse failure yields the static
    table verbatim. Never raises."""
    rates = dict(STATIC_USD_RATES)
    try:
        raw = redis_client.get(RATES_CACHE_KEY)
    except Exception:
        return rates
    if not raw:
        return rates
    try:
        cached = json.loads(raw)
        if isinstance(cached, dict):
            for code, rate in cached.items():
                if isinstance(rate, (int, float)) and rate > 0:
                    rates[str(code).upper()] = float(rate)
    except (ValueError, TypeError):
        return dict(STATIC_USD_RATES)
    return rates


def refresh_usd_rates(redis_client, fetch=None) -> dict[str, float] | None:
    """Fetch live USD-base rates and cache them in Redis (called out-of-band, e.g.
    a daily cron — NOT in the signal hot path). `fetch` is an injectable callable
    returning a {code: rate} dict for testing. Returns the stored rates, or None on
    failure (the static fallback then remains in effect). Never raises."""
    try:
        rates = fetch() if fetch is not None else _fetch_live_usd_rates()
        if not isinstance(rates, dict) or rates.get("USD") not in (1, 1.0):
            return None
        clean = {
            code.upper(): float(rate)
            for code, rate in rates.items()
            if code.upper() in SUPPORTED_CURRENCIES
            and isinstance(rate, (int, float)) and rate > 0
        }
        redis_client.set(RATES_CACHE_KEY, json.dumps(clean), ex=RATES_CACHE_TTL_SECONDS)
        return clean
    except Exception:
        logger.warning("fx: live rate refresh failed; static fallback stays in effect", exc_info=True)
        return None


def _fetch_live_usd_rates() -> dict[str, float]:
    """Pull USD-base rates from a free, keyless FX endpoint. Imported lazily so the
    module has no hard httpx dependency at import time."""
    import httpx

    resp = httpx.get("https://open.er-api.com/v6/latest/USD", timeout=10.0)
    resp.raise_for_status()
    data = resp.json()
    return {"USD": 1.0, **{k: v for k, v in (data.get("rates") or {}).items()}}
