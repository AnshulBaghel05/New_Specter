"""Render the backend email templates to static HTML files for visual review.

    python scripts/render_email_previews.py

Writes one .html per template to docs/email/previews/ — open them in a browser
(or drag into Gmail's "paste HTML" to spot-check rendering). Pure rendering, no
network, no API key needed.
"""
from __future__ import annotations

import os
import pathlib
import sys

# Make specter-api importable regardless of where the script is run from.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

# The template builders read from the registry; rendering needs no real key.
os.environ.setdefault("RESEND_API_KEY", "preview")

from services import email  # noqa: E402

OUT = pathlib.Path(__file__).resolve().parents[2] / "docs" / "email" / "previews"

SAMPLES: list[tuple[str, str, dict]] = [
    ("signal-raise.html",   "signal_alert",  {"sku_title": "Nike Air Max 270", "signal_type": "RAISE"}),
    ("signal-lower.html",   "signal_alert",  {"sku_title": "Adidas Ultraboost 22", "signal_type": "LOWER"}),
    ("signal-restock.html", "signal_alert",  {"sku_title": "New Balance 574", "signal_type": "RESTOCK"}),
    ("oos-alert.html",      "oos_alert",     {"competitor_name": "rivalshop.com", "sku_title": "Nike Air Max 270"}),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for filename, template, data in SAMPLES:
        tpl = email._TEMPLATES[template]
        subject, body = tpl.build(data)
        html = (f"<!-- subject: {subject} -->\n"
                f"<div style='background:#0b0d16;padding:24px'>{email._shell(body, alert=tpl.alert)}</div>")
        (OUT / filename).write_text(html, encoding="utf-8")
        print(f"wrote {filename}  (subject: {subject.encode('ascii', 'replace').decode()})")


if __name__ == "__main__":
    main()
