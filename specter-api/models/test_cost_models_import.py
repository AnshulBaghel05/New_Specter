from models.merchant_cost_daily import MerchantCostDaily
from models.cost_event_sample import CostEventSample


def test_merchant_cost_daily_columns():
    cols = set(MerchantCostDaily.__table__.columns.keys())
    assert {"merchant_id", "date", "cost_type", "cost_usd", "units", "sample_count"} <= cols


def test_cost_event_sample_columns():
    cols = set(CostEventSample.__table__.columns.keys())
    assert {"merchant_id", "cost_type", "proxy_tier", "units", "cost_usd", "domain"} <= cols
