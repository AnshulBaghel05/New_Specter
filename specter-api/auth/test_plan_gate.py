"""
Unit tests for plan gating + per-plan SKU / competitor limits.

Pure functions only — no DB, no FastAPI. Covers the FREE plan (which must
resolve to a hard 0 / clean denial, not 'unlimited'), the canonical PRICING.md
tier limits, ECLIPSE's custom (unlimited / override) semantics, and robustness
against unknown plan strings.
"""
from __future__ import annotations

import pytest

from auth.plan_gate import (
    FEATURE_GATES,
    PLAN_COMPETITOR_LIMITS,
    PLAN_HIERARCHY,
    PLAN_MAX_SKUS,
    competitor_limit_for,
    plan_competitor_limit,
    plan_max_skus,
    requires_plan,
)


# ── PRICING.md canonical numbers ─────────────────────────────────────────────

def test_free_is_first_in_hierarchy():
    assert PLAN_HIERARCHY[0] == "free"
    assert PLAN_HIERARCHY == ["free", "recon", "cipher", "phantom", "predator", "eclipse"]


def test_sku_limits_match_pricing():
    assert PLAN_MAX_SKUS["free"] == 0
    assert PLAN_MAX_SKUS["recon"] == 100
    assert PLAN_MAX_SKUS["cipher"] == 500
    assert PLAN_MAX_SKUS["phantom"] == 1_000
    assert PLAN_MAX_SKUS["predator"] == 2_000
    assert PLAN_MAX_SKUS["eclipse"] is None  # custom contract


def test_competitor_limits_match_pricing():
    assert PLAN_COMPETITOR_LIMITS["free"] == 0
    assert PLAN_COMPETITOR_LIMITS["recon"] == 3
    assert PLAN_COMPETITOR_LIMITS["cipher"] == 5
    assert PLAN_COMPETITOR_LIMITS["phantom"] == 8
    assert PLAN_COMPETITOR_LIMITS["predator"] == 12
    assert PLAN_COMPETITOR_LIMITS["eclipse"] is None


# ── plan_max_skus resolver ───────────────────────────────────────────────────

@pytest.mark.parametrize(
    "plan,expected",
    [
        ("free", 0),
        ("recon", 100),
        ("cipher", 500),
        ("phantom", 1_000),
        ("predator", 2_000),
        ("eclipse", None),  # unlimited
        ("CIPHER", 500),     # case-insensitive
    ],
)
def test_plan_max_skus(plan, expected):
    assert plan_max_skus(plan) == expected


def test_plan_max_skus_unknown_plan_is_zero_not_unlimited():
    # A typo / stale plan string must NOT grant unlimited SKUs.
    assert plan_max_skus("garbage") == 0


# ── plan_competitor_limit resolver ───────────────────────────────────────────

@pytest.mark.parametrize(
    "plan,expected",
    [
        ("free", 0),
        ("recon", 3),
        ("cipher", 5),
        ("phantom", 8),
        ("predator", 12),
        ("eclipse", None),
        ("PHANTOM", 8),
    ],
)
def test_plan_competitor_limit(plan, expected):
    assert plan_competitor_limit(plan) == expected


def test_plan_competitor_limit_unknown_plan_is_zero():
    assert plan_competitor_limit("garbage") == 0


# ── competitor_limit_for (plan-driven, with ECLIPSE custom override) ─────────

def test_competitor_limit_for_uses_plan_not_stale_column():
    # CIPHER must yield 5 even if a stale per-merchant column says 3.
    assert competitor_limit_for("cipher", 3) == 5
    assert competitor_limit_for("recon", 99) == 3


def test_competitor_limit_for_eclipse_uses_custom_override():
    assert competitor_limit_for("eclipse", 20) == 20      # custom contract value
    assert competitor_limit_for("eclipse", None) is None  # unlimited


def test_competitor_limit_for_free_is_zero():
    assert competitor_limit_for("free", None) == 0


# ── requires_plan (feature gating) ───────────────────────────────────────────

def test_free_denied_for_every_gated_feature():
    for feature in FEATURE_GATES:
        assert requires_plan(feature, "free") is False


def test_gated_features_pass_at_or_above_threshold():
    assert requires_plan("auto_reprice", "cipher") is True
    assert requires_plan("auto_reprice", "recon") is False
    assert requires_plan("attribution", "phantom") is True
    assert requires_plan("attribution", "cipher") is False
    assert requires_plan("history_90d", "predator") is True
    assert requires_plan("dedicated_workers", "eclipse") is True


def test_requires_plan_unknown_plan_denied_not_crash():
    # Must not raise ValueError — unknown plan is treated as below FREE.
    assert requires_plan("auto_reprice", "garbage") is False
