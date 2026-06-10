# specter-api/services/test_scrape_scheduler.py
import uuid
from datetime import datetime, timezone
from services.scrape_scheduler import (
    PLAN_INTERVALS_MS, PLAN_MAX_INTERVALS_MS, interval_for_plans, phase_offset_ms,
    next_run_after, first_run_at, adaptive_multiplier, cap_for_plans, effective_interval)

def test_interval_is_the_most_frequent_plan():
    # A URL tracked by RECON(6h) and PREDATOR(1h) scrapes at the PREDATOR rate.
    assert interval_for_plans(["recon", "predator"]) == PLAN_INTERVALS_MS["predator"]


# ── Adaptive change-detection (#1 ported to the live Python scheduler) ──────────

def test_adaptive_multiplier_balanced_curve():
    assert adaptive_multiplier(0) == 1
    assert adaptive_multiplier(2) == 1
    assert adaptive_multiplier(3) == 2
    assert adaptive_multiplier(5) == 2
    assert adaptive_multiplier(6) == 4
    assert adaptive_multiplier(8) == 4
    assert adaptive_multiplier(9) == float("inf")
    assert adaptive_multiplier(-1) == 1  # negative treated as fresh

def test_cap_is_the_fastest_plans_cap():
    # RECON+PREDATOR → fastest is PREDATOR, so the staleness cap is PREDATOR's 4h.
    assert cap_for_plans(["recon", "predator"]) == PLAN_MAX_INTERVALS_MS["predator"]
    assert cap_for_plans(["recon"]) == PLAN_MAX_INTERVALS_MS["recon"]
    assert cap_for_plans([]) == PLAN_MAX_INTERVALS_MS["recon"]

def test_effective_interval_floor_when_fresh():
    # streak < 3 → full plan speed (the floor), never faster than the plan.
    assert effective_interval(["recon"], 0) == PLAN_INTERVALS_MS["recon"]
    assert effective_interval(["recon"], 2) == PLAN_INTERVALS_MS["recon"]

def test_effective_interval_backs_off_then_caps():
    assert effective_interval(["recon"], 3) == PLAN_INTERVALS_MS["recon"] * 2  # 12h
    assert effective_interval(["recon"], 6) == PLAN_MAX_INTERVALS_MS["recon"]  # 24h cap
    assert effective_interval(["recon"], 99) == PLAN_MAX_INTERVALS_MS["recon"]

def test_effective_interval_uses_fastest_plan_bounds():
    # Mixed plans: floor + cap both come from the fastest (PREDATOR) plan.
    assert effective_interval(["recon", "predator"], 0) == PLAN_INTERVALS_MS["predator"]
    assert effective_interval(["recon", "predator"], 9) == PLAN_MAX_INTERVALS_MS["predator"]

def test_effective_interval_eclipse_configurable_floor():
    assert effective_interval(["eclipse"], 0, 300_000) == 300_000
    assert effective_interval(["eclipse"], 9, 300_000) == 3_600_000  # 1h cap
    # Floor above the cap (merchant set ECLIPSE slow) → no backoff, floor wins.
    assert effective_interval(["eclipse"], 9, 7_200_000) == 7_200_000

def test_effective_interval_defaults_to_recon_for_empty():
    assert effective_interval([], 0) == PLAN_INTERVALS_MS["recon"]

def test_phase_offset_is_stable_and_within_interval():
    cu = uuid.UUID("11111111-1111-1111-1111-111111111111")
    off = phase_offset_ms(cu, 3_600_000)
    assert 0 <= off < 3_600_000
    assert phase_offset_ms(cu, 3_600_000) == off  # deterministic

def test_offsets_spread_across_window():
    # 1000 distinct URLs should populate many distinct buckets (even spread, not clustered).
    offs = {phase_offset_ms(uuid.uuid4(), 3_600_000) // 60_000 for _ in range(1000)}
    assert len(offs) > 30  # >30 of 60 one-minute buckets hit

def test_next_run_preserves_phase_and_advances_past_now():
    now = datetime(2026, 6, 5, 12, 0, 30, tzinfo=timezone.utc)
    interval = 3_600_000; offset = 90_000  # phase = 00:01:30 each hour
    nxt = next_run_after(now, interval_ms=interval, phase_offset_ms=offset)
    assert nxt > now
    # phase preserved: ms-of-interval since epoch == offset
    epoch_ms = int(nxt.timestamp() * 1000)
    assert epoch_ms % interval == offset
