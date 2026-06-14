"""SSRF guard tests — public URLs pass; internal/private targets are rejected."""
from services.url_safety import is_safe_competitor_url


def test_public_ip_literal_allowed():
    ok, _ = is_safe_competitor_url("https://1.1.1.1/product")
    assert ok is True


def test_public_hostname_allowed_without_dns():
    ok, reason = is_safe_competitor_url("https://example.com/p", resolve=False)
    assert ok is True and reason == "ok"


def test_loopback_hostname_rejected():
    ok, reason = is_safe_competitor_url("http://localhost/admin")
    assert ok is False and reason == "loopback_host"


def test_loopback_ip_rejected():
    ok, reason = is_safe_competitor_url("http://127.0.0.1/")
    assert ok is False and reason == "private_ip"


def test_cloud_metadata_endpoint_rejected():
    ok, reason = is_safe_competitor_url("http://169.254.169.254/latest/meta-data/")
    assert ok is False and reason == "private_ip"  # link-local


def test_private_ranges_rejected():
    for host in ("10.0.0.5", "192.168.1.1", "172.16.0.9"):
        ok, reason = is_safe_competitor_url(f"http://{host}/p")
        assert ok is False and reason == "private_ip"


def test_non_http_scheme_rejected():
    ok, reason = is_safe_competitor_url("ftp://example.com/x")
    assert ok is False and reason == "scheme_not_allowed"


def test_missing_host_rejected():
    ok, reason = is_safe_competitor_url("https:///nohost")
    assert ok is False and reason == "missing_host"
