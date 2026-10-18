// tests/unit/engagement-routes.test.ts
//
// Tests for WHO is allowed to do what in the new API routes (appointment
// requests, messaging, notifications, timeline). The database is replaced with
// a fake, so these tests check the access rules, not Prisma.
//
// Each test logs in as a role by signing a real token, exactly like the app does.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── A fake database: every call is a vi.fn() we can program per test ─────────
const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn(), findMany: vi.fn() },
  message: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  medicalRecord: { findMany: vi.fn() },
  prescription: { findMany: vi.fn() },
  labOrder: { findMany: vi.fn() },
  visit: { findMany: vi.fn() },
  appointmentRequest: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  notification: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn(), create: vi.fn(), createMany: vi.fn() },
  accessLog: { create: vi.fn() },
  admission: { findMany: vi.fn() },
}))
vi.mock('@/src/lib/prisma', () => ({ prisma: db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production'
})

import { signToken } from '@/src/lib/jwt'
import { GET as getMessages, POST as postMessage } from '@/src/app/api/messages/route'
import { GET as getTimeline } from '@/src/app/api/timeline/route'
import { GET as getNotifications, PATCH as patchNotifications } from '@/src/app/api/notifications/route'
import { POST as postAppointment } from '@/src/app/api/appointment-requests/route'
import { PATCH as patchAppointment } from '@/src/app/api/appointment-requests/[id]/route'

type TestRole = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'PHARMACIST' | 'ADMIN'

async function call(
  handler: (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>,
  opts: { role?: TestRole; userId?: string; method?: string; url?: string; body?: unknown; id?: string } = {}
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.role) {
    const token = await signToken({ userId: opts.userId ?? 'u1', email: 'u@unza.zm', role: opts.role, fullName: 'Test User' })
    headers.cookie = `medivault_token=${token}`
  }
  const request = new NextRequest(opts.url ?? 'http://localhost:3000/api/x', {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
  const response = await handler(request, { params: { id: opts.id ?? 'x1' } })
  return { status: response.status, json: await response.json() }
}

// Programs the fake database so Dr. d1 is on Patient p1's care team
function makeDoctorPartOfCareTeam() {
  db.medicalRecord.findMany.mockResolvedValue([{ doctorId: 'd1' }])
  db.prescription.findMany.mockResolvedValue([])
  db.labOrder.findMany.mockResolvedValue([])
}

beforeEach(() => {
  vi.clearAllMocks()
  db.accessLog.create.mockResolvedValue({})
  db.notification.create.mockResolvedValue({})
  db.notification.createMany.mockResolvedValue({ count: 0 })
  db.user.findMany.mockResolvedValue([])
  // No admissions unless a test says otherwise (care team and timeline both read them)
  db.admission.findMany.mockResolvedValue([])
})

describe('messages: who may use them', () => {
  it('refuses a receptionist and a pharmacist', async () => {
    for (const role of ['RECEPTIONIST', 'PHARMACIST'] as const) {
      expect((await call(getMessages, { role })).status).toBe(403)
      expect((await call(postMessage, { role, method: 'POST', body: { recipientId: 'd1', body: 'hi' } })).status).toBe(403)
    }
  })

  it('refuses a caller who is not logged in', async () => {
    expect((await call(getMessages)).status).toBe(403)
  })

  it('stops a patient messaging a doctor who has never treated them', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'd2', fullName: 'Dr. Stranger' })
    db.medicalRecord.findMany.mockResolvedValue([{ doctorId: 'd1' }]) // d1 treats them, d2 does not
    db.prescription.findMany.mockResolvedValue([])
    db.labOrder.findMany.mockResolvedValue([])

    const result = await call(postMessage, { role: 'PATIENT', userId: 'p1', method: 'POST', body: { recipientId: 'd2', body: 'hello' } })
    expect(result.status).toBe(403)
    expect(db.message.create).not.toHaveBeenCalled()
  })

  it('lets a patient message a care-team doctor, stores it for the right thread, and notifies the doctor', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'd1', fullName: 'Dr. Mwanza' })
    makeDoctorPartOfCareTeam()
    db.message.create.mockResolvedValue({ id: 'm1', body: 'hello', sender: { id: 'p1', fullName: 'Pat Patient' } })

    const result = await call(postMessage, { role: 'PATIENT', userId: 'p1', method: 'POST', body: { recipientId: 'd1', body: 'hello' } })

    expect(result.status).toBe(201)
    expect(db.message.create.mock.calls[0][0].data).toMatchObject({ patientId: 'p1', doctorId: 'd1', senderId: 'p1', body: 'hello' })
    // The notification names the sender but never repeats the message text
    const notification = db.notification.create.mock.calls[0][0].data
    expect(notification).toMatchObject({ userId: 'd1', type: 'NEW_MESSAGE', body: 'From Pat Patient' })
    expect(JSON.stringify(notification)).not.toContain('hello')
  })

  it('looks for a DOCTOR when a patient sends, and a PATIENT when a doctor sends', async () => {
    db.user.findFirst.mockResolvedValue(null)
    await call(postMessage, { role: 'PATIENT', userId: 'p1', method: 'POST', body: { recipientId: 'x', body: 'hi' } })
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject({ role: 'DOCTOR' })
    await call(postMessage, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { recipientId: 'x', body: 'hi' } })
    expect(db.user.findFirst.mock.calls[1][0].where).toMatchObject({ role: 'PATIENT' })
  })

  it("only ever reads the caller's own threads (a patient cannot pass someone else's id)", async () => {
    db.message.findMany.mockResolvedValue([{ id: 'm1' }])
    db.message.updateMany.mockResolvedValue({ count: 0 })
    await call(getMessages, { role: 'PATIENT', userId: 'p1', url: 'http://localhost:3000/api/messages?with=d1' })
    expect(db.message.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1', doctorId: 'd1' })
  })

  it('writes a doctor opening a thread to the access log', async () => {
    db.message.findMany.mockResolvedValue([{ id: 'm1' }])
    db.message.updateMany.mockResolvedValue({ count: 0 })
    await call(getMessages, { role: 'DOCTOR', userId: 'd1', url: 'http://localhost:3000/api/messages?with=p1' })
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({
      accessedByUserId: 'd1', targetPatientId: 'p1', resourceType: 'MESSAGE', action: 'VIEW',
    })
  })
})

describe('timeline: who may see it', () => {
  function emptyTimelineData() {
    db.medicalRecord.findMany.mockResolvedValue([])
    db.visit.findMany.mockResolvedValue([])
    db.prescription.findMany.mockResolvedValue([])
    db.labOrder.findMany.mockResolvedValue([])
    db.appointmentRequest.findMany.mockResolvedValue([])
  }

  it('gives a patient their OWN timeline even if they ask for another patient', async () => {
    emptyTimelineData()
    const result = await call(getTimeline, { role: 'PATIENT', userId: 'p1', url: 'http://localhost:3000/api/timeline?patientId=someone-else' })
    expect(result.status).toBe(200)
    expect(db.medicalRecord.findMany.mock.calls[0][0].where).toEqual({ patientId: 'p1' })
    expect(db.accessLog.create).not.toHaveBeenCalled()
  })

  it('only asks the database for lab orders the doctor has reviewed', async () => {
    emptyTimelineData()
    await call(getTimeline, { role: 'PATIENT', userId: 'p1' })
    expect(db.labOrder.findMany.mock.calls[0][0].where).toMatchObject({ status: 'COMPLETED', reviewedAt: { not: null } })
  })

  it('needs a patientId from a doctor, and logs the view', async () => {
    emptyTimelineData()
    expect((await call(getTimeline, { role: 'DOCTOR', userId: 'd1' })).status).toBe(400)
    const result = await call(getTimeline, { role: 'DOCTOR', userId: 'd1', url: 'http://localhost:3000/api/timeline?patientId=p1' })
    expect(result.status).toBe(200)
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({ targetPatientId: 'p1', resourceType: 'TIMELINE' })
  })

  it('refuses receptionists, pharmacists and anonymous callers', async () => {
    expect((await call(getTimeline, { role: 'RECEPTIONIST' })).status).toBe(403)
    expect((await call(getTimeline, { role: 'PHARMACIST' })).status).toBe(403)
    expect((await call(getTimeline)).status).toBe(403)
  })
})

describe('notifications: always your own', () => {
  it('requires a login', async () => {
    expect((await call(getNotifications)).status).toBe(401)
    expect((await call(patchNotifications, { method: 'PATCH', body: { all: true } })).status).toBe(401)
  })

  it('lists only the caller’s notifications', async () => {
    db.notification.findMany.mockResolvedValue([])
    db.notification.count.mockResolvedValue(0)
    await call(getNotifications, { role: 'PATIENT', userId: 'p1' })
    expect(db.notification.findMany.mock.calls[0][0].where).toEqual({ userId: 'p1' })
  })

  it('can never mark someone else’s notification as read', async () => {
    db.notification.updateMany.mockResolvedValue({ count: 1 })
    await call(patchNotifications, { role: 'PATIENT', userId: 'p1', method: 'PATCH', body: { ids: ['n-belonging-to-someone-else'] } })
    expect(db.notification.updateMany.mock.calls[0][0].where).toMatchObject({ userId: 'p1', id: { in: ['n-belonging-to-someone-else'] } })
  })
})

describe('appointment requests: who may do what', () => {
  const nextWeek = () => {
    const date = new Date()
    date.setDate(date.getDate() + 7)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  it('only patients can request one', async () => {
    for (const role of ['RECEPTIONIST', 'DOCTOR', 'ADMIN'] as const) {
      const result = await call(postAppointment, { role, method: 'POST', body: { preferredDate: nextWeek(), reason: 'Check-up' } })
      expect(result.status).toBe(403)
    }
  })

  it('rejects a date in the past', async () => {
    const result = await call(postAppointment, { role: 'PATIENT', userId: 'p1', method: 'POST', body: { preferredDate: '2020-01-01', reason: 'Check-up' } })
    expect(result.status).toBe(400)
    expect(db.appointmentRequest.create).not.toHaveBeenCalled()
  })

  it('stops a patient from having more than 3 open requests', async () => {
    db.appointmentRequest.count.mockResolvedValue(3)
    const result = await call(postAppointment, { role: 'PATIENT', userId: 'p1', method: 'POST', body: { preferredDate: nextWeek(), reason: 'Check-up' } })
    expect(result.status).toBe(409)
  })

  it('creates the request for the logged-in patient and notifies reception', async () => {
    db.appointmentRequest.count.mockResolvedValue(0)
    db.appointmentRequest.create.mockResolvedValue({ id: 'a1', reason: 'Check-up', patient: { fullName: 'Pat Patient' } })
    db.user.findMany.mockResolvedValue([{ id: 'rec1' }])

    const result = await call(postAppointment, { role: 'PATIENT', userId: 'p1', method: 'POST', body: { preferredDate: nextWeek(), reason: 'Check-up' } })

    expect(result.status).toBe(201)
    expect(db.appointmentRequest.create.mock.calls[0][0].data).toMatchObject({ patientId: 'p1', reason: 'Check-up' })
    expect(db.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({ userId: 'rec1', type: 'APPOINTMENT_REQUESTED' })
  })

  it('lets only reception staff confirm or decline', async () => {
    db.appointmentRequest.findUnique.mockResolvedValue({ id: 'a1', patientId: 'p1', status: 'REQUESTED', reason: 'x', visitId: null })
    for (const role of ['PATIENT', 'DOCTOR', 'PHARMACIST'] as const) {
      const result = await call(patchAppointment, { role, userId: 'p1', method: 'PATCH', body: { action: 'decline', responseNote: 'Not available' }, id: 'a1' })
      expect(result.status).toBe(403)
    }
  })

  it("won't let a patient cancel somebody else's request", async () => {
    db.appointmentRequest.findUnique.mockResolvedValue({ id: 'a1', patientId: 'someone-else', status: 'REQUESTED', visitId: null })
    const result = await call(patchAppointment, { role: 'PATIENT', userId: 'p1', method: 'PATCH', body: { action: 'cancel' }, id: 'a1' })
    expect(result.status).toBe(403)
    expect(db.appointmentRequest.updateMany).not.toHaveBeenCalled()
  })

  it('answers 409 when a request was already answered (nobody can answer twice)', async () => {
    db.appointmentRequest.findUnique.mockResolvedValue({ id: 'a1', patientId: 'p1', status: 'CONFIRMED', visitId: 'v1' })
    db.appointmentRequest.updateMany.mockResolvedValue({ count: 0 })
    const result = await call(patchAppointment, { role: 'RECEPTIONIST', userId: 'rec1', method: 'PATCH', body: { action: 'decline', responseNote: 'Too late' }, id: 'a1' })
    expect(result.status).toBe(409)
  })

  it('returns 404 for a request that does not exist', async () => {
    db.appointmentRequest.findUnique.mockResolvedValue(null)
    const result = await call(patchAppointment, { role: 'RECEPTIONIST', method: 'PATCH', body: { action: 'decline', responseNote: 'Not available' }, id: 'nope' })
    expect(result.status).toBe(404)
  })

  it('declining tells the patient why', async () => {
    db.appointmentRequest.findUnique
      .mockResolvedValueOnce({ id: 'a1', patientId: 'p1', status: 'REQUESTED', visitId: null })
      .mockResolvedValueOnce({ id: 'a1', status: 'DECLINED' })
    db.appointmentRequest.updateMany.mockResolvedValue({ count: 1 })

    const result = await call(patchAppointment, { role: 'RECEPTIONIST', userId: 'rec1', method: 'PATCH', body: { action: 'decline', responseNote: 'No doctor free' }, id: 'a1' })

    expect(result.status).toBe(200)
    expect(db.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'p1', type: 'APPOINTMENT_DECLINED', body: 'No doctor free' })
  })
})
