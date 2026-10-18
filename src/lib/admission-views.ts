// src/lib/admission-views.ts
// Decides WHICH FIELDS of an admission each role is allowed to see.
//
// Pure functions (no database calls). The API routes load an admission, then pass it through
// one of these before sending it back, so the "who sees what" rules live in one place:
//
//   DOCTOR / ADMIN  -> full clinical view
//   RECEPTIONIST    -> census view   (who is in, when, status. NO diagnosis, notes, vitals)
//   PATIENT         -> own stay      (outcome, discharge summary and instructions. NO staff notes or vitals)
//   NEXT_OF_KIN     -> status view   (admitted / discharged and dates only)

import { lengthOfStayDays } from './admissions'

// The fields these functions read. A real Prisma Admission row has all of them.
// Extra fields on the row (such as the included notes) are allowed and handled by the clinical view.
export interface AdmissionRow {
  id: string
  admissionNumber: string
  patientId: string
  status: string
  priority: string
  source: string
  reason: string
  provisionalDiagnosis: string | null
  admittedAt: Date
  expectedDischargeAt: Date | null
  dischargedAt: Date | null
  dischargeDisposition: string | null
  finalDiagnosis: string | null
  dischargeSummary: string | null
  dischargeInstructions: string | null
  followUpDate: Date | null
  cancelReason: string | null
  cancelledAt: Date | null
  patient?: { id: string; fullName: string; studentNumber: string | null } | null
  attendingDoctor?: { id: string; fullName: string } | null
}

// How long the stay has lasted. A cancelled admission never really started, so it has no length.
function stayLength(admission: AdmissionRow, now: Date): number | null {
  if (admission.status === 'CANCELLED') {
    return null
  }
  return lengthOfStayDays(admission.admittedAt, admission.dischargedAt, now)
}

// Receptionist: just enough to run the front desk. Deliberately NO clinical text.
export function toCensusView(admission: AdmissionRow, now: Date = new Date()) {
  return {
    id: admission.id,
    admissionNumber: admission.admissionNumber,
    patient: admission.patient
      ? { id: admission.patient.id, fullName: admission.patient.fullName, studentNumber: admission.patient.studentNumber }
      : null,
    status: admission.status,
    admittedAt: admission.admittedAt,
    dischargedAt: admission.dischargedAt,
    lengthOfStayDays: stayLength(admission, now),
  }
}

// Patient: their own stay. Includes the discharge summary and instructions, but not staff-only
// material (notes, vitals, examination findings, cause of death).
export function toPatientView(admission: AdmissionRow, now: Date = new Date()) {
  return {
    id: admission.id,
    admissionNumber: admission.admissionNumber,
    status: admission.status,
    reason: admission.reason,
    admittedAt: admission.admittedAt,
    expectedDischargeAt: admission.expectedDischargeAt,
    dischargedAt: admission.dischargedAt,
    lengthOfStayDays: stayLength(admission, now),
    attendingDoctor: admission.attendingDoctor
      ? { id: admission.attendingDoctor.id, fullName: admission.attendingDoctor.fullName }
      : null,
    dischargeDisposition: admission.dischargeDisposition,
    finalDiagnosis: admission.finalDiagnosis,
    dischargeSummary: admission.dischargeSummary,
    dischargeInstructions: admission.dischargeInstructions,
    followUpDate: admission.followUpDate,
    cancelReason: admission.cancelReason,
  }
}

// Next of kin: status and dates only.
export function toKinView(admission: AdmissionRow, now: Date = new Date()) {
  return {
    id: admission.id,
    admissionNumber: admission.admissionNumber,
    patient: admission.patient ? { id: admission.patient.id, fullName: admission.patient.fullName } : null,
    status: admission.status,
    admittedAt: admission.admittedAt,
    dischargedAt: admission.dischargedAt,
    lengthOfStayDays: stayLength(admission, now),
  }
}

// Doctor / admin: everything on the row, plus the computed length of stay.
export function toClinicalView<T extends AdmissionRow>(admission: T, now: Date = new Date()) {
  return { ...admission, lengthOfStayDays: stayLength(admission, now) }
}

// Picks the right view for a role. Returns null for roles that may not see admissions at all.
export function viewForRole(role: string | null, admission: AdmissionRow, now: Date = new Date()) {
  if (role === 'DOCTOR' || role === 'ADMIN') return toClinicalView(admission, now)
  if (role === 'RECEPTIONIST') return toCensusView(admission, now)
  if (role === 'PATIENT') return toPatientView(admission, now)
  if (role === 'NEXT_OF_KIN') return toKinView(admission, now)
  return null
}

// The Prisma "include" used by the doctor/admin endpoints, so every response has the same shape.
// (It lives here, not in a route file, because Next.js route files may only export HTTP handlers.)
export const ADMISSION_LIST_INCLUDE = {
  patient: { select: { id: true, fullName: true, studentNumber: true } },
  attendingDoctor: { select: { id: true, fullName: true } },
  admittingDoctor: { select: { id: true, fullName: true } },
} as const

export const ADMISSION_DETAIL_INCLUDE = {
  ...ADMISSION_LIST_INCLUDE,
  dischargedBy: { select: { id: true, fullName: true } },
  cancelledBy: { select: { id: true, fullName: true } },
  // Notes are shown oldest first, like a chart
  notes: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, fullName: true } } },
  },
  vitals: {
    orderBy: { recordedAt: 'asc' as const },
    include: { recordedBy: { select: { id: true, fullName: true } } },
  },
  labOrders: {
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, status: true, priority: true, createdAt: true, reviewedAt: true },
  },
  prescriptions: {
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, status: true, medications: true, createdAt: true },
  },
} as const
