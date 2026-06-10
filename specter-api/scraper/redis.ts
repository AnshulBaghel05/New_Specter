import 'dotenv/config'
import Redis from 'ioredis'
import {
  resolveBrokerUrl,
  resolveStateUrl,
  redisOptionsFromUrl,
} from './redis-config'

// SPECTER uses two logical Redis roles (see redis-config.ts): a durable BullMQ
// **broker** and an ephemeral **state** store. They resolve to separate
// instances in production (BROKER_REDIS_URL / STATE_REDIS_URL) and collapse to
// the single UPSTASH_REDIS_URL locally — so dev needs no extra setup while prod
// can isolate job durability from state churn.

const brokerUrl = resolveBrokerUrl(process.env)
const stateUrl = resolveStateUrl(process.env)

// BullMQ 5 bundles its own ioredis internally; passing an external instance
// causes nominal-typing conflicts. So we export a plain options object — BullMQ
// builds its own broker connection from it — and a separate ioredis instance
// for direct state operations.
export const brokerConnection = redisOptionsFromUrl(brokerUrl)

/** @deprecated use `brokerConnection` — kept so existing imports keep working. */
export const bullmqConnection = brokerConnection

// Standalone ioredis for direct state key ops: domain:class:{domain} lookups,
// scrape:lock, rate-limit buckets, cycle counters, proxy:health:{ip}, etc.
export const stateRedis = new Redis(stateUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

/** @deprecated use `stateRedis` — kept so existing imports keep working. */
export const redis = stateRedis

stateRedis.on('error', (err: Error) => {
  console.error('[redis:state] connection error:', err.message)
})
