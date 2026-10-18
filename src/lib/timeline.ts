// src/lib/timeline.ts
// Builds the patient's care timeline: medical records, visits, prescriptions,
// released lab results and appointment requests merged into ONE list,
// newest first.
//
// This is a pure function (no database calls). The API route fetches the data
// and hands it in, which keeps this file easy to test.

import { parsePrescribedItems } from './pharmacy'

export type TimelineKind = 'RECORD' | 'VISIT' | 'PRESCRIPTION' | 'LAB' | 'APPOINTMENT' | 'ADMISSION'

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  // ISO date-time string, so it travels through JSON unchanged
  date: string
  title: string
  detail: string | null
  // A short status label to show as a badge (e.g. "DISPENSED"), or null
  status: string | null
  // Which patient dashboard section has the full details, or null if none
  section: 'records' | 'visits' | 'labs' | 'appointments' | 'admissions' | null
}

type DateLike = Date | string

// The smallest shape of each thing we need. The real database rows have more fields.
export interface TimelineInput {
  records: { id: string; diagnosis: string; visitDate: DateLike; doctor?: { fullName: string } | null }[]
  visits: { id: string; reason: string; visitDate: DateLike; status: string }[]
  prescriptions: { id: string; createdAt: DateLike; status: string; medications: string }[]
  labOrders: {
    id: string
    status: string
    reviewedAt: DateLike | null
    doctorComment: string | null
    items: { test: { name: string } }[]
  }[]
  appointments: {
    id: string
    status: string
    reason: string
    preferredDate: DateLike
    scheduledFor: DateLike | null
    visitId: string | null
  }[]
  // Optional so older callers (and older tests) keep working without admissions
  admissions?: {
    id: string
    admissionNumber: string
    status: string
    reason: string
    admittedAt: DateLike
    dischargedAt: DateLike | null
    dischargeDisposition: string | null
    cancelledAt: DateLike | null
  }[]
}

// Plain-English text for each way a stay can end
const DISCHARGE_DISPOSITION_LABELS: Record<string, string> = {
  HOME: 'Went home',
  TRANSFERRED_OUT: 'Transferred to another facility',
  LEFT_AGAINST_ADVICE: 'Left against medical advice',
  DECEASED: 'Deceased',
}

// Turns a Date or a date string into an ISO string
function toIso(value: DateLike): string {
  return (value instanceof Date ? value : new Date(value)).toISOString()
}

export function buildTimeline(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // Medical records
  for (const record of input.records) {
    events.push({
      id: `record-${record.id}`,
      kind: 'RECORD',
      date: toIso(record.visitDate),
      title: record.diagnosis,
      detail: record.doctor?.fullName ? `Recorded by ${record.doctor.fullName}` : null,
      status: null,
      section: 'records',
    })
  }

  // Visits
  for (const visit of input.visits) {
    events.push({
      id: `visit-${visit.id}`,
      kind: 'VISIT',
      date: toIso(visit.visitDate),
      title: `Clinic visit: ${visit.reason}`,
      detail: null,
      status: visit.status,
      section: 'visits',
    })
  }

  // Prescriptions: list the drug names so the patient can see what was prescribed
  for (const prescription of input.prescriptions) {
    const drugNames = parsePrescribedItems(prescription.medications).map((item) => item.name)
    events.push({
      id: `prescription-${prescription.id}`,
      kind: 'PRESCRIPTION',
      date: toIso(prescription.createdAt),
      title: 'Prescription issued',
      detail: drugNames.length > 0 ? drugNames.join(', ') : null,
      status: prescription.status,
      section: null,
    })
  }

  // Lab orders: ONLY results the doctor has reviewed. Until then the patient
  // must not see them (this mirrors the rule in /api/lab/orders).
  for (const order of input.labOrders) {
    if (order.status !== 'COMPLETED' || !order.reviewedAt) continue
    const testNames = order.items.map((item) => item.test.name)
    events.push({
      id: `lab-${order.id}`,
      kind: 'LAB',
      date: toIso(order.reviewedAt),
      title: 'Lab results released',
      detail: testNames.length > 0 ? testNames.join(', ') : null,
      status: null,
      section: 'labs',
    })
  }

  // Appointment requests. A CONFIRMED one has already become a Visit (which is
  // listed above), so showing it again would be a duplicate.
  const visitIds = new Set(input.visits.map((visit) => visit.id))
  for (const appointment of input.appointments) {
    if (appointment.status === 'CONFIRMED' && appointment.visitId && visitIds.has(appointment.visitId)) continue
    events.push({
      id: `appointment-${appointment.id}`,
      kind: 'APPOINTMENT',
      date: toIso(appointment.scheduledFor ?? appointment.preferredDate),
      title: `Appointment request: ${appointment.reason}`,
      detail: null,
      status: appointment.status,
      section: 'appointments',
    })
  }

  // Admissions. A normal stay gives an "admitted" event, plus a "discharged" event once it ends.
  // A cancelled admission never really happened, so it gives ONE "cancelled" event and no "admitted" event.
  for (const admission of input.admissions ?? []) {
    if (admission.status === 'CANCELLED') {
      events.push({
        id: `admission-cancelled-${admission.id}`,
        kind: 'ADMISSION',
        date: toIso(admission.cancelledAt ?? admission.admittedAt),
        title: `Admission cancelled (${admission.admissionNumber})`,
        detail: null,
        status: 'CANCELLED',
        section: 'admissions',
      })
      continue
    }

    events.push({
      id: `admission-admitted-${admission.id}`,
      kind: 'ADMISSION',
      date: toIso(admission.admittedAt),
      title: `Admitted (${admission.admissionNumber})`,
      detail: admission.reason,
      status: 'ADMITTED',
      section: 'admissions',
    })

    if (admission.status === 'DISCHARGED' && admission.dischargedAt) {
      const outcome = admission.dischargeDisposition
        ? DISCHARGE_DISPOSITION_LABELS[admission.dischargeDisposition] ?? null
        : null
      events.push({
        id: `admission-discharged-${admission.id}`,
        kind: 'ADMISSION',
        date: toIso(admission.dischargedAt),
        title: `Discharged (${admission.admissionNumber})`,
        detail: outcome,
        status: 'DISCHARGED',
        section: 'admissions',
      })
    }
  }

  // Newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return events
}
