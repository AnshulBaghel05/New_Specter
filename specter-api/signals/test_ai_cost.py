"""Audit #4 Task 7 — a successful Gemini call accrues AI token cost to the merchant.

Cost is per-merchant (no shared-crawl split — the LLM call is made for one
merchant's batch). Recording is best-effort and must never break signal flow.
"""
from __future__ import annotations

import asyncio
import json
import uuid
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

from signals.ai_engine import MODEL_NAME, _call_gemini_batch
from signals.rule_engine import CompetitorDataPoint


def _make_sku() -> MagicMock:
    sku = MagicMock()
    sku.id = uuid.uuid4()
    sku.title = "Test Product"
    sku.current_price = Decimal("100")
    sku.floor_price = Decimal("80")
    sku.ceiling_price = Decimal("140")
    sku.currency = "USD"
    return sku


def _make_data_points() -> list[CompetitorDataPoint]:
    return [
        CompetitorDataPoint(
            tracking_id=str(uuid.uuid4()), price=Decimal("95"), in_stock=True,
            currency="USD", domain="a.com", competitor_url_id=str(uuid.uuid4())),
        CompetitorDataPoint(
            tracking_id=str(uuid.uuid4()), price=Decimal("99"), in_stock=True,
            currency="USD", domain="b.com", competitor_url_id=str(uuid.uuid4())),
    ]


def _response_with_usage(sku_id: str, in_tok: int, out_tok: int) -> MagicMock:
    resp = MagicMock()
    resp.text = json.dumps([{
        "sku_id": sku_id, "signal": "HOLD", "confidence": 0.7,
        "price_suggestion": None, "reasoning": "stable",
    }])
    usage = MagicMock()
    usage.prompt_token_count = in_tok
    usage.candidates_token_count = out_tok
    resp.usage_metadata = usage
    return resp


def test_successful_call_records_ai_cost():
    sku = _make_sku()
    data = _make_data_points()
    merchant_id = str(uuid.uuid4())
    resp = _response_with_usage(str(sku.id), 1_000, 200)

    rec = AsyncMock()
    with patch("signals.ai_engine._get_model") as mock_get_model, \
         patch("signals.ai_engine.record_ai_cost", rec):
        mock_model = MagicMock()
        mock_model.generate_content.return_value = resp
        mock_get_model.return_value = mock_model

        out = asyncio.run(_call_gemini_batch(
            AsyncMock(), MagicMock(), merchant_id, [(sku, data)]))

    assert out is not None
    rec.assert_awaited_once()
    a = rec.await_args.args
    # signature: record_ai_cost(session, redis, merchant_id, model, input_tokens, output_tokens)
    assert a[2] == merchant_id
    assert a[3] == MODEL_NAME
    assert a[4] == 1_000
    assert a[5] == 200


def test_missing_usage_metadata_does_not_raise_or_record():
    sku = _make_sku()
    data = _make_data_points()
    resp = _response_with_usage(str(sku.id), 0, 0)
    resp.usage_metadata = None   # provider omitted usage

    rec = AsyncMock()
    with patch("signals.ai_engine._get_model") as mock_get_model, \
         patch("signals.ai_engine.record_ai_cost", rec):
        mock_model = MagicMock()
        mock_model.generate_content.return_value = resp
        mock_get_model.return_value = mock_model

        out = asyncio.run(_call_gemini_batch(
            AsyncMock(), MagicMock(), str(uuid.uuid4()), [(sku, data)]))

    assert out is not None       # signal flow unaffected
    rec.assert_not_awaited()     # nothing to record without usage
