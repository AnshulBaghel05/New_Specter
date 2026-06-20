from __future__ import annotations
import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

from models.base import Base
import models  # noqa: F401 — side-effect import registers all 8 models with Base.metadata

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _migration_database_url() -> str:
    """Connection URL for running migrations.

    Migrations must NOT go through Supabase's transaction pooler (:6543): asyncpg's
    prepared statements and the `CREATE INDEX CONCURRENTLY` DDL in 0013 are rejected
    in transaction-pooling mode. The session pooler (:5432, same host) accepts both.

    The app's runtime `DATABASE_URL` points at :6543 for cheap short-lived
    connections, so for migrations we transparently retarget to :5432 unless an
    explicit `MIGRATION_DATABASE_URL` override is provided (e.g. a direct/non-pooler
    host). Local dev URLs (already :5432 or a non-pooler port) are left untouched.
    """
    explicit = os.environ.get("MIGRATION_DATABASE_URL")
    if explicit:
        return explicit
    return os.environ["DATABASE_URL"].replace(":6543/", ":5432/")


def run_migrations_offline() -> None:
    url = _migration_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    url = _migration_database_url()
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = url
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
