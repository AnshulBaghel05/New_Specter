-- 0010_billing_addon_subscription.sql
-- Razorpay billing (Prompt 15): link each add-on to the Razorpay subscription
-- that backs it, so removing an add-on can cancel the exact subscription.
-- Mirrors Alembic revision 0008.

alter table merchant_addons
  add column if not exists razorpay_subscription_id text;
