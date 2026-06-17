from __future__ import annotations
import os
from collections.abc import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# libpq-style query params that asyncpg.connect() does NOT accept as keyword args
# (SQLAlchemy forwards unknown query params to the driver). asyncpg negotiates TLS
# itself (default sslmode=prefer → uses SSL when the server requires it, as Supabase
# / Neon do), so dropping these keeps a secure connection while avoiding a
# "connect() got an unexpected keyword argument 'sslmode'" crash at first connect.
_LIBPQ_ONLY_PARAMS = {"sslmode", "channel_binding", "gssencmode", "pgbouncer", "options"}


def normalize_database_url(raw: str | None) -> str:
    """Coerce a Postgres connection string into the async driver URL SQLAlchemy needs.

    Handles the common deploy mistakes that otherwise crash the app on startup:
      - bare ``postgres://`` / ``postgresql://`` schemes → ``postgresql+asyncpg://``
      - surrounding whitespace or quotes from copy-paste / shell vars
      - libpq-only query params (``sslmode``, ``channel_binding`` …) asyncpg rejects
      - empty value or an unresolved ``${{ ... }}`` Railway reference → clear error
    """
    url = (raw or "").strip().strip('"').strip("'")
    if not url or url.startswith("${{") or "${{" in url:
        raise RuntimeError(
            "DATABASE_URL is missing, empty, or an unresolved variable reference. "
            "Set it to your Postgres connection string using the "
            "postgresql+asyncpg:// scheme, e.g. "
            "postgresql+asyncpg://USER:PASSWORD@HOST:6543/postgres"
        )

    if url.startswith("postgres://"):
        url = "postgresql+asyncpg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://"):
        url = "postgresql+asyncpg://" + url[len("postgresql://"):]

    parts = urlsplit(url)
    if parts.query:
        kept = [
            (k, v)
            for k, v in parse_qsl(parts.query, keep_blank_values=True)
            if k.lower() not in _LIBPQ_ONLY_PARAMS
        ]
        url = urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(kept), parts.fragment)
        )
    return url


DATABASE_URL = normalize_database_url(os.environ.get("DATABASE_URL"))


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, ValueError):
        return default


# Pool sizing + reliability tuned for production behind a connection pooler
# (Supabase / Railway pgbouncer) under real concurrency. The bare default engine
# (pool_size=5, no pre-ping) caps throughput and breaks under a transaction pooler:
#   - pool_pre_ping  — discard a dead connection instead of erroring on a stale
#                      socket after Postgres' idle timeout closes it.
#   - pool_recycle   — proactively recycle a connection before the server/pooler
#                      would, avoiding "server closed the connection unexpectedly".
#   - statement_cache_size=0 — asyncpg caches prepared statements per connection,
#                      which collides under pgbouncer TRANSACTION pooling
#                      ("prepared statement \"__asyncpg_...\" already exists").
#                      Disabling the cache is the supported way to run asyncpg
#                      behind a transaction pooler; it is a no-op on a direct conn.
# All sizes are env-overridable so a deploy can scale the pool without a code change.
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=_int_env("DB_POOL_SIZE", 20),
    max_overflow=_int_env("DB_MAX_OVERFLOW", 10),
    pool_recycle=_int_env("DB_POOL_RECYCLE_SECONDS", 1800),
    connect_args={"statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
