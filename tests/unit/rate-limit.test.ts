// tests/unit/rate-limit.test.ts
//
// Tests for src/lib/rate-limit.ts — the in-memory login rate limiter.
//
// What we're checking:
// 1. A key (usually an IP address) is allowed to make attempts up to
//    the maximum (5).
// 2. Once a key goes over the maximum, further attempts are blocked.
// 3. Different keys are tracked completely separately from each other,
//    so one person's failed logins never lock out someone else.

import { describe, it, expect } from 'vitest'
import { checkRateLimit } from '@/src/lib/rate-limit'

describe('checkRateLimit', () => {
  it('allows the first attempt for a brand new key', () => {
    const result = checkRateLimit('test-ip-1')
    expect(result.allowed).toBe(true)
  })

  it('allows exactly 5 attempts, then blocks the 6th', () => {
    const key = 'test-ip-2'

    // Make 5 attempts — every one of these should be allowed
    for (let attemptNumber = 1; attemptNumber <= 5; attemptNumber++) {
      const result = checkRateLimit(key)
      expect(result.allowed).toBe(true)
    }

    // The 6th attempt should now be blocked
    const sixthAttempt = checkRateLimit(key)
    expect(sixthAttempt.allowed).toBe(false)
    // When blocked, the function should tell the caller how long to wait
    expect(sixthAttempt.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('tracks each key independently', () => {
    const keyA = 'test-ip-3-a'
    const keyB = 'test-ip-3-b'

    // Use up all 5 attempts for keyA only
    for (let i = 0; i < 5; i++) {
      checkRateLimit(keyA)
    }

    // keyA should now be blocked...
    expect(checkRateLimit(keyA).allowed).toBe(false)

    // ...but keyB, which never made any attempts, should still be allowed
    expect(checkRateLimit(keyB).allowed).toBe(true)
  })

  it('reports the remaining attempts as they are used up', () => {
    const key = 'test-ip-4'

    const first = checkRateLimit(key)
    expect(first.remainingAttempts).toBe(4)

    const second = checkRateLimit(key)
    expect(second.remainingAttempts).toBe(3)
  })
})
