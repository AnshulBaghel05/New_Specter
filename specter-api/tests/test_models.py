import uuid
from datetime import datetime


def test_base_has_id_and_created_at():
    from models.base import Base
    assert hasattr(Base, "id")
    assert hasattr(Base, "created_at")


def test_merchant_tablename_and_columns():
    from models.merchants import Merchant
    from sqlalchemy import inspect
    mapper = inspect(Merchant)
    cols = {c.key for c in mapper.columns}
    assert Merchant.__tablename__ == "merchants"
    assert {"id", "created_at", "supabase_user_id", "plan", "shopify_domain",
            "shopify_access_token", "woo_api_key", "razorpay_subscription_id",
            "trial_ends_at", "read_only", "shopify_reconnect_required",
            "eclipse_interval_ms", "max_competitors_per_sku",
            "auto_reprice_enabled", "email_notifications_enabled",
            "notification_email", "subscription_current_end",
            "subscription_cancel_at"} == cols


def test_sku_tablename_and_columns():
    from models.skus import SKU
    from sqlalchemy import inspect
    mapper = inspect(SKU)
    cols = {c.key for c in mapper.columns}
    assert SKU.__tablename__ == "skus"
    assert {"id", "created_at", "merchant_id", "title", "handle",
            "current_price", "floor_price", "ceiling_price", "currency",
            "shopify_variant_id", "active", "auto_reprice_enabled"} == cols


def test_competitor_url_tablename_and_columns():
    from models.competitor_urls import CompetitorURL
    from sqlalchemy import inspect
    mapper = inspect(CompetitorURL)
    cols = {c.key for c in mapper.columns}
    assert CompetitorURL.__tablename__ == "competitor_urls"
    assert {"id", "created_at", "domain", "url_path",
            "last_scraped_at", "robots_blocked", "currency",
            "interval_ms", "phase_offset_ms", "next_run_at"} == cols


def test_competitor_tracking_tablename_and_columns():
    from models.competitor_trackings import CompetitorTracking
    from sqlalchemy import inspect
    mapper = inspect(CompetitorTracking)
    cols = {c.key for c in mapper.columns}
    assert CompetitorTracking.__tablename__ == "competitor_trackings"
    assert {"id", "created_at", "own_product_id", "competitor_url_id",
            "merchant_id", "enabled", "silenced_oos"} == cols


def test_price_snapshot_tablename_and_columns():
    from models.price_snapshots import PriceSnapshot
    from sqlalchemy import inspect
    mapper = inspect(PriceSnapshot)
    cols = {c.key for c in mapper.columns}
    assert PriceSnapshot.__tablename__ == "price_snapshots"
    assert {"id", "created_at", "competitor_url_id", "price", "currency",
            "in_stock", "scraped_at", "raw_s3_key", "needs_review", "delete_at",
            "job_uuid"} == cols


def test_signal_tablename_and_columns():
    from models.signals import Signal
    from sqlalchemy import inspect
    mapper = inspect(Signal)
    cols = {c.key for c in mapper.columns}
    assert Signal.__tablename__ == "signals"
    assert {"id", "created_at", "sku_id", "type", "confidence", "reasoning",
            "price_suggestion", "source", "ai_fallback", "ai_model"} == cols


def test_oos_alert_tablename_and_columns():
    from models.oos_alerts import OOSAlert
    from sqlalchemy import inspect
    mapper = inspect(OOSAlert)
    cols = {c.key for c in mapper.columns}
    assert OOSAlert.__tablename__ == "oos_alerts"
    assert {"id", "created_at", "competitor_tracking_id", "sku_id",
            "detected_at", "resolved_at", "notified_at"} == cols


def test_price_change_tablename_and_columns():
    from models.price_changes import PriceChange
    from sqlalchemy import inspect
    mapper = inspect(PriceChange)
    cols = {c.key for c in mapper.columns}
    assert PriceChange.__tablename__ == "price_changes"
    assert {"id", "created_at", "sku_id", "signal_id", "old_price",
            "new_price", "source", "revenue_delta"} == cols


def test_merchant_addon_tablename_and_columns():
    from models.merchant_addons import MerchantAddon
    from sqlalchemy import inspect
    mapper = inspect(MerchantAddon)
    cols = {c.key for c in mapper.columns}
    assert MerchantAddon.__tablename__ == "merchant_addons"
    assert {"id", "created_at", "merchant_id", "addon_type", "quantity",
            "razorpay_subscription_id"} == cols


def test_all_models_export_from_models_package():
    from models import (
        Merchant, SKU, CompetitorURL, CompetitorTracking, PriceSnapshot,
        Signal, OOSAlert, PriceChange, MerchantAddon,
    )
    assert all([Merchant, SKU, CompetitorURL, CompetitorTracking, PriceSnapshot,
                Signal, OOSAlert, PriceChange, MerchantAddon])


def test_get_db_is_async_generator():
    import inspect as stdlib_inspect
    from db import get_db
    assert stdlib_inspect.isasyncgenfunction(get_db)


def test_redis_client_is_configured():
    from redis_client import redis
    from redis import Redis
    assert isinstance(redis, Redis)
