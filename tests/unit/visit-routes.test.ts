// tests/unit/visit-routes.test.ts
//
// Tests for WHO may change a visit and WHICH status changes are allowed in
// PUT /api/visits/:id, plus the audit log written when today's visits are listed.
// The database is replaced with a fake, so these tests check the route's rules, not Prisma.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  visit: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  accessLog: { create: vi.fn() },
}))
vi.mock('@/src/lib/prisma', () => ({ prisma: db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production'
})

import { signToken } from '@/src/lib/jwt'
import { PUT as putVisit } from '@/src/app/api/visits/[id]/route'
import { GET as getVisits } from '@/src/app/api/visits/route'

type TestRole = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN'

async function cookieFor(role: TestRole) {
  const token = await signToken({ userId: 'u1', email: 'u@unza.zm', role, fullName: 'Test User' })
  return `medivault_token=${token}`
}

async function updateVisit(role: TestRole, body: unknown) {
  const request = new NextRequest('http://localhost:3000/api/visits/v1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: await cookieFor(role) },
    body: JSON.stringify(body),
  })
  const response = await putVisit(request, { params: { id: 'v1' } })
  return { status: response.status, json: await response.json() }
}

beforeEach(() => {
  vi.clearAllMocks()
  db.user.findUnique.mockResolvedValue({ isActive: true })
  db.accessLog.create.mockResolvedValue({})
  db.visit.findUnique.mockResolvedValue({ id: 'v1', status: 'WAITING' })
  db.visit.update.mockResolvedValue({ id: 'v1', patientId: 'p1', status: 'CHECKED_IN' })
})

describe('PUT /api/visits/:id — clinical notes', () => {
  it('refuses a receptionist who tries to write doctor notes (403)', async () => {
    const result = await updateVisit('RECEPTIONIST', { doctorNotes: 'looks fine' })
    expect(result.status).toBe(403)
    expect(db.visit.update).not.toHaveBeenCalled()
  })

  it('refuses an admin who tries to write doctor notes (403)', async () => {
    expect((await updateVisit('ADMIN', { doctorNotes: 'x' })).status).toBe(403)
  })

  it('refuses a receptionist even when the notes are blanked with null', async () => {
    expect((await updateVisit('RECEPTIONIST', { doctorNotes: null })).status).toBe(403)
  })

  it('lets a doctor write notes', async () => {
    db.visit.findUnique.mockResolvedValue({ id: 'v1', status: 'IN_CONSULTATION' })
    expect((await updateVisit('DOCTOR', { doctorNotes: 'malaria suspected' })).status).toBe(200)
    expect(db.visit.update).toHaveBeenCalled()
  })

  it('lets a receptionist change status and vitals', async () => {
    const result = await updateVisit('RECEPTIONIST', { status: 'CHECKED_IN', vitals: 'BP 120/80' })
    expect(result.status).toBe(200)
  })

  it('refuses a receptionist who tries to change the reason for the visit (403)', async () => {
    expect((await updateVisit('RECEPTIONIST', { reason: 'changed' })).status).toBe(403)
  })
})

describe('PUT /api/visits/:id — status rules', () => {
  it('answers 409 for a change the workflow does not allow', async () => {
    db.visit.findUnique.mockResolvedValue({ id: 'v1', status: 'CHECKED_OUT' })
    const result = await updateVisit('DOCTOR', { status: 'WAITING' })
    expect(result.status).toBe(409)
    expect(db.visit.update).not.toHaveBeenCalled()
  })

  it('answers 409 when someone tries to reopen a cancelled visit', async () => {
    db.visit.findUnique.mockResolvedValue({ id: 'v1', status: 'CANCELLED' })
    expect((await updateVisit('RECEPTIONIST', { status: 'CHECKED_IN' })).status).toBe(409)
  })

  it('allows a valid change', async () => {
    expect((await updateVisit('RECEPTIONIST', { status: 'CHECKED_IN' })).status).toBe(200)
  })
})

describe('PUT /api/visits/:id — visit that does not exist', () => {
  it('answers 404 when the visit is not found', async () => {
    db.visit.findUnique.mockResolvedValue(null)
    const result = await updateVisit('DOCTOR', { status: 'CHECKED_IN' })
    expect(result.status).toBe(404)
    expect(result.json.error).toBe('Visit not found')
  })

  it('answers 404 (not 500) when Prisma throws P2025 during the update', async () => {
    db.visit.update.mockRejectedValue(Object.assign(new Error('Record to update not found'), { code: 'P2025' }))
    const result = await updateVisit('DOCTOR', { status: 'CHECKED_IN' })
    expect(result.status).toBe(404)
    expect(result.json.error).toBe('Visit not found')
  })

  it('still lets other database errors surface', async () => {
    db.visit.update.mockRejectedValue(new Error('connection lost'))
    await expect(updateVisit('DOCTOR', { status: 'CHECKED_IN' })).rejects.toThrow('connection lost')
  })
})

describe("GET /api/visits — today's visits are audited", () => {
  it('writes an access log with no target patient and the number listed', async () => {
    db.visit.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }])
    const request = new NextRequest('http://localhost:3000/api/visits', { headers: { cookie: await cookieFor('RECEPTIONIST') } })
    const response = await getVisits(request)
    expect(response.status).toBe(200)
    expect(db.accessLog.create).toHaveBeenCalledTimes(1)
    const saved = db.accessLog.create.mock.calls[0][0].data
    expect(saved.targetPatientId).toBeNull()
    expect(saved.resourceType).toBe('VISIT')
    expect(JSON.parse(saved.details)).toEqual({ listed: 2 })
  })
})
