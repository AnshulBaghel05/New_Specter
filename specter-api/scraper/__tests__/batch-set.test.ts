import { describe, it, expect } from 'vitest'
import {
  addToBatch,
  unionBatchedTrackingIds,
  batchSetKey,
  type BatchSetRedis,
} from '../batch-set'

/** Tiny fake with real SET semantics (SADD dedups; SMEMBERS returns members). */
function fakeRedis(): BatchSetRedis & { sets: Map<string, Set<string>>; ttl: Map<string, number> } {
  const sets = new Map<string, Set<string>>()
  const ttl = new Map<string, number>()
  return {
    sets,
    ttl,
    async sadd(key, ...members) {
      const s = sets.get(key) ?? new Set<string>()
      let added = 0
      for (const m of members) {
        if (!s.has(m)) { s.add(m); added++ }
      }
      sets.set(key, s)
      return added
    },
    async pexpire(key, ms) {
      ttl.set(key, ms)
      return 1
    },
    async smembers(key) {
      return [...(sets.get(key) ?? [])]
    },
  }
}

describe('batch-set', () => {
  it('addToBatch is a no-op for an empty list (no key, no TTL)', async () => {
    const redis = fakeRedis()
    await addToBatch(redis, 'job-1', [])
    expect(redis.sets.has(batchSetKey('job-1'))).toBe(false)
    expect(redis.ttl.has(batchSetKey('job-1'))).toBe(false)
  })

  it('addToBatch SADDs members and sets a TTL', async () => {
    const redis = fakeRedis()
    await addToBatch(redis, 'job-1', ['a', 'b'])
    expect([...redis.sets.get(batchSetKey('job-1'))!].sort()).toEqual(['a', 'b'])
    expect(redis.ttl.get(batchSetKey('job-1'))).toBeGreaterThan(0)
  })

  it('concurrent batches never lose a tracker (atomic SADD)', async () => {
    const redis = fakeRedis()
    await Promise.all([
      addToBatch(redis, 'job-1', ['a']),
      addToBatch(redis, 'job-1', ['b']),
      addToBatch(redis, 'job-1', ['c']),
    ])
    const merged = await unionBatchedTrackingIds(redis, 'job-1', [])
    expect(merged.sort()).toEqual(['a', 'b', 'c'])
  })

  it('unionBatchedTrackingIds merges base ids with batched, de-duped', async () => {
    const redis = fakeRedis()
    await addToBatch(redis, 'job-1', ['b', 'c'])
    const merged = await unionBatchedTrackingIds(redis, 'job-1', ['a', 'b'])
    expect(merged.sort()).toEqual(['a', 'b', 'c'])  // 'b' not duplicated
  })

  it('unionBatchedTrackingIds returns just the base ids when no batch exists', async () => {
    const redis = fakeRedis()
    expect(await unionBatchedTrackingIds(redis, 'job-1', ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('read is non-destructive — a re-delivered job still sees the batch', async () => {
    const redis = fakeRedis()
    await addToBatch(redis, 'job-1', ['x'])
    const first = await unionBatchedTrackingIds(redis, 'job-1', [])
    const second = await unionBatchedTrackingIds(redis, 'job-1', [])
    expect(first).toEqual(['x'])
    expect(second).toEqual(['x'])  // still present on the retry
  })
})
