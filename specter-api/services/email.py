"""
Transactional email via Resend (F5 notifications).

Thin async wrapper over the Resend REST API (https://api.resend.com/emails) using
httpx — avoids adding the resend SDK dependency. Three templated senders:

  send_oos_alert_email      — competitor went out of stock (F5 AC#3–4)
  send_scrape_failed_email  — a tracked URL failed repeatedly (F3 AC#6)
  send_domain_blocked_email — robots.txt / bot wall blocked a URL (F2 edge case)

All senders are best-effort: a failure logs and returns False rather than raising,
so a mail outage never blocks the signal/scrape pipeline.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("specter.email")

_RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
_FROM_ADDRESS = os.environ.get("RESEND_FROM", "SPECTER <alerts@specterapp.io>")
_DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://app.specterapp.io")
_RESEND_ENDPOINT = "https://api.resend.com/emails"


async def _send(to: str, subject: str, html: str) -> bool:
    if not _RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s (%s)", to, subject)
        return False
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                _RESEND_ENDPOINT,
                headers={"Authorization": f"Bearer {_RESEND_API_KEY}"},
                json={"from": _FROM_ADDRESS, "to": [to], "subject": subject, "html": html},
            )
        if resp.status_code >= 300:
            logger.error("Resend send failed (%s): %s", resp.status_code, resp.text[:200])
            return False
        return True
    except httpx.HTTPError as err:
        logger.error("Resend request error sending to %s: %s", to, err)
        return False


def _shell(body_html: str) -> str:
    """Minimal dark-themed email shell matching SPECTER brand."""
    return f"""\
<div style="font-family:system-ui,-apple-system,sans-serif;background:#06070D;color:#E8EAF0;padding:32px;border-radius:12px;max-width:520px;margin:0 auto">
  <div style="font-weight:700;font-size:18px;margin-bottom:20px">SPECTER<span style="color:#00E87A">.</span></div>
  {body_html}
  <hr style="border:none;border-top:1px solid #1A1D2E;margin:24px 0" />
  <p style="color:#6B7280;font-size:12px">You're receiving this because email notifications are on. Manage them in
  <a href="{_DASHBOARD_URL}/settings" style="color:#00E87A">Settings</a>.</p>
</div>"""


# ── OOS alert (F5 AC#3–4) ─────────────────────────────────────────────────────

async def send_oos_alert_email(to: str, competitor_name: str, sku_title: str) -> bool:
    subject = f"🔴 {competitor_name} is out of stock — raise your price"
    body = f"""\
  <h2 style="font-size:20px;margin:0 0 12px">A competitor just went out of stock</h2>
  <p style="color:#E8EAF0;line-height:1.6"><strong>{competitor_name}</strong> is now out of stock for your product
  <strong>{sku_title}</strong>. This is your window to raise price and capture demand they can't fulfil.</p>
  <a href="{_DASHBOARD_URL}/repricing" style="display:inline-block;margin-top:16px;background:#00E87A;color:#06070D;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">Review repricing →</a>"""
    return await _send(to, subject, _shell(body))


# ── Scrape failure (F3 AC#6) ─────────────────────────────────────────────────

async def send_scrape_failed_email(to: str, domain: str) -> bool:
    subject = f"⚠️ Tracking issue with {domain}"
    body = f"""\
  <h2 style="font-size:20px;margin:0 0 12px">We couldn't track a competitor</h2>
  <p style="color:#E8EAF0;line-height:1.6">SPECTER repeatedly failed to read pricing from <strong>{domain}</strong>.
  We'll keep retrying, but you may want to verify the URL is still valid.</p>
  <a href="{_DASHBOARD_URL}/competitors" style="display:inline-block;margin-top:16px;background:#00E87A;color:#06070D;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">View competitors →</a>"""
    return await _send(to, subject, _shell(body))


# ── ECLIPSE dedicated-worker fallback (F10 edge case) ────────────────────────

async def send_eclipse_fallback_email(to: str, domain: str | None = None) -> bool:
    """Notify an ECLIPSE merchant that their dedicated worker is down and we have
    fallen back to shared workers (F10: notify within 15 min of failure)."""
    subject = "⚠️ SPECTER dedicated worker fell back to shared capacity"
    target = f" for <strong>{domain}</strong>" if domain else ""
    body = f"""\
  <h2 style="font-size:20px;margin:0 0 12px">Your dedicated worker is temporarily unavailable</h2>
  <p style="color:#E8EAF0;line-height:1.6">SPECTER could not reach your dedicated ECLIPSE worker{target}, so we
  automatically re-queued the scrape on shared capacity to keep your data flowing. No action is needed —
  our ops team has been alerted and is restoring the dedicated instance.</p>
  <a href="{_DASHBOARD_URL}/signals" style="display:inline-block;margin-top:16px;background:#00E87A;color:#06070D;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">View signals →</a>"""
    return await _send(to, subject, _shell(body))


# ── Trial expiry reminders (billing — PRICING.md Trial Policy) ───────────────

async def send_trial_reminder_email(to: str, kind: str) -> bool:
    """Day-12 ("2 days left") and day-14 ("last day") trial reminders.

    `kind` is "two_days_left" or "last_day". Returns False for an unknown kind so
    a caller bug can't send a blank email.
    """
    if kind == "two_days_left":
        subject = "⏳ 2 days left on your SPECTER trial"
        headline = "Your trial ends in 2 days"
        message = (
            "You're 2 days from the end of your 14-day SPECTER trial. Add a payment "
            "method now to keep live competitor monitoring, signals, and alerts running "
            "without interruption."
        )
    elif kind == "last_day":
        subject = "🔔 Last day — add payment to keep SPECTER live"
        headline = "Today is the last day of your trial"
        message = (
            "Your SPECTER trial ends today. Add a payment method now or your account "
            "drops to the free plan tomorrow — your saved work stays, but live "
            "monitoring, signals, and auto-reprice pause until you subscribe."
        )
    else:
        return False

    body = f"""\
  <h2 style="font-size:20px;margin:0 0 12px">{headline}</h2>
  <p style="color:#E8EAF0;line-height:1.6">{message}</p>
  <a href="{_DASHBOARD_URL}/settings/billing" style="display:inline-block;margin-top:16px;background:#00E87A;color:#06070D;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">Add payment method →</a>"""
    return await _send(to, subject, _shell(body))


# ── Domain blocked (F2 edge case) ────────────────────────────────────────────

async def send_domain_blocked_email(to: str, domain: str, robots_blocked: bool) -> bool:
    reason = (
        "the site's robots.txt disallows automated access"
        if robots_blocked
        else "the site uses bot protection we can't bypass"
    )
    subject = f"🚫 Can't track {domain}"
    body = f"""\
  <h2 style="font-size:20px;margin:0 0 12px">This competitor URL can't be tracked</h2>
  <p style="color:#E8EAF0;line-height:1.6">We were unable to track <strong>{domain}</strong> because {reason}.
  Try a different competitor URL for this product.</p>
  <a href="{_DASHBOARD_URL}/competitors" style="display:inline-block;margin-top:16px;background:#00E87A;color:#06070D;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">Manage competitors →</a>"""
    return await _send(to, subject, _shell(body))
