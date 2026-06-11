-- Subscription period columns for cancel-at-period-end UX (billing checkout wiring).
alter table public.merchants add column if not exists subscription_current_end timestamptz;
alter table public.merchants add column if not exists subscription_cancel_at timestamptz;
