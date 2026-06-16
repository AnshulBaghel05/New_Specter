from __future__ import annotations
import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

DATABASE_URL = os.environ["DATABASE_URL"]


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
