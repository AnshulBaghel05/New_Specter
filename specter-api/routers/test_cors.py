"""CORS origin allowlist parsing (main.parse_allowed_origins)."""
from main import parse_allowed_origins


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
