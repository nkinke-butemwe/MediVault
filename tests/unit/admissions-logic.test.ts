// tests/unit/admissions-logic.test.ts
//
// Tests for the pure logic behind inpatient admissions: the helper functions, the
// "who sees what" views, the zod validators, the timeline integration and the care team.
// No real database is used.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// The care-team test needs a fake database. (The other tests in this file do not touch it.)
const db = vi.hoisted(() => ({
  medicalRecord: { findMany: vi.fn() },
  prescription: { findMany: vi.fn() },
  labOrder: { findMany: vi.fn() },
  admission: { findMany: vi.fn() },
}))
vi.mock('@/src/lib/prisma', () => ({ prisma: db }))

import {
  averageLengthOfStayDays,
  buildDischargeWarnings,
  canTransition,
  canUseDisposition,
  countReadmissions,
  flagReadmissions,
  formatAdmissionNumber,
  isReadmission,
  isUniqueViolation,
  isValidAdmissionNumber,
  lengthOfStayDays,
  nextAdmissionNumber,
  startOfLusakaDay,
  validateAdmissionDates,
  validateDischarge,
  type DischargeInput,
} from '@/src/lib/admissions'
import { toCensusView, toKinView, toPatientView, viewForRole, type AdmissionRow } from '@/src/lib/admission-views'
import {
  CancelAdmissionSchema,
  CreateAdmissionSchema,
  CreateVitalsReadingSchema,
  DischargeAdmissionSchema,
  UpdateAdmissionSchema,
} from '@/src/lib/validators'
import { buildTimeline } from '@/src/lib/timeline'
import { getCareTeamDoctorIds } from '@/src/lib/care-team'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ── length of stay ───────────────────────────────────────────────────────────

describe('lengthOfStayDays', () => {
  it('counts whole days between admission and discharge', () => {
    const admitted = new Date('2026-10-01T08:00:00Z')
    expect(lengthOfStayDays(admitted, new Date('2026-10-04T09:00:00Z'))).toBe(3)
  })

  it('is 0 for a stay shorter than a day', () => {
    const admitted = new Date('2026-10-01T08:00:00Z')
    expect(lengthOfStayDays(admitted, new Date('2026-10-02T07:00:00Z'))).toBe(0)
  })

  it('uses "now" when the patient has not been discharged', () => {
    const admitted = new Date('2026-10-01T08:00:00Z')
    expect(lengthOfStayDays(admitted, null, new Date('2026-10-06T08:00:00Z'))).toBe(5)
  })

  it('never goes negative', () => {
    const admitted = new Date('2026-10-05T08:00:00Z')
    expect(lengthOfStayDays(admitted, new Date('2026-10-01T08:00:00Z'))).toBe(0)
  })
})

// ── readmission ──────────────────────────────────────────────────────────────

describe('isReadmission', () => {
  const discharged = new Date('2026-09-01T10:00:00Z')

  it('is false when the patient was never discharged before', () => {
    expect(isReadmission(null, new Date('2026-10-01T10:00:00Z'))).toBe(false)
  })

  it('is true inside the 30 day window, including exactly day 30', () => {
    expect(isReadmission(discharged, new Date(discharged.getTime() + 10 * MS_PER_DAY))).toBe(true)
    expect(isReadmission(discharged, new Date(discharged.getTime() + 30 * MS_PER_DAY))).toBe(true)
  })

  it('is false just outside the window', () => {
    expect(isReadmission(discharged, new Date(discharged.getTime() + 30 * MS_PER_DAY + 1000))).toBe(false)
  })

  it('respects a custom window', () => {
    expect(isReadmission(discharged, new Date(discharged.getTime() + 10 * MS_PER_DAY), 7)).toBe(false)
  })

  it('is false when the previous stay ended AFTER the new one started', () => {
    expect(isReadmission(discharged, new Date('2026-08-01T10:00:00Z'))).toBe(false)
  })
})

describe('flagReadmissions and countReadmissions', () => {
  const history = [
    { id: 'a1', patientId: 'p1', status: 'DISCHARGED', admittedAt: new Date('2026-01-01T08:00:00Z'), dischargedAt: new Date('2026-01-05T08:00:00Z') },
    // 10 days after a1 ended: a readmission
    { id: 'a2', patientId: 'p1', status: 'DISCHARGED', admittedAt: new Date('2026-01-15T08:00:00Z'), dischargedAt: new Date('2026-01-18T08:00:00Z') },
    // Cancelled: ignored, and never a readmission
    { id: 'a3', patientId: 'p1', status: 'CANCELLED', admittedAt: new Date('2026-01-20T08:00:00Z'), dischargedAt: null },
    // Months later: not a readmission
    { id: 'a4', patientId: 'p1', status: 'ADMITTED', admittedAt: new Date('2026-06-01T08:00:00Z'), dischargedAt: null },
  ]

  it('flags only the stay that came back within 30 days', () => {
    const flags = flagReadmissions(history)
    expect(flags.get('a1')).toBe(false)
    expect(flags.get('a2')).toBe(true)
    expect(flags.get('a3')).toBe(false)
    expect(flags.get('a4')).toBe(false)
  })

  it('counts readmissions across patients', () => {
    const other = { id: 'b1', patientId: 'p2', status: 'DISCHARGED', admittedAt: new Date('2026-02-01T08:00:00Z'), dischargedAt: new Date('2026-02-02T08:00:00Z') }
    expect(countReadmissions([...history, other])).toBe(1)
  })
})

// ── transitions ──────────────────────────────────────────────────────────────

describe('canTransition', () => {
  it('lets an ADMITTED stay be discharged or cancelled', () => {
    expect(canTransition('ADMITTED', 'DISCHARGED')).toBe(true)
    expect(canTransition('ADMITTED', 'CANCELLED')).toBe(true)
  })

  it('never reactivates or changes a finished stay', () => {
    expect(canTransition('DISCHARGED', 'ADMITTED')).toBe(false)
    expect(canTransition('DISCHARGED', 'CANCELLED')).toBe(false)
    expect(canTransition('DISCHARGED', 'DISCHARGED')).toBe(false)
    expect(canTransition('CANCELLED', 'ADMITTED')).toBe(false)
    expect(canTransition('CANCELLED', 'DISCHARGED')).toBe(false)
  })

  it('does not treat ADMITTED to ADMITTED as a transition', () => {
    expect(canTransition('ADMITTED', 'ADMITTED')).toBe(false)
  })
})

// ── date rules ───────────────────────────────────────────────────────────────

describe('validateAdmissionDates', () => {
  const now = new Date('2026-10-16T10:00:00Z')

  it('accepts "now" and a date in the past', () => {
    expect(validateAdmissionDates({ admittedAt: now }, now)).toEqual([])
    expect(validateAdmissionDates({ admittedAt: new Date('2026-10-15T10:00:00Z') }, now)).toEqual([])
  })

  it('allows a tiny clock difference but not a real future date', () => {
    expect(validateAdmissionDates({ admittedAt: new Date(now.getTime() + 2 * 60 * 1000) }, now)).toEqual([])
    expect(validateAdmissionDates({ admittedAt: new Date(now.getTime() + 60 * 60 * 1000) }, now)).toHaveLength(1)
  })

  it('rejects an expected discharge before the admission', () => {
    const problems = validateAdmissionDates(
      { admittedAt: new Date('2026-10-15T10:00:00Z'), expectedDischargeAt: new Date('2026-10-14T10:00:00Z') },
      now
    )
    expect(problems.join(' ')).toMatch(/expected discharge/i)
  })
})

// ── discharge rules ──────────────────────────────────────────────────────────

describe('validateDischarge', () => {
  const admittedAt = new Date('2026-10-10T08:00:00Z')
  const now = new Date('2026-10-16T10:00:00Z')

  // A valid discharge home; each test then breaks one thing
  const base: DischargeInput = {
    disposition: 'HOME',
    dischargedAt: new Date('2026-10-15T10:00:00Z'),
    finalDiagnosis: 'Malaria, treated',
    dischargeSummary: 'Responded well to treatment.',
    dischargeInstructions: 'Rest and finish all tablets.',
  }

  it('accepts a complete discharge home', () => {
    expect(validateDischarge(base, admittedAt, now)).toEqual([])
  })

  it('rejects a discharge before the admission date', () => {
    const problems = validateDischarge({ ...base, dischargedAt: new Date('2026-10-09T08:00:00Z') }, admittedAt, now)
    expect(problems.join(' ')).toMatch(/before the admission/i)
  })

  it('rejects a discharge in the future', () => {
    const problems = validateDischarge({ ...base, dischargedAt: new Date('2026-10-20T08:00:00Z') }, admittedAt, now)
    expect(problems.join(' ')).toMatch(/future/i)
  })

  it('always requires a final diagnosis (blank spaces do not count)', () => {
    expect(validateDischarge({ ...base, finalDiagnosis: '   ' }, admittedAt, now).join(' ')).toMatch(/final diagnosis/i)
    expect(validateDischarge({ ...base, finalDiagnosis: null }, admittedAt, now).join(' ')).toMatch(/final diagnosis/i)
  })

  it('HOME needs a summary and instructions', () => {
    expect(validateDischarge({ ...base, dischargeSummary: null }, admittedAt, now).join(' ')).toMatch(/summary/i)
    expect(validateDischarge({ ...base, dischargeInstructions: '' }, admittedAt, now).join(' ')).toMatch(/instructions/i)
  })

  it('TRANSFERRED_OUT needs a destination and a summary, but not instructions', () => {
    const transfer: DischargeInput = { ...base, disposition: 'TRANSFERRED_OUT', transferDestination: 'UTH Lusaka', dischargeInstructions: null }
    expect(validateDischarge(transfer, admittedAt, now)).toEqual([])
    expect(validateDischarge({ ...transfer, transferDestination: null }, admittedAt, now).join(' ')).toMatch(/destination/i)
    expect(validateDischarge({ ...transfer, dischargeSummary: null }, admittedAt, now).join(' ')).toMatch(/summary/i)
  })

  it('LEFT_AGAINST_ADVICE needs a summary only', () => {
    const lama: DischargeInput = { ...base, disposition: 'LEFT_AGAINST_ADVICE', dischargeInstructions: null }
    expect(validateDischarge(lama, admittedAt, now)).toEqual([])
    expect(validateDischarge({ ...lama, dischargeSummary: null }, admittedAt, now).join(' ')).toMatch(/summary/i)
  })

  it('DECEASED needs a time and cause of death, and the time must fit the stay', () => {
    const death: DischargeInput = {
      ...base,
      disposition: 'DECEASED',
      dischargeSummary: null,
      dischargeInstructions: null,
      timeOfDeath: new Date('2026-10-15T09:00:00Z'),
      causeOfDeath: 'Cerebral malaria',
    }
    expect(validateDischarge(death, admittedAt, now)).toEqual([])
    expect(validateDischarge({ ...death, timeOfDeath: null }, admittedAt, now).join(' ')).toMatch(/time of death/i)
    expect(validateDischarge({ ...death, causeOfDeath: ' ' }, admittedAt, now).join(' ')).toMatch(/cause of death/i)
    expect(validateDischarge({ ...death, timeOfDeath: new Date('2026-10-01T09:00:00Z') }, admittedAt, now).join(' ')).toMatch(/before the admission/i)
  })
})

describe('canUseDisposition', () => {
  it('lets doctors and admins use the normal dispositions', () => {
    expect(canUseDisposition('DOCTOR', 'HOME')).toBe(true)
    expect(canUseDisposition('ADMIN', 'TRANSFERRED_OUT')).toBe(true)
  })

  it('lets only a doctor record a death', () => {
    expect(canUseDisposition('DOCTOR', 'DECEASED')).toBe(true)
    expect(canUseDisposition('ADMIN', 'DECEASED')).toBe(false)
    expect(canUseDisposition('RECEPTIONIST', 'DECEASED')).toBe(false)
    expect(canUseDisposition(null, 'DECEASED')).toBe(false)
  })

  it('lets nobody else discharge at all', () => {
    expect(canUseDisposition('RECEPTIONIST', 'HOME')).toBe(false)
    expect(canUseDisposition('PATIENT', 'HOME')).toBe(false)
  })
})

describe('buildDischargeWarnings', () => {
  it('says nothing when no work is open', () => {
    expect(buildDischargeWarnings({ pendingLabOrders: 0, undispensedPrescriptions: 0 })).toEqual([])
  })

  it('warns about open labs and undispensed prescriptions', () => {
    const warnings = buildDischargeWarnings({ pendingLabOrders: 2, undispensedPrescriptions: 1 })
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toMatch(/2 lab order/)
    expect(warnings[1]).toMatch(/1 prescription/)
  })
})

// ── admission numbers ────────────────────────────────────────────────────────

describe('admission numbers', () => {
  it('formats as ADM-year-six digits', () => {
    expect(formatAdmissionNumber(2026, 123)).toBe('ADM-2026-000123')
    expect(formatAdmissionNumber(2026, 1)).toBe('ADM-2026-000001')
  })

  it('recognises a valid number and rejects a bad one', () => {
    expect(isValidAdmissionNumber('ADM-2026-000123')).toBe(true)
    expect(isValidAdmissionNumber('ADM-26-123')).toBe(false)
    expect(isValidAdmissionNumber('adm-2026-000123')).toBe(false)
  })

  it('takes the next number from the per-year counter row', async () => {
    const fakeTransaction = { $queryRaw: vi.fn().mockResolvedValue([{ lastNumber: 42 }]) }
    expect(await nextAdmissionNumber(fakeTransaction, 2026)).toBe('ADM-2026-000042')
    expect(fakeTransaction.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('gives different numbers to calls that receive different counter values', async () => {
    let counter = 0
    const fakeTransaction = { $queryRaw: vi.fn().mockImplementation(async () => [{ lastNumber: ++counter }]) }
    const first = await nextAdmissionNumber(fakeTransaction, 2026)
    const second = await nextAdmissionNumber(fakeTransaction, 2026)
    expect(first).not.toBe(second)
  })
})

describe('isUniqueViolation', () => {
  it('recognises the Prisma unique-violation code only', () => {
    expect(isUniqueViolation({ code: 'P2002' })).toBe(true)
    expect(isUniqueViolation({ code: 'P2025' })).toBe(false)
    expect(isUniqueViolation(new Error('boom'))).toBe(false)
    expect(isUniqueViolation(null)).toBe(false)
  })
})

// ── Lusaka day and statistics ────────────────────────────────────────────────

describe('startOfLusakaDay', () => {
  it('starts the Lusaka day at 22:00 UTC the evening before', () => {
    // 00:30 UTC is 02:30 in Lusaka, so Lusaka's "today" began at 22:00 UTC yesterday
    expect(startOfLusakaDay(new Date('2026-10-18T00:30:00Z')).toISOString()).toBe('2026-10-17T22:00:00.000Z')
  })

  it('starts the Lusaka day at 22:00 UTC for a time later in the day too', () => {
    expect(startOfLusakaDay(new Date('2026-10-18T15:00:00Z')).toISOString()).toBe('2026-10-17T22:00:00.000Z')
  })
})

describe('averageLengthOfStayDays', () => {
  it('is 0 with no stays', () => {
    expect(averageLengthOfStayDays([])).toBe(0)
  })

  it('averages to one decimal', () => {
    const stays = [
      { admittedAt: new Date('2026-10-01T00:00:00Z'), dischargedAt: new Date('2026-10-03T00:00:00Z') }, // 2 days
      { admittedAt: new Date('2026-10-01T00:00:00Z'), dischargedAt: new Date('2026-10-02T00:00:00Z') }, // 1 day
    ]
    expect(averageLengthOfStayDays(stays)).toBe(1.5)
  })
})

// ── who sees what ────────────────────────────────────────────────────────────

describe('admission views', () => {
  // A row full of clinical detail, to prove the limited views leave it out
  const row = {
    id: 'a1',
    admissionNumber: 'ADM-2026-000001',
    patientId: 'p1',
    status: 'DISCHARGED',
    priority: 'URGENT',
    source: 'WALK_IN',
    reason: 'Severe malaria',
    provisionalDiagnosis: 'SECRET-PROVISIONAL',
    admittedAt: new Date('2026-10-01T08:00:00Z'),
    expectedDischargeAt: null,
    dischargedAt: new Date('2026-10-05T08:00:00Z'),
    dischargeDisposition: 'HOME',
    finalDiagnosis: 'Malaria',
    dischargeSummary: 'Recovered well',
    dischargeInstructions: 'Rest',
    followUpDate: null,
    cancelReason: null,
    cancelledAt: null,
    patient: { id: 'p1', fullName: 'Test Patient', studentNumber: '2022000001' },
    attendingDoctor: { id: 'd1', fullName: 'Dr. Test' },
    // staff-only extras that must never reach a limited view
    notes: [{ body: 'SECRET-NOTE' }],
    vitals: [{ pulse: 99 }],
    examinationFindings: 'SECRET-EXAM',
    causeOfDeath: 'SECRET-CAUSE',
  } as AdmissionRow & Record<string, unknown>

  it('census view (receptionist) has no clinical text', () => {
    const text = JSON.stringify(toCensusView(row))
    expect(text).toContain('ADM-2026-000001')
    expect(text).toContain('Test Patient')
    expect(text).not.toMatch(/SECRET|Malaria|Severe|Recovered|diagnosis/i)
  })

  it('patient view shows the outcome and discharge papers but not staff-only material', () => {
    const view = toPatientView(row)
    expect(view.dischargeSummary).toBe('Recovered well')
    expect(view.dischargeInstructions).toBe('Rest')
    expect(view.lengthOfStayDays).toBe(4)
    const text = JSON.stringify(view)
    expect(text).not.toMatch(/SECRET|vitals|notes/i)
  })

  it('kin view shows only status and dates', () => {
    const text = JSON.stringify(toKinView(row))
    expect(text).toContain('DISCHARGED')
    expect(text).not.toMatch(/SECRET|Malaria|Recovered|Rest|reason/i)
  })

  it('picks the right view for each role and nothing for others', () => {
    expect(JSON.stringify(viewForRole('DOCTOR', row))).toContain('SECRET-NOTE')
    expect(JSON.stringify(viewForRole('ADMIN', row))).toContain('SECRET-NOTE')
    expect(JSON.stringify(viewForRole('RECEPTIONIST', row))).not.toContain('SECRET')
    expect(viewForRole('PHARMACIST', row)).toBeNull()
    expect(viewForRole('LAB_TECHNICIAN', row)).toBeNull()
    expect(viewForRole(null, row)).toBeNull()
  })

  it('a cancelled admission has no length of stay', () => {
    expect(toCensusView({ ...row, status: 'CANCELLED', dischargedAt: null }).lengthOfStayDays).toBeNull()
  })
})

// ── validators ───────────────────────────────────────────────────────────────

describe('admission validators', () => {
  const validAdmission = {
    patientId: 'p1',
    priority: 'URGENT',
    source: 'WALK_IN',
    presentingComplaint: 'Fever and vomiting',
    reason: 'Severe malaria, needs IV treatment',
    consentBy: 'PATIENT',
  }

  it('accepts a minimal valid admission', () => {
    expect(CreateAdmissionSchema.safeParse(validAdmission).success).toBe(true)
  })

  it('requires the next of kin assignment when the next of kin gave consent', () => {
    const result = CreateAdmissionSchema.safeParse({ ...validAdmission, consentBy: 'NEXT_OF_KIN' })
    expect(result.success).toBe(false)
    const withKin = CreateAdmissionSchema.safeParse({ ...validAdmission, consentBy: 'NEXT_OF_KIN', consentKinAssignmentId: 'k1' })
    expect(withKin.success).toBe(true)
  })

  it('requires who referred the patient for a REFERRAL', () => {
    expect(CreateAdmissionSchema.safeParse({ ...validAdmission, source: 'REFERRAL' }).success).toBe(false)
    expect(CreateAdmissionSchema.safeParse({ ...validAdmission, source: 'REFERRAL', referralFrom: 'Chilenje Clinic' }).success).toBe(true)
  })

  it('rejects a missing complaint or a bad priority', () => {
    expect(CreateAdmissionSchema.safeParse({ ...validAdmission, presentingComplaint: '' }).success).toBe(false)
    expect(CreateAdmissionSchema.safeParse({ ...validAdmission, priority: 'WHENEVER' }).success).toBe(false)
  })

  it('PATCH refuses status and discharge fields', () => {
    expect(UpdateAdmissionSchema.safeParse({ status: 'DISCHARGED' }).success).toBe(false)
    expect(UpdateAdmissionSchema.safeParse({ dischargedAt: '2026-10-10' }).success).toBe(false)
    expect(UpdateAdmissionSchema.safeParse({ finalDiagnosis: 'x' }).success).toBe(false)
  })

  it('PATCH accepts a normal change but not an empty one', () => {
    expect(UpdateAdmissionSchema.safeParse({ priority: 'EMERGENCY' }).success).toBe(true)
    expect(UpdateAdmissionSchema.safeParse({}).success).toBe(false)
  })

  it('vitals need at least one measurement and sensible numbers', () => {
    expect(CreateVitalsReadingSchema.safeParse({}).success).toBe(false)
    expect(CreateVitalsReadingSchema.safeParse({ pulse: 80 }).success).toBe(true)
    expect(CreateVitalsReadingSchema.safeParse({ temperature: 80 }).success).toBe(false)
    expect(CreateVitalsReadingSchema.safeParse({ systolic: 80, diastolic: 120 }).success).toBe(false)
    expect(CreateVitalsReadingSchema.safeParse({ systolic: 120, diastolic: 80, spo2: 97 }).success).toBe(true)
  })

  it('discharge turns date text into dates and needs a disposition', () => {
    const result = DischargeAdmissionSchema.safeParse({ disposition: 'HOME', dischargedAt: '2026-10-15T10:00:00.000Z' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.dischargedAt).toBeInstanceOf(Date)
    expect(DischargeAdmissionSchema.safeParse({}).success).toBe(false)
  })

  it('cancel needs a reason', () => {
    expect(CancelAdmissionSchema.safeParse({ reason: '' }).success).toBe(false)
    expect(CancelAdmissionSchema.safeParse({ reason: 'Admitted by mistake' }).success).toBe(true)
  })
})

// ── timeline integration ─────────────────────────────────────────────────────

describe('timeline with admissions', () => {
  const empty = { records: [], visits: [], prescriptions: [], labOrders: [], appointments: [] }

  it('still works when no admissions are passed (older callers)', () => {
    expect(buildTimeline(empty)).toEqual([])
  })

  it('shows an admitted event and a discharged event for a finished stay', () => {
    const events = buildTimeline({
      ...empty,
      admissions: [{
        id: 'a1', admissionNumber: 'ADM-2026-000001', status: 'DISCHARGED', reason: 'Severe malaria',
        admittedAt: '2026-10-01T08:00:00.000Z', dischargedAt: '2026-10-05T08:00:00.000Z',
        dischargeDisposition: 'HOME', cancelledAt: null,
      }],
    })
    expect(events).toHaveLength(2)
    // newest first
    expect(events[0]).toMatchObject({ kind: 'ADMISSION', status: 'DISCHARGED', detail: 'Went home', section: 'admissions' })
    expect(events[1]).toMatchObject({ kind: 'ADMISSION', status: 'ADMITTED', detail: 'Severe malaria' })
  })

  it('shows only an admitted event while the patient is still in', () => {
    const events = buildTimeline({
      ...empty,
      admissions: [{
        id: 'a1', admissionNumber: 'ADM-2026-000001', status: 'ADMITTED', reason: 'Observation',
        admittedAt: '2026-10-01T08:00:00.000Z', dischargedAt: null, dischargeDisposition: null, cancelledAt: null,
      }],
    })
    expect(events.map((event) => event.status)).toEqual(['ADMITTED'])
  })

  it('shows a cancelled admission as ONE cancelled event', () => {
    const events = buildTimeline({
      ...empty,
      admissions: [{
        id: 'a1', admissionNumber: 'ADM-2026-000001', status: 'CANCELLED', reason: 'Entered by mistake',
        admittedAt: '2026-10-01T08:00:00.000Z', dischargedAt: null, dischargeDisposition: null,
        cancelledAt: '2026-10-01T09:00:00.000Z',
      }],
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'ADMISSION', status: 'CANCELLED', date: '2026-10-01T09:00:00.000Z' })
    // the reason for admission is clinical detail and is not repeated on a cancelled event
    expect(events[0].detail).toBeNull()
  })

  it('puts admission events in date order with other events', () => {
    const events = buildTimeline({
      ...empty,
      visits: [{ id: 'v1', reason: 'Check-up', visitDate: '2026-10-03T08:00:00.000Z', status: 'CHECKED_OUT' }],
      admissions: [{
        id: 'a1', admissionNumber: 'ADM-2026-000001', status: 'ADMITTED', reason: 'Observation',
        admittedAt: '2026-10-05T08:00:00.000Z', dischargedAt: null, dischargeDisposition: null, cancelledAt: null,
      }],
    })
    expect(events.map((event) => event.kind)).toEqual(['ADMISSION', 'VISIT'])
  })
})

// ── care team ────────────────────────────────────────────────────────────────

describe('care team includes admission doctors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    db.medicalRecord.findMany.mockResolvedValue([])
    db.prescription.findMany.mockResolvedValue([])
    db.labOrder.findMany.mockResolvedValue([])
  })

  it('includes both the admitting and the attending doctor, once each', async () => {
    db.admission.findMany.mockResolvedValue([
      { admittingDoctorId: 'd1', attendingDoctorId: 'd2' },
      { admittingDoctorId: 'd2', attendingDoctorId: 'd2' },
    ])
    const careTeam = await getCareTeamDoctorIds('p1')
    expect(careTeam.sort()).toEqual(['d1', 'd2'])
  })

  it('still works for a patient with no admissions', async () => {
    db.admission.findMany.mockResolvedValue([])
    db.medicalRecord.findMany.mockResolvedValue([{ doctorId: 'd9' }])
    expect(await getCareTeamDoctorIds('p1')).toEqual(['d9'])
  })
})
