import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")

import json
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from services import fx


# ── convert — pure FX math ──────────────────────────────────────────────────────

def test_convert_same_currency_is_identity():
    assert fx.convert(Decimal("19.99"), "USD", "USD", {"USD": 1.0, "EUR": 2.0}) == Decimal("19.99")


def test_convert_cross_currency_via_usd_base():
    # rates are "units per 1 USD". 10 EUR @ (EUR=2/USD, GBP=4/USD) = 5 USD = 20 GBP.
    rates = {"USD": 1.0, "EUR": 2.0, "GBP": 4.0}
    assert fx.convert(Decimal("10"), "EUR", "GBP", rates) == Decimal("20.00")


def test_convert_quantizes_to_two_dp():
    rates = {"USD": 1.0, "INR": 83.0}
    out = fx.convert(Decimal("100"), "INR", "USD", rates)   # 100/83 = 1.2048...
    assert out == Decimal("1.20")


def test_convert_case_insensitive_codes():
    rates = {"USD": 1.0, "EUR": 2.0}
    assert fx.convert(Decimal("4"), "eur", "usd", rates) == Decimal("2.00")


def test_convert_unsupported_currency_raises():
    with pytest.raises(fx.UnsupportedCurrency):
        fx.convert(Decimal("1"), "USD", "ZZZ", {"USD": 1.0})


# ── get_usd_rates — Redis-cached with static fallback ───────────────────────────

def test_get_usd_rates_falls_back_to_static_when_redis_empty():
    r = MagicMock(); r.get.return_value = None
    rates = fx.get_usd_rates(r)
    assert rates["USD"] == 1.0
    assert rates == fx.STATIC_USD_RATES        # a copy of the embedded table


def test_get_usd_rates_merges_cached_over_static():
    r = MagicMock(); r.get.return_value = json.dumps({"EUR": 0.90})
    rates = fx.get_usd_rates(r)
    assert rates["EUR"] == 0.90                # live override wins
    assert rates["USD"] == 1.0                 # base preserved
    assert "INR" in rates                      # static codes still present


def test_get_usd_rates_survives_bad_cache_and_redis_errors():
    r = MagicMock(); r.get.return_value = "{not json"
    assert fx.get_usd_rates(r) == fx.STATIC_USD_RATES
    boom = MagicMock(); boom.get.side_effect = RuntimeError("redis down")
    assert fx.get_usd_rates(boom) == fx.STATIC_USD_RATES


# ── normalize_prices — convert a list of (price, currency) to a target ──────────

def test_normalize_prices_converts_each_to_target():
    rates = {"USD": 1.0, "EUR": 2.0}
    out = fx.normalize_prices([(Decimal("4"), "EUR"), (Decimal("3"), "USD")], "USD", rates)
    assert out == [Decimal("2.00"), Decimal("3.00")]


def test_normalize_prices_passes_through_unsupported_without_raising():
    # An unknown competitor currency must never break a cycle — keep the raw price.
    rates = {"USD": 1.0}
    out = fx.normalize_prices([(Decimal("5"), "ZZZ")], "USD", rates)
    assert out == [Decimal("5")]


# ── is_supported / formatting metadata ──────────────────────────────────────────

def test_is_supported():
    assert fx.is_supported("usd") is True
    assert fx.is_supported("EUR") is True
    assert fx.is_supported("ZZZ") is False
    assert fx.is_supported(None) is False
