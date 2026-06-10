# SPECTER — Tech Stack Reference

## Version Pins (as of 2026-05-23)
| Package | Version | Notes |
|---------|---------|-------|
| next | 14.2.x | App Router, do NOT upgrade to 15.x during MVP |
| react | 18.3.x | |
| typescript | 5.4.x | strict mode enabled |
| tailwindcss | 3.4.x | |
| @supabase/ssr | 0.x | auth + session cookies |
| @supabase/supabase-js | 2.x | |
| @tanstack/react-query | 5.x | |
| zustand | 4.x | |
| framer-motion | 11.x | |
| gsap | 3.12.x | |
| @react-three/fiber | 8.x | |
| three | 0.x | |
| @lenis/react | 1.x | |
| recharts | 2.x | |
| react-hook-form | 7.x | |
| zod | 3.x | |
| lucide-react | 0.x | |

## specter-api
| Package | Version |
|---------|---------|
| Python | 3.11+ |
| fastapi | 0.111.x |
| sqlalchemy | 2.0.x |
| alembic | 1.13.x |
| pydantic | 2.x |
| httpx | 0.27.x |
| python-jose | 3.x |
| Node.js | 20 LTS |
| bullmq | 5.x |
| playwright | 1.44.x |

## Hosting
| Service | What | Cost |
|---------|------|------|
| Vercel | specter-web | Free (Hobby) → $20/mo (Pro) at scale |
| Railway | specter-api + scraper workers | $5/mo Hobby |
| Supabase | PostgreSQL + Storage | Free (500MB) → $25/mo |
| Upstash | Redis (BullMQ) | Free (10K commands/day) → $0.2/100K |
| Bright Data | Residential proxies | ~$15/GB (pay-as-you-go) |
| Resend | Transactional email | Free (3K/mo) → $20/mo |
| Supabase Auth | Auth | Free (50K MAU) → bundled with DB |
| Sentry | Error monitoring | Free |
| PostHog | Product analytics | Free (1M events/mo) |

## Why Each Choice
- **Next.js 14 App Router:** RSC for dashboard (fast TTI), client components for real-time signal feed. Static generation for marketing/tools pages.
- **Supabase Auth:** One vendor for DB + auth, JWT validated server-side in specter-api via `SUPABASE_JWT_SECRET`, generous free tier (50K MAU), RLS integrates with the same Postgres. Session cookies handled by `@supabase/ssr` in Next.js middleware.
- **Supabase Storage over S3 at launch:** Same client as DB, no separate AWS account setup. Migrate to S3 after $1K MRR.
- **Railway over Fly.io:** Simpler deployment for Python + Node.js mixed repo, built-in Redis plugin, $5/mo Hobby covers MVP.
- **Razorpay over Stripe:** INR billing without additional Stripe India compliance overhead. Stripe International available via Razorpay for USD.
- **BullMQ over SQS/Pub-Sub:** Redis-backed, same Upstash instance, retry/backoff built-in, no vendor lock-in.
- **Bright Data over ScraperAPI:** 40–70% cheaper per GB at scale, residential IPs, session management for multi-page scrapes.
