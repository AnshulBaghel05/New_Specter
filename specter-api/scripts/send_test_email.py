"""Send one real test email per backend template via Resend.

    RESEND_API_KEY=re_xxx python scripts/send_test_email.py <recipient>

Use a real inbox (Gmail recommended) to verify rendering, or Resend's sandbox
sink `delivered@resend.dev`. Requires a live RESEND_API_KEY + a verified
RESEND_FROM domain. Reports per-template success/failure; never raises.
"""
from __future__ import annotations

import asyncio
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

from services import email  # noqa: E402

SENDS = [
    ("Product signal — RAISE", lambda to: email.send_signal_alert_email(to, "Nike Air Max 270", "RAISE")),
    ("Product signal — LOWER", lambda to: email.send_signal_alert_email(to, "Adidas Ultraboost 22", "LOWER")),
    ("Competitor restock",     lambda to: email.send_restock_alert_email(to, "New Balance 574")),
    ("Out-of-stock alert",     lambda to: email.send_oos_alert_email(to, "rivalshop.com", "Nike Air Max 270")),
]


async def _run(recipient: str) -> None:
    if not email._RESEND_API_KEY:
        print("RESEND_API_KEY not set — aborting (no email sent).")
        return
    for label, fn in SENDS:
        ok = await fn(recipient)
        print(f"{'OK ' if ok else 'FAIL'}  {label}  ->  {recipient}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: python scripts/send_test_email.py <recipient-email>")
        raise SystemExit(2)
    asyncio.run(_run(sys.argv[1]))
