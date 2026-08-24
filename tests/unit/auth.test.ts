// tests/unit/auth.test.ts
//
// Tests for src/lib/auth.ts — signing and verifying the JWT that
// represents a logged-in user's session.
//
// We set JWT_SECRET before any test runs, because signToken/verifyToken
// read it from process.env at call time and will throw if it's missing.

import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production'
})

// The import happens after beforeAll is registered, but Vitest still
// loads the module before running any test body. That's fine here because
// signToken/verifyToken only read process.env.JWT_SECRET when they are
// actually called, not when the module is first imported.
import { signToken, verifyToken } from '@/src/lib/auth'

describe('signToken and verifyToken', () => {
  const samplePayload = {
    userId: 'user-123',
    email: 'student@unza.zm',
    role: 'PATIENT' as const,
    fullName: 'Mwansa Chilufya',
  }

  it('produces a token that can be verified back to the same payload', async () => {
    const token = await signToken(samplePayload)
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)

    const decoded = await verifyToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded?.userId).toBe(samplePayload.userId)
    expect(decoded?.email).toBe(samplePayload.email)
    expect(decoded?.role).toBe(samplePayload.role)
    expect(decoded?.fullName).toBe(samplePayload.fullName)
  })

  it('returns null for a token that has been tampered with', async () => {
    const token = await signToken(samplePayload)
    // Flip a character in the middle of the token to simulate tampering.
    // JWTs are signed, so any change should make verification fail.
    const tamperedToken = token.slice(0, -5) + 'XXXXX'

    const decoded = await verifyToken(tamperedToken)
    expect(decoded).toBeNull()
  })

  it('returns null for a completely invalid token string', async () => {
    const decoded = await verifyToken('this-is-not-a-real-jwt')
    expect(decoded).toBeNull()
  })
})
