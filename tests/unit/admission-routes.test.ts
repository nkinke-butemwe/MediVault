// tests/unit/admission-routes.test.ts
//
// Tests for the inpatient admission API routes: WHO may do what, and the business rules
// (one active admission, discharge rules, consent, append-only notes, and so on).
// The database is replaced with a fake, so these tests check the route logic, not Prisma.
// Each test "logs in" by signing a real token, exactly like the app does.

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── A fake database: every call is a vi.fn() we can program per test ─────────
const db = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  admission: {
    findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(),
    count: vi.fn(), create: vi.fn(), updateMany: vi.fn(),
  },
  admissionNote: { create: vi.fn() },
  vitalsReading: { create: vi.fn() },
  nextOfKinAssignment: { findFirst: vi.fn(), findMany: vi.fn() },
  visit: { findFirst: vi.fn(), updateMany: vi.fn() },
  labOrder: { count: vi.fn(), create: vi.fn() },
  labTest: { findMany: vi.fn() },
  prescription: { count: vi.fn() },
  notification: { create: vi.fn(), createMany: vi.fn() },
  accessLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}))
vi.mock('@/src/lib/prisma', () => ({ prisma: db }))

beforeAll(() => {
  process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production'
})

import { signToken } from '@/src/lib/jwt'
import { GET as listAdmissions, POST as admitPatient } from '@/src/app/api/admissions/route'
import { GET as getAdmission, PATCH as patchAdmission } from '@/src/app/api/admissions/[id]/route'
import { POST as postNote } from '@/src/app/api/admissions/[id]/notes/route'
import { POST as postVitals } from '@/src/app/api/admissions/[id]/vitals/route'
import { POST as postDischarge } from '@/src/app/api/admissions/[id]/discharge/route'
import { POST as postCancel } from '@/src/app/api/admissions/[id]/cancel/route'
import { GET as getStats } from '@/src/app/api/admissions/stats/route'
import { GET as getPatientHistory } from '@/src/app/api/patients/[id]/admissions/route'
import { POST as postLabOrder } from '@/src/app/api/lab/orders/route'

type TestRole = 'PATIENT' | 'DOCTOR' | 'ADMIN' | 'RECEPTIONIST' | 'NEXT_OF_KIN' | 'PHARMACIST' | 'LAB_TECHNICIAN'

type Handler = (req: NextRequest, ctx: { params: { id: string } }) => Promise<Response>

// Calls a route handler as a given role (or as nobody, when no role is passed)
async function call(
  handler: Handler,
  opts: { role?: TestRole; userId?: string; method?: string; url?: string; body?: unknown; id?: string } = {}
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.role) {
    const token = await signToken({ userId: opts.userId ?? 'u1', email: 'u@unza.zm', role: opts.role, fullName: 'Test User' })
    headers.cookie = `medivault_token=${token}`
  }
  const request = new NextRequest(opts.url ?? 'http://localhost:3000/api/admissions', {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  })
  const response = await handler(request, { params: { id: opts.id ?? 'adm1' } })
  return { status: response.status, json: await response.json() }
}

// ── Test data ────────────────────────────────────────────────────────────────

// A stored admission. Pass overrides to change only what a test cares about.
function storedAdmission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'adm1',
    admissionNumber: 'ADM-2026-000001',
    patientId: 'p1',
    admittingDoctorId: 'd1',
    attendingDoctorId: 'd1',
    status: 'ADMITTED',
    priority: 'URGENT',
    source: 'WALK_IN',
    reason: 'SECRET-REASON',
    presentingComplaint: 'SECRET-COMPLAINT',
    provisionalDiagnosis: 'SECRET-PROVISIONAL',
    examinationFindings: 'SECRET-EXAM',
    admittedAt: new Date('2026-10-10T08:00:00Z'),
    expectedDischargeAt: null,
    dischargedAt: null,
    dischargeDisposition: null,
    finalDiagnosis: null,
    dischargeSummary: null,
    dischargeInstructions: null,
    followUpDate: null,
    cancelReason: null,
    cancelledAt: null,
    patient: { id: 'p1', fullName: 'Test Patient', studentNumber: '2022000001' },
    attendingDoctor: { id: 'd1', fullName: 'Dr. Test' },
    notes: [{ id: 'n1', body: 'SECRET-NOTE' }],
    vitals: [{ id: 'v1', pulse: 99 }],
    labOrders: [],
    prescriptions: [],
    ...overrides,
  }
}

// A valid request body for admitting a patient
const admitBody = {
  patientId: 'p1',
  priority: 'URGENT',
  source: 'WALK_IN',
  presentingComplaint: 'Fever and vomiting for three days',
  reason: 'Severe malaria, needs IV treatment',
  consentBy: 'PATIENT',
}

// A valid body for discharging a patient home
const dischargeBody = {
  disposition: 'HOME',
  finalDiagnosis: 'Malaria, treated',
  dischargeSummary: 'Responded well to treatment.',
  dischargeInstructions: 'Rest and finish all tablets.',
}

// Programs the fake database so that admitting patient p1 works
function primeAdmitHappyPath() {
  let counter = 0
  db.$queryRaw.mockImplementation(async () => [{ lastNumber: ++counter }])
  db.user.findFirst.mockImplementation(async ({ where }: { where: { role: string; id: string } }) => {
    if (where.role === 'PATIENT') return { id: 'p1', fullName: 'Test Patient' }
    if (where.role === 'DOCTOR') return { id: where.id }
    return null
  })
  db.admission.findFirst.mockResolvedValue(null) // no active admission, no earlier stay
  db.admission.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `adm-${data.admissionNumber}`,
    ...data,
    status: 'ADMITTED',
    patient: { id: 'p1', fullName: 'Test Patient', studentNumber: '2022000001' },
    attendingDoctor: { id: data.attendingDoctorId, fullName: 'Dr. Test' },
    admittingDoctor: { id: data.admittingDoctorId, fullName: 'Dr. Test' },
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  // The fake transaction simply runs the function against the same fake database
  db.$transaction.mockImplementation(async (work: (tx: typeof db) => unknown) => work(db))
  db.accessLog.create.mockResolvedValue({})
  db.notification.create.mockResolvedValue({})
  db.notification.createMany.mockResolvedValue({ count: 0 })
  db.nextOfKinAssignment.findMany.mockResolvedValue([])
  db.labOrder.count.mockResolvedValue(0)
  db.prescription.count.mockResolvedValue(0)
})

// ── Admitting a patient ──────────────────────────────────────────────────────

describe('POST /api/admissions (admit)', () => {
  it('admits a registered patient and gives the stay an admission number', async () => {
    primeAdmitHappyPath()
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })

    expect(result.status).toBe(201)
    expect(result.json.success).toBe(true)
    expect(result.json.data.admissionNumber).toMatch(/^ADM-\d{4}-000001$/)
    expect(result.json.data.status).toBe('ADMITTED')
    expect(result.json.data.isReadmission).toBe(false)
    // The admitting doctor becomes the attending doctor by default
    const savedData = db.admission.create.mock.calls[0][0].data
    expect(savedData.admittingDoctorId).toBe('d1')
    expect(savedData.attendingDoctorId).toBe('d1')
  })

  it('gives different admission numbers to different admissions', async () => {
    primeAdmitHappyPath()
    const first = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    const second = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...admitBody, patientId: 'p1' } })
    expect(first.json.data.admissionNumber).not.toBe(second.json.data.admissionNumber)
  })

  it('creates the number and the admission in ONE transaction', async () => {
    primeAdmitHappyPath()
    await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    expect(db.admission.create).toHaveBeenCalledTimes(1)
  })

  it('rejects an unknown patient with 404 and creates nothing', async () => {
    primeAdmitHappyPath()
    db.user.findFirst.mockResolvedValue(null)
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...admitBody, patientId: 'ghost' } })
    expect(result.status).toBe(404)
    expect(db.admission.create).not.toHaveBeenCalled()
  })

  it('only looks for ACTIVE users who really have the PATIENT role', async () => {
    primeAdmitHappyPath()
    await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'p1', role: 'PATIENT', isActive: true })
  })

  it('refuses a second ACTIVE admission for the same patient with 409', async () => {
    primeAdmitHappyPath()
    db.admission.findFirst.mockResolvedValue({ admissionNumber: 'ADM-2026-000009' })
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    expect(result.status).toBe(409)
    expect(result.json.error).toMatch(/already admitted/i)
    expect(db.admission.create).not.toHaveBeenCalled()
  })

  it('turns a database unique violation (a race between two requests) into 409', async () => {
    primeAdmitHappyPath()
    db.admission.create.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    expect(result.status).toBe(409)
  })

  it('flags a readmission when the patient was discharged within 30 days', async () => {
    primeAdmitHappyPath()
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    // first findFirst call = "already admitted?" (no), second = "last discharge" (10 days ago)
    db.admission.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ dischargedAt: tenDaysAgo })
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    expect(result.status).toBe(201)
    expect(result.json.data.isReadmission).toBe(true)
  })

  it('rejects an admission date in the future with 400', async () => {
    primeAdmitHappyPath()
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...admitBody, admittedAt: nextWeek } })
    expect(result.status).toBe(400)
  })

  it('rejects an expected discharge before the admission date with 400', async () => {
    primeAdmitHappyPath()
    const result = await call(admitPatient, {
      role: 'DOCTOR', userId: 'd1', method: 'POST',
      body: { ...admitBody, admittedAt: '2026-10-10T08:00:00Z', expectedDischargeAt: '2026-10-09T08:00:00Z' },
    })
    expect(result.status).toBe(400)
  })

  it('rejects an incomplete request with 400', async () => {
    primeAdmitHappyPath()
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { patientId: 'p1' } })
    expect(result.status).toBe(400)
  })

  it('needs an attending doctor when an ADMIN admits', async () => {
    primeAdmitHappyPath()
    const result = await call(admitPatient, { role: 'ADMIN', userId: 'a1', method: 'POST', body: admitBody })
    expect(result.status).toBe(400)
    const withDoctor = await call(admitPatient, {
      role: 'ADMIN', userId: 'a1', method: 'POST', body: { ...admitBody, attendingDoctorId: 'd2' },
    })
    expect(withDoctor.status).toBe(201)
    expect(db.admission.create.mock.calls[0][0].data.attendingDoctorId).toBe('d2')
  })

  it('closes the clinic visit the admission came from', async () => {
    primeAdmitHappyPath()
    db.visit.findFirst.mockResolvedValue({ id: 'visit1' })
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...admitBody, visitId: 'visit1' } })
    expect(result.status).toBe(201)
    expect(db.visit.updateMany.mock.calls[0][0].data).toEqual({ status: 'CHECKED_OUT' })
  })

  it('rejects a visit that belongs to a different patient', async () => {
    primeAdmitHappyPath()
    db.visit.findFirst.mockResolvedValue(null)
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...admitBody, visitId: 'other' } })
    expect(result.status).toBe(400)
    expect(db.admission.create).not.toHaveBeenCalled()
  })

  it('writes a CREATE entry to the access log', async () => {
    primeAdmitHappyPath()
    await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({
      accessedByUserId: 'd1', targetPatientId: 'p1', action: 'CREATE', resourceType: 'ADMISSION',
    })
  })

  it('notifies the patient and the consenting next of kin', async () => {
    primeAdmitHappyPath()
    db.nextOfKinAssignment.findMany.mockResolvedValue([{ kinUserId: 'k1' }])
    await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: admitBody })
    const recipients = db.notification.create.mock.calls.map((callArgs) => callArgs[0].data.userId).sort()
    expect(recipients).toEqual(['k1', 'p1'])
    // only kin who are active AND have given consent are looked up
    expect(db.nextOfKinAssignment.findMany.mock.calls[0][0].where).toMatchObject({
      patientId: 'p1', isActive: true, emergencyConsentGiven: true,
    })
  })
})

describe('admitting with next of kin consent', () => {
  const kinBody = { ...admitBody, consentBy: 'NEXT_OF_KIN', consentKinAssignmentId: 'kin-assign-1' }

  it('refuses when no next of kin assignment is named', async () => {
    primeAdmitHappyPath()
    const result = await call(admitPatient, {
      role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...admitBody, consentBy: 'NEXT_OF_KIN' },
    })
    expect(result.status).toBe(400)
    expect(db.admission.create).not.toHaveBeenCalled()
  })

  it('refuses when the assignment is not active with consent given', async () => {
    primeAdmitHappyPath()
    db.nextOfKinAssignment.findFirst.mockResolvedValue(null)
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: kinBody })
    expect(result.status).toBe(400)
    expect(result.json.error).toMatch(/consent/i)
    expect(db.nextOfKinAssignment.findFirst.mock.calls[0][0].where).toMatchObject({
      id: 'kin-assign-1', patientId: 'p1', isActive: true, emergencyConsentGiven: true,
    })
    expect(db.admission.create).not.toHaveBeenCalled()
  })

  it('admits when the next of kin consent is on record, and stores which assignment gave it', async () => {
    primeAdmitHappyPath()
    db.nextOfKinAssignment.findFirst.mockResolvedValue({ id: 'kin-assign-1' })
    const result = await call(admitPatient, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: kinBody })
    expect(result.status).toBe(201)
    const savedData = db.admission.create.mock.calls[0][0].data
    expect(savedData.consentBy).toBe('NEXT_OF_KIN')
    expect(savedData.consentKinAssignmentId).toBe('kin-assign-1')
  })
})

// ── Who may use the admission routes at all ──────────────────────────────────

describe('access control', () => {
  it('answers 401 to everyone who is not logged in', async () => {
    expect((await call(listAdmissions)).status).toBe(401)
    expect((await call(admitPatient, { method: 'POST', body: admitBody })).status).toBe(401)
    expect((await call(getAdmission)).status).toBe(401)
    expect((await call(patchAdmission, { method: 'PATCH', body: { priority: 'URGENT' } })).status).toBe(401)
    expect((await call(postNote, { method: 'POST', body: { kind: 'PROGRESS', body: 'x' } })).status).toBe(401)
    expect((await call(postVitals, { method: 'POST', body: { pulse: 80 } })).status).toBe(401)
    expect((await call(postDischarge, { method: 'POST', body: dischargeBody })).status).toBe(401)
    expect((await call(postCancel, { method: 'POST', body: { reason: 'mistake' } })).status).toBe(401)
    expect((await call(getStats)).status).toBe(401)
    expect((await call(getPatientHistory, { id: 'p1' })).status).toBe(401)
  })

  it('gives pharmacists and lab technicians no access at all', async () => {
    for (const role of ['PHARMACIST', 'LAB_TECHNICIAN'] as const) {
      expect((await call(listAdmissions, { role })).status).toBe(403)
      expect((await call(getAdmission, { role })).status).toBe(403)
      expect((await call(admitPatient, { role, method: 'POST', body: admitBody })).status).toBe(403)
      expect((await call(getPatientHistory, { role, id: 'p1' })).status).toBe(403)
    }
  })

  it('does not let receptionists, patients or next of kin change anything', async () => {
    for (const role of ['RECEPTIONIST', 'PATIENT', 'NEXT_OF_KIN'] as const) {
      expect((await call(admitPatient, { role, method: 'POST', body: admitBody })).status).toBe(403)
      expect((await call(patchAdmission, { role, method: 'PATCH', body: { priority: 'URGENT' } })).status).toBe(403)
      expect((await call(postNote, { role, method: 'POST', body: { kind: 'PROGRESS', body: 'x' } })).status).toBe(403)
      expect((await call(postVitals, { role, method: 'POST', body: { pulse: 80 } })).status).toBe(403)
      expect((await call(postDischarge, { role, method: 'POST', body: dischargeBody })).status).toBe(403)
      expect((await call(postCancel, { role, method: 'POST', body: { reason: 'mistake' } })).status).toBe(403)
    }
    expect(db.admission.updateMany).not.toHaveBeenCalled()
    expect(db.admissionNote.create).not.toHaveBeenCalled()
  })

  it('keeps stats for doctors and admins only', async () => {
    for (const role of ['RECEPTIONIST', 'PATIENT', 'NEXT_OF_KIN', 'PHARMACIST'] as const) {
      expect((await call(getStats, { role })).status).toBe(403)
    }
  })
})

// ── Reading one admission ────────────────────────────────────────────────────

describe('GET /api/admissions/:id', () => {
  it('stops a patient reading ANOTHER patient\'s admission with 403', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ patientId: 'p1' }))
    const result = await call(getAdmission, { role: 'PATIENT', userId: 'someone-else' })
    expect(result.status).toBe(403)
    expect(JSON.stringify(result.json)).not.toContain('SECRET')
  })

  it('lets a patient read their OWN admission, without staff-only material', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({
      status: 'DISCHARGED', dischargedAt: new Date('2026-10-14T08:00:00Z'),
      dischargeSummary: 'Recovered well', dischargeInstructions: 'Rest',
    }))
    const result = await call(getAdmission, { role: 'PATIENT', userId: 'p1' })
    expect(result.status).toBe(200)
    expect(result.json.data.dischargeSummary).toBe('Recovered well')
    expect(result.json.data.dischargeInstructions).toBe('Rest')
    expect(JSON.stringify(result.json)).not.toMatch(/SECRET-NOTE|SECRET-EXAM|SECRET-PROVISIONAL/)
    // a patient looking at their own record is not written to the access log
    expect(db.accessLog.create).not.toHaveBeenCalled()
  })

  it('shows a receptionist the census view only: no diagnoses, notes or vitals', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    const result = await call(getAdmission, { role: 'RECEPTIONIST', userId: 'r1' })
    expect(result.status).toBe(200)
    expect(result.json.data.admissionNumber).toBe('ADM-2026-000001')
    expect(result.json.data.patient.fullName).toBe('Test Patient')
    expect(JSON.stringify(result.json)).not.toMatch(/SECRET|pulse|notes|vitals/i)
  })

  it('shows a doctor the full clinical detail and logs the view', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    const result = await call(getAdmission, { role: 'DOCTOR', userId: 'd1' })
    expect(result.status).toBe(200)
    expect(JSON.stringify(result.json)).toContain('SECRET-NOTE')
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({
      accessedByUserId: 'd1', targetPatientId: 'p1', action: 'VIEW', resourceType: 'ADMISSION', resourceId: 'adm1',
    })
  })

  it('answers 404 for an admission that does not exist', async () => {
    db.admission.findUnique.mockResolvedValue(null)
    expect((await call(getAdmission, { role: 'DOCTOR', userId: 'd1' })).status).toBe(404)
  })

  it('shows next of kin status and dates only, and only while consent is on record', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())

    db.nextOfKinAssignment.findFirst.mockResolvedValue(null) // no active assignment with consent
    expect((await call(getAdmission, { role: 'NEXT_OF_KIN', userId: 'k1' })).status).toBe(403)

    db.nextOfKinAssignment.findFirst.mockResolvedValue({ id: 'assign1' })
    const allowed = await call(getAdmission, { role: 'NEXT_OF_KIN', userId: 'k1' })
    expect(allowed.status).toBe(200)
    expect(allowed.json.data.status).toBe('ADMITTED')
    expect(JSON.stringify(allowed.json)).not.toMatch(/SECRET/)
    expect(db.nextOfKinAssignment.findFirst.mock.calls[1][0].where).toMatchObject({
      kinUserId: 'k1', patientId: 'p1', isActive: true, emergencyConsentGiven: true,
    })
  })
})

// ── Listing ──────────────────────────────────────────────────────────────────

describe('GET /api/admissions (list)', () => {
  beforeEach(() => {
    db.admission.findMany.mockResolvedValue([storedAdmission()])
    db.admission.count.mockResolvedValue(1)
  })

  it('limits a patient to their OWN admissions, whatever they ask for', async () => {
    await call(listAdmissions, { role: 'PATIENT', userId: 'p1', url: 'http://localhost:3000/api/admissions?status=ADMITTED' })
    expect(db.admission.findMany.mock.calls[0][0].where).toMatchObject({ patientId: 'p1', status: 'ADMITTED' })
  })

  it('limits next of kin to patients with an active assignment that has consent', async () => {
    db.nextOfKinAssignment.findMany.mockResolvedValue([{ patientId: 'p1' }])
    await call(listAdmissions, { role: 'NEXT_OF_KIN', userId: 'k1' })
    expect(db.nextOfKinAssignment.findMany.mock.calls[0][0].where).toMatchObject({
      kinUserId: 'k1', isActive: true, emergencyConsentGiven: true,
    })
    expect(db.admission.findMany.mock.calls[0][0].where.patientId).toEqual({ in: ['p1'] })
  })

  it('supports search, filters and pagination', async () => {
    const url = 'http://localhost:3000/api/admissions?q=chanda&status=ADMITTED&priority=URGENT&attendingDoctorId=d1&page=2&pageSize=5'
    const result = await call(listAdmissions, { role: 'DOCTOR', userId: 'd1', url })
    expect(result.status).toBe(200)
    const query = db.admission.findMany.mock.calls[0][0]
    expect(query.where).toMatchObject({ status: 'ADMITTED', priority: 'URGENT', attendingDoctorId: 'd1' })
    // search covers patient name, student number and admission number
    expect(query.where.OR).toHaveLength(3)
    expect(query.skip).toBe(5)
    expect(query.take).toBe(5)
    expect(result.json.data).toMatchObject({ total: 1, page: 2, pageSize: 5 })
  })

  it('rejects a bad filter value with 400', async () => {
    const result = await call(listAdmissions, { role: 'DOCTOR', userId: 'd1', url: 'http://localhost:3000/api/admissions?status=NOPE' })
    expect(result.status).toBe(400)
  })

  it('gives a receptionist the census view of the list (no clinical text)', async () => {
    const result = await call(listAdmissions, { role: 'RECEPTIONIST', userId: 'r1' })
    expect(result.status).toBe(200)
    expect(JSON.stringify(result.json)).not.toMatch(/SECRET/)
    expect(result.json.data.items[0].patient.fullName).toBe('Test Patient')
  })
})

// ── Updating ─────────────────────────────────────────────────────────────────

describe('PATCH /api/admissions/:id', () => {
  it('updates non-discharge fields of a current admission and logs only the field names', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    db.admission.updateMany.mockResolvedValue({ count: 1 })
    const result = await call(patchAdmission, { role: 'DOCTOR', userId: 'd1', method: 'PATCH', body: { priority: 'EMERGENCY' } })
    expect(result.status).toBe(200)
    expect(db.admission.updateMany.mock.calls[0][0].where).toEqual({ id: 'adm1', status: 'ADMITTED' })
    const logged = JSON.parse(db.accessLog.create.mock.calls[0][0].data.details)
    expect(logged).toEqual({ event: 'UPDATE', fields: ['priority'] })
  })

  it('refuses to change status or discharge fields', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    expect((await call(patchAdmission, { role: 'DOCTOR', userId: 'd1', method: 'PATCH', body: { status: 'DISCHARGED' } })).status).toBe(400)
    expect(db.admission.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to edit a discharged admission with 409', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'DISCHARGED' }))
    const result = await call(patchAdmission, { role: 'DOCTOR', userId: 'd1', method: 'PATCH', body: { priority: 'URGENT' } })
    expect(result.status).toBe(409)
    expect(db.admission.updateMany).not.toHaveBeenCalled()
  })
})

// ── Discharge ────────────────────────────────────────────────────────────────

describe('POST /api/admissions/:id/discharge', () => {
  beforeEach(() => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    db.admission.updateMany.mockResolvedValue({ count: 1 })
  })

  it('discharges a current admission, logs it and notifies the patient', async () => {
    const result = await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: dischargeBody })
    expect(result.status).toBe(200)
    expect(result.json.warnings).toEqual([])
    const saved = db.admission.updateMany.mock.calls[0][0]
    expect(saved.where).toEqual({ id: 'adm1', status: 'ADMITTED' })
    expect(saved.data).toMatchObject({ status: 'DISCHARGED', dischargedById: 'd1', dischargeDisposition: 'HOME' })
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({ action: 'EDIT', resourceType: 'ADMISSION' })
    expect(JSON.parse(db.accessLog.create.mock.calls[0][0].data.details).event).toBe('DISCHARGE')
    expect(db.notification.create.mock.calls[0][0].data).toMatchObject({ userId: 'p1', type: 'ADMISSION_DISCHARGED' })
  })

  it('rejects a discharge date BEFORE the admission date with 400, changing nothing', async () => {
    const result = await call(postDischarge, {
      role: 'DOCTOR', userId: 'd1', method: 'POST',
      body: { ...dischargeBody, dischargedAt: '2026-10-09T08:00:00Z' }, // admitted on 10 October
    })
    expect(result.status).toBe(400)
    expect(result.json.error).toMatch(/before the admission/i)
    expect(db.admission.updateMany).not.toHaveBeenCalled()
  })

  it('refuses to discharge twice: 409 and nothing changes', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'DISCHARGED' }))
    const result = await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: dischargeBody })
    expect(result.status).toBe(409)
    expect(db.admission.updateMany).not.toHaveBeenCalled()
  })

  it('answers 409 if someone else discharged the patient a moment earlier (race)', async () => {
    db.admission.updateMany.mockResolvedValue({ count: 0 })
    const result = await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: dischargeBody })
    expect(result.status).toBe(409)
    expect(db.accessLog.create).not.toHaveBeenCalled()
    expect(db.notification.create).not.toHaveBeenCalled()
  })

  it('refuses to discharge a cancelled admission with 409', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'CANCELLED' }))
    expect((await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: dischargeBody })).status).toBe(409)
  })

  it('needs a final diagnosis and the fields for the chosen outcome', async () => {
    const noDiagnosis = await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { ...dischargeBody, finalDiagnosis: '' } })
    expect(noDiagnosis.status).toBe(400)
    const transferNoPlace = await call(postDischarge, {
      role: 'DOCTOR', userId: 'd1', method: 'POST', body: { disposition: 'TRANSFERRED_OUT', finalDiagnosis: 'x', dischargeSummary: 'y' },
    })
    expect(transferNoPlace.status).toBe(400)
    expect(transferNoPlace.json.error).toMatch(/destination/i)
  })

  it('lets only a DOCTOR record a death: an admin gets 403', async () => {
    const deathBody = {
      disposition: 'DECEASED', finalDiagnosis: 'Cerebral malaria',
      timeOfDeath: '2026-10-14T03:00:00Z', causeOfDeath: 'Cerebral malaria',
    }
    const byAdmin = await call(postDischarge, { role: 'ADMIN', userId: 'a1', method: 'POST', body: deathBody })
    expect(byAdmin.status).toBe(403)
    expect(db.admission.updateMany).not.toHaveBeenCalled()

    const byDoctor = await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: deathBody })
    expect(byDoctor.status).toBe(200)
    expect(db.admission.updateMany.mock.calls[0][0].data).toMatchObject({ dischargeDisposition: 'DECEASED', causeOfDeath: 'Cerebral malaria' })
  })

  it('does not send a notification to a patient who has died, but still tells their next of kin', async () => {
    db.nextOfKinAssignment.findMany.mockResolvedValue([{ kinUserId: 'k1' }])
    await call(postDischarge, {
      role: 'DOCTOR', userId: 'd1', method: 'POST',
      body: { disposition: 'DECEASED', finalDiagnosis: 'x', timeOfDeath: '2026-10-14T03:00:00Z', causeOfDeath: 'x' },
    })
    const recipients = db.notification.create.mock.calls.map((callArgs) => callArgs[0].data.userId)
    expect(recipients).toEqual(['k1'])
  })

  it('discharges anyway but warns about open lab orders and undispensed prescriptions', async () => {
    db.labOrder.count.mockResolvedValue(2)
    db.prescription.count.mockResolvedValue(1)
    const result = await call(postDischarge, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: dischargeBody })
    expect(result.status).toBe(200)
    expect(result.json.warnings).toHaveLength(2)
    // the linked work is only COUNTED: nothing is deleted or detached
    expect(db.admission.updateMany.mock.calls[0][0].data).not.toHaveProperty('labOrders')
  })
})

// ── Cancel ───────────────────────────────────────────────────────────────────

describe('POST /api/admissions/:id/cancel', () => {
  beforeEach(() => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    db.admission.updateMany.mockResolvedValue({ count: 1 })
  })

  it('needs a reason', async () => {
    const result = await call(postCancel, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { reason: '' } })
    expect(result.status).toBe(400)
    expect(db.admission.updateMany).not.toHaveBeenCalled()
  })

  it('cancels a current admission, keeps it (no delete) and records who and why', async () => {
    const result = await call(postCancel, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { reason: 'Admitted by mistake' } })
    expect(result.status).toBe(200)
    expect(db.admission.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'CANCELLED', cancelReason: 'Admitted by mistake', cancelledById: 'd1',
    })
    expect(JSON.parse(db.accessLog.create.mock.calls[0][0].data.details).event).toBe('CANCEL')
  })

  it('cannot cancel a discharged admission, or cancel twice (409)', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'DISCHARGED' }))
    expect((await call(postCancel, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { reason: 'mistake' } })).status).toBe(409)
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'CANCELLED' }))
    expect((await call(postCancel, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { reason: 'mistake' } })).status).toBe(409)
    expect(db.admission.updateMany).not.toHaveBeenCalled()
  })
})

// ── Notes and vitals ─────────────────────────────────────────────────────────

describe('notes and vitals', () => {
  it('adds a note to a current admission and logs it', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    db.admissionNote.create.mockResolvedValue({ id: 'n9', kind: 'PROGRESS', body: 'Improving' })
    const result = await call(postNote, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { kind: 'PROGRESS', body: 'Improving' } })
    expect(result.status).toBe(201)
    expect(db.admissionNote.create.mock.calls[0][0].data).toMatchObject({ admissionId: 'adm1', authorId: 'd1', kind: 'PROGRESS' })
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({ action: 'CREATE', resourceType: 'ADMISSION_NOTE' })
  })

  it('rejects a note on a DISCHARGED admission', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'DISCHARGED' }))
    const result = await call(postNote, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { kind: 'PROGRESS', body: 'Late note' } })
    expect(result.status).toBe(409)
    expect(db.admissionNote.create).not.toHaveBeenCalled()
  })

  it('rejects a note on a CANCELLED admission', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'CANCELLED' }))
    expect((await call(postNote, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { kind: 'WARD_ROUND', body: 'x' } })).status).toBe(409)
  })

  it('rejects an empty note or an unknown kind', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    expect((await call(postNote, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { kind: 'PROGRESS', body: '  ' } })).status).toBe(400)
    expect((await call(postNote, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { kind: 'GOSSIP', body: 'x' } })).status).toBe(400)
  })

  it('records vitals on a current admission', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    db.vitalsReading.create.mockResolvedValue({ id: 'vr1' })
    const result = await call(postVitals, { role: 'ADMIN', userId: 'a1', method: 'POST', body: { temperature: 38.2, pulse: 96, systolic: 120, diastolic: 80 } })
    expect(result.status).toBe(201)
    expect(db.vitalsReading.create.mock.calls[0][0].data).toMatchObject({ admissionId: 'adm1', recordedById: 'a1', pulse: 96 })
  })

  it('rejects vitals on a discharged admission, and nonsense values', async () => {
    db.admission.findUnique.mockResolvedValue(storedAdmission({ status: 'DISCHARGED' }))
    expect((await call(postVitals, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { pulse: 80 } })).status).toBe(409)
    db.admission.findUnique.mockResolvedValue(storedAdmission())
    expect((await call(postVitals, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: { temperature: 99 } })).status).toBe(400)
    expect(db.vitalsReading.create).not.toHaveBeenCalled()
  })
})

// ── History ──────────────────────────────────────────────────────────────────

describe('GET /api/patients/:id/admissions', () => {
  const history = [
    // newest first, as the route asks the database for
    storedAdmission({ id: 'a2', admissionNumber: 'ADM-2026-000002', status: 'ADMITTED', admittedAt: new Date('2026-10-10T08:00:00Z'), dischargedAt: null }),
    storedAdmission({
      id: 'a1', admissionNumber: 'ADM-2026-000001', status: 'DISCHARGED',
      admittedAt: new Date('2026-10-01T08:00:00Z'), dischargedAt: new Date('2026-10-05T08:00:00Z'),
      dischargeSummary: 'Recovered', dischargeInstructions: 'Rest',
    }),
  ]

  it('is still retrievable after discharge, with length of stay and a readmission flag', async () => {
    db.admission.findMany.mockResolvedValue(history)
    const result = await call(getPatientHistory, { role: 'DOCTOR', userId: 'd1', id: 'p1' })
    expect(result.status).toBe(200)
    expect(result.json.data).toHaveLength(2)
    const discharged = result.json.data.find((stay: { id: string }) => stay.id === 'a1')
    expect(discharged.status).toBe('DISCHARGED')
    expect(discharged.lengthOfStayDays).toBe(4)
    expect(discharged.isReadmission).toBe(false)
    // a2 began 5 days after a1 ended: a readmission
    const readmitted = result.json.data.find((stay: { id: string }) => stay.id === 'a2')
    expect(readmitted.isReadmission).toBe(true)
  })

  it('logs a doctor viewing the history', async () => {
    db.admission.findMany.mockResolvedValue(history)
    await call(getPatientHistory, { role: 'DOCTOR', userId: 'd1', id: 'p1' })
    expect(db.accessLog.create.mock.calls[0][0].data).toMatchObject({
      targetPatientId: 'p1', action: 'VIEW', resourceType: 'ADMISSION_HISTORY',
    })
  })

  it('lets a patient read their own history but not anyone else\'s', async () => {
    db.admission.findMany.mockResolvedValue(history)
    const own = await call(getPatientHistory, { role: 'PATIENT', userId: 'p1', id: 'p1' })
    expect(own.status).toBe(200)
    expect(JSON.stringify(own.json)).not.toMatch(/SECRET-NOTE|SECRET-EXAM/)
    const other = await call(getPatientHistory, { role: 'PATIENT', userId: 'p1', id: 'p2' })
    expect(other.status).toBe(403)
  })

  it('does not show a receptionist the history', async () => {
    expect((await call(getPatientHistory, { role: 'RECEPTIONIST', userId: 'r1', id: 'p1' })).status).toBe(403)
  })
})

// ── Stats ────────────────────────────────────────────────────────────────────

describe('GET /api/admissions/stats', () => {
  it('returns the headline numbers', async () => {
    db.admission.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(10)
    db.admission.findMany.mockResolvedValue([
      { id: 'a1', patientId: 'p1', status: 'DISCHARGED', admittedAt: new Date('2026-09-01T00:00:00Z'), dischargedAt: new Date('2026-09-03T00:00:00Z') },
      { id: 'a2', patientId: 'p1', status: 'DISCHARGED', admittedAt: new Date('2026-09-10T00:00:00Z'), dischargedAt: new Date('2026-09-14T00:00:00Z') },
    ])
    const result = await call(getStats, { role: 'ADMIN', userId: 'a1' })
    expect(result.status).toBe(200)
    expect(result.json.data).toMatchObject({
      currentAdmissions: 3, dischargesToday: 1, completedAdmissions: 10,
      averageLengthOfStayDays: 3, readmissionCount: 1,
    })
  })
})

// ── Lab link ─────────────────────────────────────────────────────────────────

describe('ordering lab tests from an admission', () => {
  const labBody = { patientId: 'p1', testIds: ['t1'], priority: 'URGENT', admissionId: 'adm1' }

  beforeEach(() => {
    db.user.findFirst.mockResolvedValue({ id: 'p1' })
    db.labTest.findMany.mockResolvedValue([{ id: 't1', code: 'HB', unit: 'g/dL', refLow: 12, refHigh: 17, criticalLow: 7, criticalHigh: 20, normalText: null }])
    db.labOrder.create.mockResolvedValue({ id: 'lab1' })
  })

  it('stores the admission id on the lab order when the admission is current', async () => {
    db.admission.findFirst.mockResolvedValue({ id: 'adm1' })
    const result = await call(postLabOrder, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: labBody, url: 'http://localhost:3000/api/lab/orders' })
    expect(result.status).toBe(201)
    expect(db.labOrder.create.mock.calls[0][0].data.admissionId).toBe('adm1')
    expect(db.admission.findFirst.mock.calls[0][0].where).toMatchObject({ id: 'adm1', patientId: 'p1', status: 'ADMITTED' })
  })

  it('rejects an admission that is not this patient\'s current one', async () => {
    db.admission.findFirst.mockResolvedValue(null)
    const result = await call(postLabOrder, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: labBody, url: 'http://localhost:3000/api/lab/orders' })
    expect(result.status).toBe(400)
    expect(db.labOrder.create).not.toHaveBeenCalled()
  })

  it('leaves admissionId empty for an ordinary clinic lab order', async () => {
    const { admissionId: _unused, ...ordinaryBody } = labBody
    void _unused
    await call(postLabOrder, { role: 'DOCTOR', userId: 'd1', method: 'POST', body: ordinaryBody, url: 'http://localhost:3000/api/lab/orders' })
    expect(db.labOrder.create.mock.calls[0][0].data.admissionId).toBeNull()
    expect(db.admission.findFirst).not.toHaveBeenCalled()
  })
})
