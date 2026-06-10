"""
Fernet symmetric encryption for at-rest secrets (Shopify access tokens).

ENCRYPTION_KEY env var: URL-safe base64-encoded 32-byte key (Fernet.generate_key()).
Shared by routers/merchants.py (OAuth store) and services/repricer.py (decrypt for API calls).
"""
from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet() -> Fernet:
    key = os.environ.get("ENCRYPTION_KEY", "")
    if not key:
        raise RuntimeError("ENCRYPTION_KEY environment variable is not configured")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt token — key mismatch or corrupt data") from exc
