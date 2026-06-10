"""Pure cost-rate model (Audit #4). Unit rates default to the COST_ANALYSIS.md
appendix and are env-overridable so margins recompute when vendor prices move.
No I/O — every function is a deterministic calculation."""
from __future__ import annotations

import os

_GB = 1_000_000_000  # bytes per "GB" for the bandwidth model (decimal GB, matches vendor billing)


def _env_float(key: str, default: float) -> float:
    v = os.environ.get(key)
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _proxy_rate_per_gb(tier: str | None) -> float:
    t = (tier or "none").lower()
    if t == "residential":
        return _env_float("COST_RATE_RESIDENTIAL_USD_PER_GB", 8.40)
    if t == "datacenter":
        return _env_float("COST_RATE_DATACENTER_USD_PER_GB", 0.30)
    return 0.0   # 'none'/None/direct → no proxy bandwidth cost


def _captcha_rate() -> float:
    return _env_float("COST_RATE_CAPTCHA_USD_PER_SOLVE", 0.002)


def _ai_rates(model: str) -> tuple[float, float]:
    """(input_$/1M, output_$/1M) for the model family."""
    if "flash" in (model or "").lower():
        return (_env_float("COST_RATE_AI_FLASH_IN_PER_1M", 0.075),
                _env_float("COST_RATE_AI_FLASH_OUT_PER_1M", 0.30))
    return (_env_float("COST_RATE_AI_PRO_IN_PER_1M", 1.25),
            _env_float("COST_RATE_AI_PRO_OUT_PER_1M", 5.00))


# Plan → modeled monthly revenue (PRICING.md). ECLIPSE is bespoke → 0 (flagged custom).
_PLAN_REVENUE = {"free": 0.0, "recon": 79.0, "cipher": 249.0, "phantom": 699.0,
                 "predator": 1799.0, "eclipse": 0.0}


def scrape_cost_usd(proxy_tier: str | None, resp_bytes: int, captcha_solved: bool) -> dict:
    """Marginal cost of ONE fetch, before the cross-merchant split."""
    proxy = max(0, int(resp_bytes or 0)) / _GB * _proxy_rate_per_gb(proxy_tier)
    captcha = _captcha_rate() if captcha_solved else 0.0
    return {"proxy": proxy, "captcha": captcha}


def ai_cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    in_rate, out_rate = _ai_rates(model)
    return (max(0, int(input_tokens or 0)) / 1_000_000) * in_rate \
         + (max(0, int(output_tokens or 0)) / 1_000_000) * out_rate


def split(cost: float, n_merchants: int) -> float:
    """Divide a shared crawl's cost across the merchants sharing it (guard /0)."""
    return cost / max(int(n_merchants), 1)


def monthly_revenue_usd(plan: str) -> float:
    return _PLAN_REVENUE.get((plan or "").lower(), 0.0)
