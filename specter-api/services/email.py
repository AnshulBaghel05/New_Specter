"""
Transactional / alert email via Resend.

Central design:
  send_email(template, to, data)  — the ONE entry point. Looks up a named
  template in _TEMPLATES, renders it through the dark-brand `_shell`, and sends
  via Resend's REST API (httpx, no SDK). Every legacy sender below is now a thin
  wrapper over send_email, so there are no scattered one-off send calls.

Reliability:
  * Best-effort — a failure logs and returns False, never raises, so a mail
    outage can't block the signal/scrape/billing pipeline that triggered it.
  * Bounded retry on transient errors (5xx / network), never on 4xx or a missing
    key (those are terminal — retrying can't help).
  * Every attempt is logged (success and failure) for debugging.

Compliance:
  * Alert templates (OOS, signal, scrape-failed, …) carry a List-Unsubscribe
    header + a one-click preferences link (Gmail bulk-sender friendly). Account
    transactional auth mail (confirmation, password reset) is sent by Supabase,
    NOT here, so it correctly has no unsubscribe.
"""
from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Callable

import httpx

logger = logging.getLogger("specter.email")

_RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
_FROM_ADDRESS = os.environ.get("RESEND_FROM", "SPECTER <alerts@specterapp.io>")
_DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "https://app.specterapp.io")
_UNSUBSCRIBE_MAILTO = os.environ.get("RESEND_UNSUBSCRIBE_MAILTO", "unsubscribe@specterapp.io")
_RESEND_ENDPOINT = "https://api.resend.com/emails"

_MAX_ATTEMPTS = 3          # 1 initial + 2 retries on transient failure
_RETRY_BACKOFF_S = 0.5     # short, since this runs inside the request/cycle path


# ── Core sender ─────────────────────────────────────────────────────────────────

async def _send(to: str, subject: str, html: str, *, alert: bool = False) -> bool:
    """POST one email to Resend. Returns True on a 2xx, False otherwise. Retries
    transient failures (5xx / network) up to _MAX_ATTEMPTS; 4xx and a missing key
    are terminal. Never raises."""
    if not _RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s (%s)", to, subject)
        return False

    payload: dict = {"from": _FROM_ADDRESS, "to": [to], "subject": subject, "html": html}
    if alert:
        # Gmail/Yahoo bulk-sender one-click unsubscribe + a human preferences link.
        payload["headers"] = {
            "List-Unsubscribe": f"<{_DASHBOARD_URL}/settings>, <mailto:{_UNSUBSCRIBE_MAILTO}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }

    for attempt in range(1, _MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    _RESEND_ENDPOINT,
                    headers={"Authorization": f"Bearer {_RESEND_API_KEY}"},
                    json=payload,
                )
            if resp.status_code < 300:
                logger.info("email sent: to=%s subject=%r attempt=%d", to, subject, attempt)
                return True
            if resp.status_code < 500:
                # 4xx — caller/payload problem; retrying won't help.
                logger.error("email rejected (%s): to=%s %s", resp.status_code, to, resp.text[:200])
                return False
            logger.warning("email transient %s (attempt %d/%d): to=%s",
                           resp.status_code, attempt, _MAX_ATTEMPTS, to)
        except httpx.HTTPError as err:
            logger.warning("email request error (attempt %d/%d): to=%s: %s",
                           attempt, _MAX_ATTEMPTS, to, err)
        if attempt < _MAX_ATTEMPTS:
            await asyncio.sleep(_RETRY_BACKOFF_S * attempt)

    logger.error("email failed after %d attempts: to=%s subject=%r", _MAX_ATTEMPTS, to, subject)
    return False


def _shell(body_html: str, *, alert: bool = True) -> str:
    """Dark-themed email shell matching the SPECTER brand (#06070D / #00E87A)."""
    footer = (
        f"""<p style="color:#6B7280;font-size:12px">You're receiving this because email alerts are on. Manage or turn them off in <a href="{_DASHBOARD_URL}/settings" style="color:#00E87A">Settings</a>.</p>"""
        if alert else
        f"""<p style="color:#6B7280;font-size:12px">Sent by SPECTER · <a href="{_DASHBOARD_URL}" style="color:#00E87A">app.specterapp.io</a></p>"""
    )
    return f"""\
<div style="font-family:system-ui,-apple-system,sans-serif;background:#06070D;color:#E8EAF0;padding:32px;border-radius:12px;max-width:520px;margin:0 auto">
  <div style="font-weight:700;font-size:18px;margin-bottom:20px">SPECTER<span style="color:#00E87A">.</span></div>
  {body_html}
  <hr style="border:none;border-top:1px solid #1A1D2E;margin:24px 0" />
  {footer}
</div>"""


def _cta(href: str, label: str) -> str:
    return (f'<a href="{href}" style="display:inline-block;margin-top:16px;background:#00E87A;'
            f'color:#06070D;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none">{label}</a>')


# ── Template registry ────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class _Template:
    # data -> (subject, inner_body_html)
    build: Callable[[dict], tuple[str, str]]
    alert: bool   # True → List-Unsubscribe header + preferences footer


# Product-signal alert covers price moves (RAISE/LOWER) AND stock transitions
# (out of stock / back in stock). One template, branched on signal_type.
_SIGNAL_COPY: dict[str, tuple[str, str, str, str, str]] = {
    # type: (emoji+subject, headline, body, cta_label, cta_path)
    "RAISE":   ("📈 RAISE signal — {sku}", "A RAISE signal just fired",
                "Competitors are pricing above you on <strong>{sku}</strong> — there's room to raise and capture margin.",
                "Review signal →", "/signals"),
    "LOWER":   ("📉 LOWER signal — {sku}", "A LOWER signal just fired",
                "You're priced above the market on <strong>{sku}</strong> — consider lowering to stay competitive.",
                "Review signal →", "/signals"),
    "OOS":     ("🔴 Competitor out of stock — {sku}", "A competitor went out of stock",
                "A competitor is now out of stock for <strong>{sku}</strong>. This is your window to raise price and capture demand they can't fulfil.",
                "Review repricing →", "/repricing"),
    "RESTOCK": ("🟢 Competitor back in stock — {sku}", "A competitor is back in stock",
                "A competitor just came back in stock for <strong>{sku}</strong>. Competition has returned — review whether your price still holds.",
                "View product →", "/products"),
}


def _build_signal(data: dict) -> tuple[str, str]:
    sku = data.get("sku_title", "your product")
    kind = str(data.get("signal_type", "")).upper()
    subj, headline, body, label, path = _SIGNAL_COPY.get(kind, _SIGNAL_COPY["RAISE"])
    inner = (f'<h2 style="font-size:20px;margin:0 0 12px">{headline}</h2>'
             f'<p style="color:#E8EAF0;line-height:1.6">{body.format(sku=sku)}</p>'
             f'{_cta(f"{_DASHBOARD_URL}{path}", label)}')
    return subj.format(sku=sku), inner


def _build_oos(data: dict) -> tuple[str, str]:
    competitor = data.get("competitor_name", "A competitor")
    sku = data.get("sku_title", "your product")
    inner = ('<h2 style="font-size:20px;margin:0 0 12px">A competitor just went out of stock</h2>'
             f'<p style="color:#E8EAF0;line-height:1.6"><strong>{competitor}</strong> is now out of stock for your product '
             f"<strong>{sku}</strong>. This is your window to raise price and capture demand they can't fulfil.</p>"
             f'{_cta(f"{_DASHBOARD_URL}/repricing", "Review repricing →")}')
    return f"🔴 {competitor} is out of stock — raise your price", inner


def _build_scrape_failed(data: dict) -> tuple[str, str]:
    domain = data.get("domain", "a competitor")
    inner = ("<h2 style=\"font-size:20px;margin:0 0 12px\">We couldn't track a competitor</h2>"
             f'<p style="color:#E8EAF0;line-height:1.6">SPECTER repeatedly failed to read pricing from <strong>{domain}</strong>. '
             "We'll keep retrying, but you may want to verify the URL is still valid.</p>"
             f'{_cta(f"{_DASHBOARD_URL}/competitors", "View competitors →")}')
    return f"⚠️ Tracking issue with {domain}", inner


def _build_domain_blocked(data: dict) -> tuple[str, str]:
    domain = data.get("domain", "this competitor")
    reason = ("the site's robots.txt disallows automated access"
              if data.get("robots_blocked") else "the site uses bot protection we can't bypass")
    inner = ("<h2 style=\"font-size:20px;margin:0 0 12px\">This competitor URL can't be tracked</h2>"
             f'<p style="color:#E8EAF0;line-height:1.6">We were unable to track <strong>{domain}</strong> because {reason}. '
             "Try a different competitor URL for this product.</p>"
             f'{_cta(f"{_DASHBOARD_URL}/competitors", "Manage competitors →")}')
    return f"🚫 Can't track {domain}", inner


def _build_trial_reminder(data: dict) -> tuple[str, str]:
    kind = data.get("kind")
    if kind == "two_days_left":
        subject, headline, message = (
            "⏳ 2 days left on your SPECTER trial", "Your trial ends in 2 days",
            "You're 2 days from the end of your 14-day SPECTER trial. Add a payment method now to keep "
            "live competitor monitoring, signals, and alerts running without interruption.")
    else:  # last_day (callers guard unknown kinds before reaching here)
        subject, headline, message = (
            "🔔 Last day — add payment to keep SPECTER live", "Today is the last day of your trial",
            "Your SPECTER trial ends today. Add a payment method now or your account drops to the free plan "
            "tomorrow — your saved work stays, but live monitoring, signals, and auto-reprice pause until you subscribe.")
    inner = (f'<h2 style="font-size:20px;margin:0 0 12px">{headline}</h2>'
             f'<p style="color:#E8EAF0;line-height:1.6">{message}</p>'
             f'{_cta(f"{_DASHBOARD_URL}/settings/billing", "Add payment method →")}')
    return subject, inner


_TEMPLATES: dict[str, _Template] = {
    "signal_alert":   _Template(_build_signal, alert=True),
    "oos_alert":      _Template(_build_oos, alert=True),
    "scrape_failed":  _Template(_build_scrape_failed, alert=True),
    "domain_blocked": _Template(_build_domain_blocked, alert=True),
    "trial_reminder": _Template(_build_trial_reminder, alert=True),
}


async def send_email(template: str, to: str, data: dict) -> bool:
    """The single entry point for templated email. Unknown template → safe no-op
    (logged), so a typo can never send a blank email or raise."""
    tpl = _TEMPLATES.get(template)
    if tpl is None:
        logger.warning("email: unknown template %r — skipping send to %s", template, to)
        return False
    try:
        subject, body = tpl.build(data)
    except Exception:  # noqa: BLE001 — a build bug must not crash the trigger
        logger.exception("email: template %r failed to build", template)
        return False
    return await _send(to, subject, _shell(body, alert=tpl.alert), alert=tpl.alert)


# ── Backwards-compatible named senders (thin wrappers over send_email) ───────────

async def send_signal_alert_email(to: str, sku_title: str, signal_type: str) -> bool:
    """Product-signal alert: signal_type ∈ RAISE | LOWER | OOS | RESTOCK."""
    return await send_email("signal_alert", to, {"sku_title": sku_title, "signal_type": signal_type})


async def send_oos_alert_email(to: str, competitor_name: str, sku_title: str) -> bool:
    return await send_email("oos_alert", to, {"competitor_name": competitor_name, "sku_title": sku_title})


async def send_restock_alert_email(to: str, sku_title: str) -> bool:
    """Competitor back in stock — uses the unified signal template (RESTOCK)."""
    return await send_email("signal_alert", to, {"sku_title": sku_title, "signal_type": "RESTOCK"})


async def send_scrape_failed_email(to: str, domain: str) -> bool:
    return await send_email("scrape_failed", to, {"domain": domain})


async def send_domain_blocked_email(to: str, domain: str, robots_blocked: bool) -> bool:
    return await send_email("domain_blocked", to, {"domain": domain, "robots_blocked": robots_blocked})


async def send_trial_reminder_email(to: str, kind: str) -> bool:
    """Day-12 ("two_days_left") / day-14 ("last_day") reminders. Unknown kind →
    False so a caller bug can't send a blank email."""
    if kind not in ("two_days_left", "last_day"):
        return False
    return await send_email("trial_reminder", to, {"kind": kind})


# ── Ops/internal emails (not merchant alerts → no unsubscribe) ───────────────────

async def send_eclipse_fallback_email(to: str, domain: str | None = None) -> bool:
    """Notify an ECLIPSE merchant their dedicated worker fell back to shared capacity."""
    target = f" for <strong>{domain}</strong>" if domain else ""
    inner = ('<h2 style="font-size:20px;margin:0 0 12px">Your dedicated worker is temporarily unavailable</h2>'
             f'<p style="color:#E8EAF0;line-height:1.6">SPECTER could not reach your dedicated ECLIPSE worker{target}, so we '
             "automatically re-queued the scrape on shared capacity to keep your data flowing. No action is needed — "
             "our ops team has been alerted and is restoring the dedicated instance.</p>"
             f'{_cta(f"{_DASHBOARD_URL}/signals", "View signals →")}')
    return await _send(to, "⚠️ SPECTER dedicated worker fell back to shared capacity", _shell(inner, alert=False))


async def send_residential_budget_alert(
    to: str, *, day: str, residential_usd: float, total_usd: float, share: float,
    max_share: float, max_usd: float, reasons: tuple[str, ...] = (),
) -> bool:
    """Internal ops alert: residential proxy spend breached its budget."""
    reason_txt = " and ".join(
        {"share": f"share {share:.0%} &gt; {max_share:.0%} cap",
         "usd": f"${residential_usd:.2f} &gt; ${max_usd:.2f}/day cap"}.get(r, r)
        for r in reasons
    ) or "budget exceeded"
    inner = ('<h2 style="font-size:20px;margin:0 0 12px">Residential proxy spend breached budget</h2>'
             f'<p style="color:#E8EAF0;line-height:1.6">On <strong>{day}</strong>, residential proxy spend was '
             f"<strong>${residential_usd:.2f}</strong> ({share:.0%} of ${total_usd:.2f} total proxy spend). Trigger: {reason_txt}.</p>"
             '<p style="color:#6B7280;line-height:1.6">Residential is ~28× datacenter cost. A spike usually means a '
             "bot-wall wave reclassified many domains to JS-required, or a datacenter proxy-pool failover storm. "
             "Check /admin/cost/margin and the proxy health store.</p>")
    return await _send(to, f"⚠️ Residential proxy spend over budget on {day} ({share:.0%})",
                       _shell(inner, alert=False))
