"""SSRF guard for merchant-supplied competitor URLs.

Competitor URLs are fetched server-side by the scraper, so an attacker could try
to point one at internal infrastructure (cloud metadata, localhost, private
ranges). `is_safe_competitor_url` allows only public http(s) URLs and rejects any
host that is — or resolves to — a private/loopback/link-local/reserved address.

Pure + dependency-free so it is unit-testable; DNS resolution is best-effort and
failures are treated as unsafe (fail closed).
"""
from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

_ALLOWED_SCHEMES = ("http", "https")


def _ip_is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    # Block everything that isn't a normal routable public address.
    return not (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_reserved
        or addr.is_multicast
        or addr.is_unspecified
    )


def is_safe_competitor_url(url: str, *, resolve: bool = True) -> tuple[bool, str]:
    """Return (ok, reason). `reason` is a short machine-friendly code on failure."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False, "malformed_url"

    if parsed.scheme.lower() not in _ALLOWED_SCHEMES:
        return False, "scheme_not_allowed"

    host = parsed.hostname
    if not host:
        return False, "missing_host"

    lowered = host.lower()
    if lowered == "localhost" or lowered.endswith(".localhost"):
        return False, "loopback_host"

    # Host given as an IP literal — check it directly (no DNS needed).
    try:
        ipaddress.ip_address(host)
        return (True, "ok") if _ip_is_public(host) else (False, "private_ip")
    except ValueError:
        pass  # hostname, not an IP literal

    if not resolve:
        return True, "ok"

    # Resolve the hostname and reject if ANY resolved address is non-public
    # (defends against DNS rebinding to a private range).
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError, OSError):
        return False, "unresolvable_host"

    for info in infos:
        ip = info[4][0]
        if not _ip_is_public(ip):
            return False, "resolves_to_private_ip"

    return True, "ok"
