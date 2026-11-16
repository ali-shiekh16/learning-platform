/**
 * In-memory rate limiter: allows at most `limit` actions per key within any rolling
 * `windowMs`. Used for socket events, which @fastify/rate-limit (HTTP only) can't see.
 * Single-process only; several servers would need a shared store such as Redis.
 */
export function createSlidingWindowLimiter({
  limit,
  windowMs,
}: {
  limit: number
  windowMs: number
}) {
  const hits = new Map<string, number[]>()

  return {
    /** Records an action for `key` and returns false if it is over the limit. */
    tryConsume(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter(time => now - time < windowMs)
      if (recent.length >= limit) {
        hits.set(key, recent)
        return false
      }
      recent.push(now)
      hits.set(key, recent)
      return true
    },
  }
}

export type SlidingWindowLimiter = ReturnType<typeof createSlidingWindowLimiter>
