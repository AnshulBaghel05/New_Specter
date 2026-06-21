# Connect your Shopify store & import products

A simple, step-by-step guide for merchants.

## 1. Connect your store
1. Go to **Settings** in your SPECTER dashboard.
2. Find the **Shopify** card and type your store address — `your-store.myshopify.com`.
3. Click **Connect**. You'll be sent to Shopify to approve access.
4. Approve the requested permissions (read products, update product prices, read
   orders — the last one powers revenue attribution).
5. You'll land back in SPECTER with the store showing **Connected**.

> If you ever see **"Reconnect required"**, your Shopify access expired — click
> **Reconnect Shopify** to restore it. (Existing stores connected before this
> update should reconnect once so SPECTER can read orders for attribution.)

## 2. Import the products you want to monitor
1. Go to **Products** → click **Import from Shopify**.
2. Browse your catalog. Use the **search box** to find specific products in a
   large store.
3. **Pick what to monitor** — click variants to select them. You don't have to
   import everything.
   - Already-imported products show **Imported** and can't be double-added.
   - Prefer the whole catalog? Click **Import all**.
4. Click **Import N selected**. You'll see a confirmation (e.g. "Imported 12
   products"), and they appear on your **Products** page.

## 3. Add competitors & get signals
For each imported product, paste a competitor URL on the product row. SPECTER
starts tracking that competitor's price and stock, and produces RAISE / LOWER /
HOLD signals.

## 4. Apply a price change (one click, with confirm)
On the **Repricing** page (CIPHER plan and up), each product shows SPECTER's
suggested price.
1. Click **Apply $XX.XX to Shopify**.
2. A confirm appears — **"Write $XX.XX to your live store?"**
3. Click **Confirm**. SPECTER updates the price on your live Shopify store and
   logs the change.

Nothing is ever written to your store without that explicit confirm. You can also
turn on **Auto-reprice** to let SPECTER apply changes automatically within the
floor/ceiling guardrails you set — that's opt-in and off by default.

## 5. See the revenue impact (Attribution)
On the **Attribution** page (PHANTOM plan and up), SPECTER correlates each price
change with the units you actually sold in the 24 hours afterward (from your
Shopify orders) and shows the revenue impact per day. This fills in automatically
a day after each change.

---

### Your data & security
- Your Shopify access token is **encrypted at rest** and is **never** shown in the
  app, in API responses, or in logs.
- SPECTER respects Shopify's rate limits and backs off automatically, so importing
  a large catalog won't lock out your connection.
- Your store data is visible only to your account.
