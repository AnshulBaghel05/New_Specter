import services.cost_model as cm


def test_scrape_cost_residential_bytes_to_usd():
    # 1 GB residential @ $8.40/GB
    costs = cm.scrape_cost_usd("residential", 1_000_000_000, captcha_solved=False)
    assert round(costs["proxy"], 4) == 8.40
    assert costs["captcha"] == 0.0


def test_scrape_cost_datacenter_cheaper_than_residential():
    dc = cm.scrape_cost_usd("datacenter", 1_000_000_000, False)["proxy"]
    res = cm.scrape_cost_usd("residential", 1_000_000_000, False)["proxy"]
    assert 0 < dc < res


def test_no_proxy_tier_is_zero_proxy_cost():
    assert cm.scrape_cost_usd(None, 1_000_000, False)["proxy"] == 0.0
    assert cm.scrape_cost_usd("none", 1_000_000, False)["proxy"] == 0.0


def test_captcha_adds_solve_cost_when_solved():
    c = cm.scrape_cost_usd("datacenter", 0, captcha_solved=True)
    assert c["captcha"] == 0.002


def test_ai_cost_pro_vs_flash():
    pro   = cm.ai_cost_usd("gemini-1.5-pro", 1_000_000, 1_000_000)
    flash = cm.ai_cost_usd("gemini-1.5-flash", 1_000_000, 1_000_000)
    assert round(pro, 4) == round(1.25 + 5.00, 4)      # $/1M in + out
    assert round(flash, 4) == round(0.075 + 0.30, 4)
    assert flash < pro


def test_split_divides_across_merchants_guarding_zero():
    assert cm.split(10.0, 5) == 2.0
    assert cm.split(10.0, 0) == 10.0   # guard: never divide by zero


def test_monthly_revenue_map():
    assert cm.monthly_revenue_usd("recon") == 79.0
    assert cm.monthly_revenue_usd("free") == 0.0
    assert cm.monthly_revenue_usd("eclipse") == 0.0   # custom → 0 (flagged elsewhere)


def test_rates_are_env_overridable(monkeypatch):
    monkeypatch.setenv("COST_RATE_RESIDENTIAL_USD_PER_GB", "10.0")
    assert cm.scrape_cost_usd("residential", 1_000_000_000, False)["proxy"] == 10.0
