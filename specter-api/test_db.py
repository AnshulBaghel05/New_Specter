"""Unit tests for DATABASE_URL normalization (db.normalize_database_url).

These guard the deploy foot-gun where a provider/UI hands us a connection string
in a scheme SQLAlchemy's async engine can't use, or with libpq-only query params
asyncpg rejects. The function must coerce common inputs into a driver-correct
postgresql+asyncpg:// URL and fail loudly on clearly invalid ones.
"""
import pytest

from db import normalize_database_url


def test_passes_through_async_url_unchanged():
    url = "postgresql+asyncpg://user:pass@host:6543/postgres"
    assert normalize_database_url(url) == url


def test_coerces_bare_postgres_scheme():
    assert normalize_database_url(
        "postgres://user:pass@host:5432/db"
    ) == "postgresql+asyncpg://user:pass@host:5432/db"


def test_coerces_postgresql_scheme():
    assert normalize_database_url(
        "postgresql://user:pass@host:5432/db"
    ) == "postgresql+asyncpg://user:pass@host:5432/db"


def test_strips_surrounding_whitespace_and_quotes():
    raw = '  "postgresql://user:pass@host:5432/db"  '
    assert normalize_database_url(raw) == "postgresql+asyncpg://user:pass@host:5432/db"


def test_drops_libpq_only_query_params_asyncpg_rejects():
    # Neon-style URL: sslmode/channel_binding would make asyncpg.connect() raise
    # "unexpected keyword argument". asyncpg negotiates TLS on its own (default
    # sslmode=prefer), so dropping them keeps the secure connection working.
    out = normalize_database_url(
        "postgresql://u:p@host/db?sslmode=require&channel_binding=require"
    )
    assert out == "postgresql+asyncpg://u:p@host/db"


def test_keeps_unrelated_query_params():
    out = normalize_database_url(
        "postgresql://u:p@host/db?application_name=specter&sslmode=require"
    )
    assert out == "postgresql+asyncpg://u:p@host/db?application_name=specter"


def test_empty_raises_actionable_error():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        normalize_database_url("   ")


def test_unresolved_railway_reference_raises():
    # A ${{ Postgres.DATABASE_URL }} reference left literal because no Postgres
    # service exists must fail with a clear message, not a cryptic parse error.
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        normalize_database_url("${{Postgres.DATABASE_URL}}")
