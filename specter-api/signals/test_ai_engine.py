"""
Tests for the Gemini AI signal engine.

All tests are synchronous; async engine functions are exercised via asyncio.run().
Gemini API calls are mocked — no real network calls are made.

Run: pytest signals/test_ai_engine.py -v
"""
from __future__ import annotations

import asyncio
import json
import uuid
from decimal import Decimal
from typing import Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from signals.ai_engine import (
    MODEL_NAME,
    _build_competitor_list,
    _build_sku_entry,
    _validate_response,
    process_merchant_batch,
    reset_model_singleton,
)
from signals.cache import (
    CachedSignal,
    cache_key,
    compute_snapshot_hash,
    get_cached,
    set_cached,
)
from signals.fallback import (
    enqueue_ai_error,
    increment_fallback_counter,
)
from signals.rule_engine import CompetitorDataPoint


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_sku(
    price: float = 100.0,
    floor_price: Optional[float] = 80.0,
    ceiling_price: Optional[float] = 140.0,
    active: bool = True,
) -> MagicMock:
    sku = MagicMock()
    sku.id = uuid.uuid4()
    sku.title = "Test Product"
    sku.current_price = Decimal(str(price))
    sku.floor_price = Decimal(str(floor_price)) if floor_price is not None else None
    sku.ceiling_price = Decimal(str(ceiling_price)) if ceiling_price is not None else None
    sku.active = active
    return sku


def _make_data_points(prices_and_stocks: list[tuple[float, bool]]) -> list[CompetitorDataPoint]:
    return [
        CompetitorDataPoint(
            tracking_id=str(uuid.uuid4()),
            price=Decimal(str(p)),
            in_stock=s,
            currency="USD",
            domain=f"competitor{i}.com",
            competitor_url_id=str(uuid.uuid4()),
        )
        for i, (p, s) in enumerate(prices_and_stocks)
    ]


def _gemini_response_json(items: list[dict]) -> MagicMock:
    mock = MagicMock()
    mock.text = json.dumps(items)
    return mock


# ── snapshot hash tests ───────────────────────────────────────────────────────

class TestSnapshotHash:
    def test_hash_excludes_scraped_at(self):
        """Hash should be identical regardless of scraped_at value."""
        competitors_a = [{"domain": "a.com", "price": 100, "in_stock": True, "scraped_at": "2026-01-01T00:00Z"}]
        competitors_b = [{"domain": "a.com", "price": 100, "in_stock": True, "scraped_at": "2026-06-01T12:00Z"}]
        assert compute_snapshot_hash(competitors_a) == compute_snapshot_hash(competitors_b)

    def test_hash_changes_when_price_changes(self):
        a = [{"domain": "a.com", "price": 100, "in_stock": True}]
        b = [{"domain": "a.com", "price": 101, "in_stock": True}]
        assert compute_snapshot_hash(a) != compute_snapshot_hash(b)

    def test_hash_sorted_by_domain(self):
        """Hash must be identical regardless of input order."""
        comps_1 = [
            {"domain": "b.com", "price": 90,  "in_stock": True},
            {"domain": "a.com", "price": 110, "in_stock": True},
        ]
        comps_2 = [
            {"domain": "a.com", "price": 110, "in_stock": True},
            {"domain": "b.com", "price": 90,  "in_stock": True},
        ]
        assert compute_snapshot_hash(comps_1) == compute_snapshot_hash(comps_2)

    def test_hash_changes_on_stock_change(self):
        a = [{"domain": "a.com", "price": 100, "in_stock": True}]
        b = [{"domain": "a.com", "price": 100, "in_stock": False}]
        assert compute_snapshot_hash(a) != compute_snapshot_hash(b)


# ── Cache tests ───────────────────────────────────────────────────────────────

class TestCache:
    def test_cache_miss_returns_none(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        assert get_cached(mock_redis, "sku-1", "hash-1") is None

    def test_cache_hit_returns_signal(self):
        cached: CachedSignal = {
            "signal": "RAISE",
            "confidence": 0.8,
            "price_suggestion": 120.0,
            "reasoning": "Competitor at $130",
        }
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps(cached)
        result = get_cached(mock_redis, "sku-1", "hash-1")
        assert result is not None
        assert result["signal"] == "RAISE"
        assert result["confidence"] == 0.8

    def test_set_cached_uses_plan_ttl(self):
        mock_redis = MagicMock()
        cached: CachedSignal = {
            "signal": "HOLD",
            "confidence": 0.5,
            "price_suggestion": None,
            "reasoning": "Stable pricing",
        }
        set_cached(mock_redis, "sku-1", "hash-1", cached, plan="cipher")
        mock_redis.setex.assert_called_once()
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == 10_800  # cipher TTL

    def test_set_cached_eclipse_uses_merchant_interval(self):
        mock_redis = MagicMock()
        cached: CachedSignal = {
            "signal": "LOWER",
            "confidence": 0.7,
            "price_suggestion": 95.0,
            "reasoning": "Overpriced",
        }
        set_cached(mock_redis, "sku-1", "hash-1", cached, plan="eclipse", eclipse_interval_s=600)
        call_args = mock_redis.setex.call_args
        assert call_args[0][1] == 600

    def test_cache_key_format(self):
        key = cache_key("abc-123", "deadbeef")
        assert key == "ai:signal:abc-123:deadbeef"


# ── Response validation tests ─────────────────────────────────────────────────

class TestResponseValidation:
    def _make_input(self, price=100.0, floor=80.0, ceiling=140.0):
        sku = _make_sku(price=price, floor_price=floor, ceiling_price=ceiling)
        data = _make_data_points([(90.0, True), (110.0, True)])
        return [(sku, data)]

    def test_valid_response_passes(self):
        skus_and_data = self._make_input()
        sku_id = str(skus_and_data[0][0].id)
        raw = json.dumps([{
            "sku_id": sku_id,
            "signal": "RAISE",
            "confidence": 0.85,
            "price_suggestion": 120.0,
            "reasoning": "Competitor at $130 — room to raise",
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is not None
        assert len(result) == 1
        assert result[0]["signal"] == "RAISE"
        assert result[0]["source"] if "source" in result[0] else True

    def test_invalid_json_returns_none(self):
        result = _validate_response("not valid json{", self._make_input())
        assert result is None

    def test_wrong_signal_type_excluded(self):
        skus_and_data = self._make_input()
        sku_id = str(skus_and_data[0][0].id)
        raw = json.dumps([{
            "sku_id": sku_id,
            "signal": "BUY",  # invalid
            "confidence": 0.9,
            "price_suggestion": None,
            "reasoning": "Good deal",
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is None  # excluded → None

    def test_price_suggestion_clamped_to_ceiling(self):
        skus_and_data = self._make_input(floor=80.0, ceiling=120.0)
        sku_id = str(skus_and_data[0][0].id)
        raw = json.dumps([{
            "sku_id": sku_id,
            "signal": "RAISE",
            "confidence": 0.8,
            "price_suggestion": 200.0,  # above ceiling_price=120
            "reasoning": "Room to raise",
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is not None
        assert result[0]["price_suggestion"] == 120.0  # clamped to ceiling

    def test_price_suggestion_clamped_to_floor(self):
        skus_and_data = self._make_input(floor=90.0, ceiling=140.0)
        sku_id = str(skus_and_data[0][0].id)
        raw = json.dumps([{
            "sku_id": sku_id,
            "signal": "LOWER",
            "confidence": 0.7,
            "price_suggestion": 50.0,  # below floor_price=90
            "reasoning": "Lower price",
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is not None
        assert result[0]["price_suggestion"] == 90.0  # clamped to floor

    def test_confidence_capped_with_one_instock(self):
        """Confidence from Gemini is capped at 0.6 when < 2 in-stock competitors."""
        sku = _make_sku()
        data_points = _make_data_points([
            (110.0, True),    # 1 in-stock
            (90.0,  False),   # OOS
        ])
        skus_and_data = [(sku, data_points)]
        sku_id = str(sku.id)
        raw = json.dumps([{
            "sku_id": sku_id,
            "signal": "RAISE",
            "confidence": 0.92,  # > cap
            "price_suggestion": None,
            "reasoning": "Room to raise",
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is not None
        assert result[0]["confidence"] <= 0.6

    def test_reasoning_truncated_to_120_chars(self):
        skus_and_data = self._make_input()
        sku_id = str(skus_and_data[0][0].id)
        long_reasoning = "x" * 200
        raw = json.dumps([{
            "sku_id": sku_id,
            "signal": "HOLD",
            "confidence": 0.6,
            "price_suggestion": None,
            "reasoning": long_reasoning,
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is not None
        assert len(result[0]["reasoning"]) <= 120

    def test_missing_sku_id_excluded(self):
        skus_and_data = self._make_input()
        raw = json.dumps([{
            "sku_id": "unknown-sku-id",
            "signal": "HOLD",
            "confidence": 0.5,
            "price_suggestion": None,
            "reasoning": "OK",
        }])
        result = _validate_response(raw, skus_and_data)
        assert result is None  # no valid items → None

    def test_markdown_code_fence_stripped(self):
        """Gemini sometimes wraps JSON in ```json ... ``` despite mime type."""
        skus_and_data = self._make_input()
        sku_id = str(skus_and_data[0][0].id)
        payload = json.dumps([{
            "sku_id": sku_id,
            "signal": "HOLD",
            "confidence": 0.5,
            "price_suggestion": None,
            "reasoning": "Competitive",
        }])
        raw = f"```json\n{payload}\n```"
        result = _validate_response(raw, skus_and_data)
        assert result is not None
        assert result[0]["signal"] == "HOLD"


# ── AI engine integration tests ───────────────────────────────────────────────

class TestAIEngine:
    def _make_session(self, signal_capture: list) -> AsyncMock:
        """Create a mock AsyncSession that captures session.add() calls."""
        session = AsyncMock()
        session.add = MagicMock(side_effect=lambda obj: signal_capture.append(obj))
        return session

    def _make_redis(self, quota_exhausted: bool = False) -> MagicMock:
        redis = MagicMock()
        # Key-aware exists: quota flag returns quota_exhausted; dedup keys always miss
        def _exists(key: str) -> int:
            if key == "ai:quota-exhausted":
                return 1 if quota_exhausted else 0
            return 0  # dedup keys are always misses unless tested explicitly
        redis.exists.side_effect = _exists
        redis.incr.return_value = 1
        redis.setex.return_value = True
        redis.get.return_value = None  # no cache by default
        return redis

    def test_valid_gemini_response_stores_ai_signal(self):
        """Mock Gemini returns valid JSON → signal stored with source='ai'."""
        sku = _make_sku(price=100.0, floor_price=80.0, ceiling_price=140.0)
        data_points = _make_data_points([(120.0, True), (115.0, True)])
        skus_and_data = [(sku, data_points)]

        sku_id = str(sku.id)
        ai_response = [{
            "sku_id": sku_id,
            "signal": "RAISE",
            "confidence": 0.85,
            "price_suggestion": 115.0,
            "reasoning": "2 competitors priced above — room to raise",
        }]

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis()

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_model.generate_content.return_value = _gemini_response_json(ai_response)
            mock_get_model.return_value = mock_model

            result = asyncio.run(process_merchant_batch(
                session, redis,
                merchant_id=str(uuid.uuid4()),
                plan="cipher",
                eclipse_interval_s=300,
                skus_and_data=skus_and_data,
            ))

        assert len(result) == 1
        assert result[0].source == "ai"
        assert result[0].ai_fallback is False
        assert result[0].ai_model == MODEL_NAME
        assert result[0].type == "RAISE"
        assert result[0].price_suggestion is not None

    def test_cache_hit_skips_gemini(self):
        """Second call with same snapshot hash returns cached signal, Gemini not called."""
        sku = _make_sku(price=100.0)
        data_points = _make_data_points([(120.0, True)])
        skus_and_data = [(sku, data_points)]

        cached_data: CachedSignal = {
            "signal": "RAISE",
            "confidence": 0.8,
            "price_suggestion": 115.0,
            "reasoning": "Cached from prior cycle",
        }
        cached_json = json.dumps(cached_data)

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis()
        # Simulate cache hit: Redis.get returns the cached signal
        redis.get.return_value = cached_json

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            result = asyncio.run(process_merchant_batch(
                session, redis,
                merchant_id=str(uuid.uuid4()),
                plan="cipher",
                eclipse_interval_s=300,
                skus_and_data=skus_and_data,
            ))

        # Gemini was NOT called (cache hit)
        mock_model.generate_content.assert_not_called()
        assert len(result) == 1
        assert result[0].source == "ai"
        assert result[0].ai_fallback is False

    def test_gemini_timeout_triggers_fallback(self):
        """Gemini timeout (both attempts) → rule-based fallback → source='rule', ai_fallback=True."""
        sku = _make_sku(price=100.0)
        # Competitor at $120 (in stock) → rule engine would emit RAISE
        data_points = _make_data_points([(120.0, True)])
        skus_and_data = [(sku, data_points)]

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis()

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            # generate_content blocks indefinitely (simulated by raising TimeoutError)
            mock_model.generate_content.side_effect = asyncio.TimeoutError()
            mock_get_model.return_value = mock_model

            with patch("signals.ai_engine.asyncio.sleep", new_callable=AsyncMock):
                with patch("asyncio.wait_for", side_effect=asyncio.TimeoutError):
                    result = asyncio.run(process_merchant_batch(
                        session, redis,
                        merchant_id=str(uuid.uuid4()),
                        plan="cipher",
                        eclipse_interval_s=300,
                        skus_and_data=skus_and_data,
                    ))

        assert len(result) == 1
        assert result[0].source == "rule"
        assert result[0].ai_fallback is True

    def test_ai_errors_queue_entry_on_fallback(self):
        """On fallback, one entry is enqueued to scrape:ai-errors queue."""
        mock_redis = MagicMock()
        mock_redis.incr.return_value = 42
        mock_redis.exists.return_value = 0

        merchant_id = str(uuid.uuid4())
        job_id = enqueue_ai_error(mock_redis, merchant_id, batch_size=3, error_type="gemini_timeout")

        # Verify Redis writes: incr for job ID, hset for job data, rpush for queue
        mock_redis.incr.assert_called_once_with("bull:scrape:ai-errors:id")
        mock_redis.hset.assert_called_once()

        hset_args = mock_redis.hset.call_args
        job_key = hset_args[0][0]
        assert job_key.startswith("bull:scrape:ai-errors:")

        mapping = hset_args[1]["mapping"] if "mapping" in hset_args[1] else hset_args[0][1]
        if isinstance(mapping, dict):
            data = json.loads(mapping.get("data", "{}"))
            assert data["merchant_id"] == merchant_id
            assert data["batch_size"] == 3
            assert data["error_type"] == "gemini_timeout"

        mock_redis.rpush.assert_called_once()
        push_args = mock_redis.rpush.call_args[0]
        assert push_args[0] == "bull:scrape:ai-errors:wait"

    def test_fallback_counter_incremented_per_event(self):
        """Fallback counter key follows format and is incremented with 24hr TTL."""
        mock_redis = MagicMock()
        mock_redis.incr.return_value = 3

        merchant_id = str(uuid.uuid4())
        count = increment_fallback_counter(mock_redis, merchant_id)

        assert count == 3
        mock_redis.incr.assert_called_once_with(f"ai:fallback:count:{merchant_id}")
        mock_redis.expire.assert_called_once_with(f"ai:fallback:count:{merchant_id}", 86_400)

    def test_quota_exhausted_flag_bypasses_gemini(self):
        """When ai:quota-exhausted key is set, all SKUs go to rule fallback immediately."""
        sku = _make_sku(price=100.0)
        data_points = _make_data_points([(120.0, True)])
        skus_and_data = [(sku, data_points)]

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis(quota_exhausted=True)

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_get_model.return_value = mock_model

            result = asyncio.run(process_merchant_batch(
                session, redis,
                merchant_id=str(uuid.uuid4()),
                plan="cipher",
                eclipse_interval_s=300,
                skus_and_data=skus_and_data,
            ))

        # Gemini never called when quota flag is set
        mock_model.generate_content.assert_not_called()
        assert len(result) == 1
        assert result[0].source == "rule"
        assert result[0].ai_fallback is True

    def test_partial_batch_fallback_for_missing_skus(self):
        """When Gemini returns fewer SKUs than sent, missing ones get rule fallback."""
        sku_a = _make_sku(price=100.0)
        sku_b = _make_sku(price=200.0)
        data_a = _make_data_points([(120.0, True)])
        data_b = _make_data_points([(240.0, True)])
        skus_and_data = [(sku_a, data_a), (sku_b, data_b)]

        # Gemini only returns signal for sku_a; sku_b is missing from response
        ai_response = [{
            "sku_id": str(sku_a.id),
            "signal": "RAISE",
            "confidence": 0.9,
            "price_suggestion": None,
            "reasoning": "Room to raise",
        }]

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis()

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_model.generate_content.return_value = _gemini_response_json(ai_response)
            mock_get_model.return_value = mock_model

            result = asyncio.run(process_merchant_batch(
                session, redis,
                merchant_id=str(uuid.uuid4()),
                plan="cipher",
                eclipse_interval_s=300,
                skus_and_data=skus_and_data,
            ))

        assert len(result) == 2
        sources = {r.source for r in result}
        assert "ai" in sources    # sku_a got AI signal
        assert "rule" in sources  # sku_b fell back to rule

        fallback_signals = [r for r in result if r.source == "rule"]
        assert all(s.ai_fallback is True for s in fallback_signals)

    def test_invalid_json_fallbacks_whole_batch(self):
        """Invalid Gemini JSON → rule fallback for all SKUs in batch."""
        skus_and_data = [
            (_make_sku(price=100.0), _make_data_points([(120.0, True)])),
            (_make_sku(price=150.0), _make_data_points([(180.0, True)])),
        ]

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis()

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            bad_response = MagicMock()
            bad_response.text = "This is not JSON at all"
            mock_model.generate_content.return_value = bad_response
            mock_get_model.return_value = mock_model

            result = asyncio.run(process_merchant_batch(
                session, redis,
                merchant_id=str(uuid.uuid4()),
                plan="cipher",
                eclipse_interval_s=300,
                skus_and_data=skus_and_data,
            ))

        assert len(result) == 2
        assert all(r.source == "rule" for r in result)
        assert all(r.ai_fallback is True for r in result)

    def test_ai_signal_has_ai_model_field(self):
        """AI signals are stored with ai_model='gemini-1.5-pro'."""
        sku = _make_sku(price=100.0)
        data_points = _make_data_points([(120.0, True)])
        skus_and_data = [(sku, data_points)]
        sku_id = str(sku.id)

        ai_response = [{
            "sku_id": sku_id,
            "signal": "RAISE",
            "confidence": 0.80,
            "price_suggestion": None,
            "reasoning": "Competitor priced higher",
        }]

        signals_written = []
        session = self._make_session(signals_written)
        redis = self._make_redis()

        reset_model_singleton()
        with patch("signals.ai_engine._get_model") as mock_get_model:
            mock_model = MagicMock()
            mock_model.generate_content.return_value = _gemini_response_json(ai_response)
            mock_get_model.return_value = mock_model

            result = asyncio.run(process_merchant_batch(
                session, redis,
                merchant_id=str(uuid.uuid4()),
                plan="cipher",
                eclipse_interval_s=300,
                skus_and_data=skus_and_data,
            ))

        assert len(result) == 1
        assert result[0].ai_model == "gemini-1.5-pro"


# ── Prompt construction tests ─────────────────────────────────────────────────

class TestPromptConstruction:
    def test_sku_entry_includes_floor_ceiling_when_set(self):
        sku = _make_sku(floor_price=80.0, ceiling_price=140.0)
        data = _make_data_points([(110.0, True)])
        entry = _build_sku_entry(sku, data)
        assert "floor_price" in entry
        assert "ceiling_price" in entry
        assert entry["floor_price"] == 80.0
        assert entry["ceiling_price"] == 140.0

    def test_sku_entry_omits_floor_ceiling_when_none(self):
        sku = _make_sku(floor_price=None, ceiling_price=None)
        data = _make_data_points([(110.0, True)])
        entry = _build_sku_entry(sku, data)
        assert "floor_price" not in entry
        assert "ceiling_price" not in entry

    def test_competitor_list_uses_domain_field(self):
        data = _make_data_points([(100.0, True), (110.0, False)])
        comp_list = _build_competitor_list(data)
        assert all("domain" in c for c in comp_list)
        assert all("competitor0.com" in c["domain"] or "competitor1.com" in c["domain"] for c in comp_list)

    def test_sku_entry_merchant_price_is_float(self):
        sku = _make_sku(price=99.99)
        data = _make_data_points([(110.0, True)])
        entry = _build_sku_entry(sku, data)
        assert isinstance(entry["merchant_price"], float)
        assert abs(entry["merchant_price"] - 99.99) < 0.01

    def test_sku_entry_includes_sku_id(self):
        sku = _make_sku()
        data = _make_data_points([(110.0, True)])
        entry = _build_sku_entry(sku, data)
        assert entry["sku_id"] == str(sku.id)
