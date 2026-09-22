// tests/unit/request-auth.test.ts
//
// Tests for getRoleAndActor() in src/lib/auth.ts — the ONE function every API
// route uses to learn who is calling. It must only believe a token whose
// signature checks out.

import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production'
})

import { getRoleAndActor } from '@/src/lib/auth'
import { signToken } from '@/src/lib/jwt'

function requestWith(cookie?: string, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/anything', {
    headers: { ...headers, ...(cookie ? { cookie: `medivault_token=${cookie}` } : {}) },
  })
}

describe('getRoleAndActor', () => {
  it('returns the role and user id from a genuine token', async () => {
    const token = await signToken({ userId: 'doc-1', email: 'd@unza.zm', role: 'DOCTOR', fullName: 'Dr Test' })
    expect(await getRoleAndActor(requestWith(token))).toEqual({ role: 'DOCTOR', actorId: 'doc-1' })
  })

  it('returns no role when there is no cookie', async () => {
    expect(await getRoleAndActor(requestWith())).toEqual({ role: null, actorId: 'system' })
  })

  it('returns no role for a hand-made token with a fake signature', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const forged = `${b64({ alg: 'HS256' })}.${b64({ userId: 'x', role: 'ADMIN', exp: 9999999999 })}.fake`
    expect(await getRoleAndActor(requestWith(forged))).toEqual({ role: null, actorId: 'system' })
  })

  it('ignores x-user-role / x-user-id headers', async () => {
    const result = await getRoleAndActor(requestWith(undefined, { 'x-user-role': 'ADMIN', 'x-user-id': 'attacker' }))
    expect(result.role).toBeNull()
  })

  it('uses the token, not a header, when both are present', async () => {
    const token = await signToken({ userId: 'p-1', email: 'p@unza.zm', role: 'PATIENT', fullName: 'Pat' })
    const result = await getRoleAndActor(requestWith(token, { 'x-user-role': 'ADMIN' }))
    expect(result).toEqual({ role: 'PATIENT', actorId: 'p-1' })
  })
})
