"""CORS origin allowlist parsing (main.parse_allowed_origins)."""
import pytest

from main import is_production_env, parse_allowed_origins, resolve_cors_origins


def test_unset_defaults_to_wildcard():
    assert parse_allowed_origins(None) == ["*"]


def test_empty_string_defaults_to_wildcard():
    assert parse_allowed_origins("") == ["*"]
    assert parse_allowed_origins("   ") == ["*"]


def test_single_origin():
    assert parse_allowed_origins("https://app.specterapp.io") == ["https://app.specterapp.io"]


def test_comma_list_is_split_and_trimmed():
    assert parse_allowed_origins(
        "https://app.specterapp.io, https://specter-web.vercel.app"
    ) == ["https://app.specterapp.io", "https://specter-web.vercel.app"]


def test_blank_entries_dropped():
    assert parse_allowed_origins("https://a.com,,  ,https://b.com") == [
        "https://a.com",
        "https://b.com",
    ]


def test_trailing_slash_stripped():
    # The production bug: ALLOWED_ORIGINS=https://new-specter.vercel.app/ must
    # still match the browser Origin (https://new-specter.vercel.app, no slash).
    assert parse_allowed_origins("https://new-specter.vercel.app/") == [
        "https://new-specter.vercel.app"
    ]
    assert parse_allowed_origins("https://a.com/, https://b.com///") == [
        "https://a.com",
        "https://b.com",
    ]


# ── M3: fail closed in production ─────────────────────────────────────────────

def test_is_production_env_true_for_deployed_names():
    assert is_production_env("production") is True
    assert is_production_env("staging") is True
    assert is_production_env("PRODUCTION") is True


def test_is_production_env_false_for_local_and_unset():
    for env in (None, "", "   ", "development", "dev", "local", "test"):
        assert is_production_env(env) is False


def test_resolve_open_cors_raises_in_production():
    with pytest.raises(RuntimeError, match="ALLOWED_ORIGINS must be set"):
        resolve_cors_origins(None, "production")
    with pytest.raises(RuntimeError):
        resolve_cors_origins("", "production")


def test_resolve_open_cors_allowed_locally():
    assert resolve_cors_origins(None, None) == ["*"]
    assert resolve_cors_origins(None, "development") == ["*"]


def test_resolve_explicit_origins_pass_through_in_production():
    assert resolve_cors_origins("https://app.specterapp.io", "production") == [
        "https://app.specterapp.io"
    ]
