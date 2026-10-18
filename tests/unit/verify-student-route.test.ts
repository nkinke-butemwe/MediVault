// tests/unit/verify-student-route.test.ts
//
// Tests for GET /api/verify-student/:studentNumber — failed lookups must be
// written to the access log, and the endpoint is rate limited.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  accessLog: { create: vi.fn() },
}))
vi.mock('@/src/lib/prisma', () => ({ prisma: db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production'
})

import { signToken } from '@/src/lib/jwt'
import { GET as verifyStudent } from '@/src/app/api/verify-student/[studentNumber]/route'

// Each test uses its own user id so the rate limiter starts fresh
let userCounter = 0
async function lookup(studentNumber: string, userId: string) {
  const token = await signToken({ userId, email: 'r@unza.zm', role: 'RECEPTIONIST', fullName: 'Reception' })
  const request = new NextRequest(`http://localhost:3000/api/verify-student/${studentNumber}`, {
    headers: { cookie: `medivault_token=${token}` },
  })
  const response = await verifyStudent(request, { params: { studentNumber } })
  return { status: response.status, json: await response.json() }
}

const loggedDetails = () => JSON.parse(db.accessLog.create.mock.calls[0][0].data.details)

beforeEach(() => {
  vi.clearAllMocks()
  userCounter += 1
  db.user.findUnique.mockResolvedValue({ isActive: true })
  db.accessLog.create.mockResolvedValue({})
})

describe('failed student-number lookups are audited', () => {
  it('logs NOT_FOUND when the student number is not in the SIS', async () => {
    await lookup('0000000000', `r-${userCounter}`)
    expect(db.accessLog.create).toHaveBeenCalledTimes(1)
    expect(db.accessLog.create.mock.calls[0][0].data.targetPatientId).toBeNull()
    expect(loggedDetails()).toEqual({ studentNumber: '0000000000', outcome: 'NOT_FOUND' })
  })

  it('logs SUSPENDED for a suspended student', async () => {
    await lookup('2023050999', `r-${userCounter}`)
    expect(loggedDetails()).toEqual({ studentNumber: '2023050999', outcome: 'SUSPENDED' })
  })

  it('logs ALUMNUS for an alumnus', async () => {
    await lookup('2018010001', `r-${userCounter}`)
    expect(loggedDetails()).toEqual({ studentNumber: '2018010001', outcome: 'ALUMNUS' })
  })

  it('logs NOT_FOUND when the SIS knows the student but MediVault has no account', async () => {
    // user lookup #1 is getRoleAndActor's isActive check, #2 is the student lookup
    db.user.findUnique.mockResolvedValueOnce({ isActive: true }).mockResolvedValueOnce(null)
    await lookup('2022082613', `r-${userCounter}`)
    expect(loggedDetails()).toEqual({ studentNumber: '2022082613', outcome: 'NOT_FOUND' })
  })
})

describe('rate limit', () => {
  it('allows 30 lookups a minute per user, then answers 429', async () => {
    const userId = `r-limit-${userCounter}`
    for (let i = 0; i < 30; i++) {
      expect((await lookup('0000000000', userId)).status).toBe(200)
    }
    const blocked = await lookup('0000000000', userId)
    expect(blocked.status).toBe(429)
  })

  it('does not block a different user', async () => {
    const heavyUser = `r-heavy-${userCounter}`
    for (let i = 0; i < 31; i++) await lookup('0000000000', heavyUser)
    expect((await lookup('0000000000', `r-other-${userCounter}`)).status).toBe(200)
  })
})
