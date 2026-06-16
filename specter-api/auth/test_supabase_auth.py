import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import asyncio
import time
import uuid
from unittest.mock import AsyncMock, MagicMock

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from fastapi.security import HTTPAuthorizationCredentials
from jose import jwt
from jose.backends import ECKey
from sqlalchemy.exc import IntegrityError

import auth.supabase as supa


def _es256_keypair_and_jwk(kid: str):
    key = ec.generate_private_key(ec.SECP256R1())
    priv_pem = key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    pub_pem = key.public_key().public_bytes(
        serialization.Encoding.PEM,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode()
    jwk = ECKey(pub_pem, "ES256").to_dict()
    jwk["kid"] = kid
    return priv_pem, jwk


def _claims(sub="user-1"):
    return {"sub": sub, "aud": "authenticated", "role": "authenticated",
            "iat": int(time.time()), "exp": int(time.time()) + 3600}


def test_es256_token_validated_against_jwks(monkeypatch):
    priv_pem, jwk = _es256_keypair_and_jwk("kid-A")
    token = jwt.encode(_claims("abc"), priv_pem, algorithm="ES256", headers={"kid": "kid-A"})
    # Seed the JWKS cache so no network fetch is needed.
    monkeypatch.setattr(supa, "_jwks_cache", {"kid-A": jwk})
    payload = asyncio.run(supa._decode_token(token))
    assert payload["sub"] == "abc"


def test_es256_unknown_kid_rejected(monkeypatch):
    priv_pem, _ = _es256_keypair_and_jwk("kid-A")
    token = jwt.encode(_claims(), priv_pem, algorithm="ES256", headers={"kid": "kid-A"})
    monkeypatch.setattr(supa, "_jwks_cache", {})          # cache miss
    monkeypatch.setattr(supa, "_JWKS_URL", "")            # no fetch source
    try:
        asyncio.run(supa._decode_token(token))
        assert False, "expected 401"
    except Exception as e:
        assert getattr(e, "status_code", None) == 401


def test_hs256_fallback_still_works():
    token = jwt.encode(_claims("legacy"), "test-supabase-jwt-secret-32-char!",
                       algorithm="HS256")
    payload = asyncio.run(supa._decode_token(token))
    assert payload["sub"] == "legacy"


def test_hs256_wrong_secret_rejected():
    token = jwt.encode(_claims(), "the-wrong-secret-padded-to-32char!!", algorithm="HS256")
    try:
        asyncio.run(supa._decode_token(token))
        assert False, "expected 401"
    except Exception as e:
        assert getattr(e, "status_code", None) == 401


# ── M1: first sign-in persists the merchant (commit, not just flush) ──────────

def _hs256(sub: str) -> HTTPAuthorizationCredentials:
    token = jwt.encode(_claims(sub), "test-supabase-jwt-secret-32-char!", algorithm="HS256")
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_first_signin_commits_new_merchant():
    """A brand-new user's merchant stub must be COMMITTED (not just flushed), so a
    read-only request actually persists the row instead of rolling it back."""
    no_row = MagicMock()
    no_row.scalar_one_or_none = MagicMock(return_value=None)
    session = AsyncMock()
    session.execute = AsyncMock(return_value=no_row)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.refresh = AsyncMock()

    merchant = asyncio.run(supa.get_current_merchant(credentials=_hs256("new-user"), session=session))

    assert merchant.supabase_user_id == "new-user"
    assert merchant.plan == "free"
    session.add.assert_called_once()
    session.commit.assert_awaited_once()   # the fix: commit, not flush
    session.refresh.assert_awaited_once()


def test_first_signin_race_reuses_existing_row():
    """Two concurrent first requests: the loser's commit hits the UNIQUE constraint
    on supabase_user_id; it must roll back and reuse the row that won, not 500."""
    none_row = MagicMock()
    none_row.scalar_one_or_none = MagicMock(return_value=None)

    existing = MagicMock(spec=supa.Merchant)
    existing.id = uuid.uuid4()
    existing.supabase_user_id = "racer"
    existing.plan = "free"
    existing.read_only = False
    existing.notification_email = None
    won_row = MagicMock()
    won_row.scalar_one = MagicMock(return_value=existing)

    session = AsyncMock()
    session.execute = AsyncMock(side_effect=[none_row, won_row])
    session.add = MagicMock()
    session.commit = AsyncMock(side_effect=IntegrityError("insert", {}, Exception("dup")))
    session.rollback = AsyncMock()
    session.refresh = AsyncMock()

    merchant = asyncio.run(supa.get_current_merchant(credentials=_hs256("racer"), session=session))

    assert merchant is existing
    session.rollback.assert_awaited_once()
