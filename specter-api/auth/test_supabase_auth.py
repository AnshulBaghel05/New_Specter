import os
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/test")
os.environ.setdefault("UPSTASH_REDIS_URL", "rediss://:password@localhost:6379")
os.environ["SUPABASE_JWT_SECRET"] = "test-supabase-jwt-secret-32-char!"

import asyncio
import time

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from jose import jwt
from jose.backends import ECKey

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
