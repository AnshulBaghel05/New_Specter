from services.cost_margin import compute_margin


def test_compute_margin_profitable():
    row = compute_margin("recon", {"proxy": 5.0, "ai": 0.0, "captcha": 1.0})
    assert row["revenue"] == 79.0
    assert row["cost_to_serve"] == 6.0
    assert round(row["gross_margin"], 4) == round((79.0 - 6.0) / 79.0, 4)
    assert row["margin_negative"] is False


def test_compute_margin_negative_flag():
    row = compute_margin("cipher", {"proxy": 300.0, "ai": 50.0, "captcha": 0.0})
    assert row["cost_to_serve"] == 350.0
    assert row["margin_negative"] is True


def test_compute_margin_zero_revenue_custom_plan():
    row = compute_margin("eclipse", {"proxy": 10.0})
    assert row["revenue"] == 0.0
    assert row["gross_margin"] is None         # undefined when revenue is 0
    assert row["margin_negative"] is True      # any cost with 0 modeled revenue
