// src/lib/admission-access.ts
// Database-backed helpers shared by the admissions API routes:
//   - who is a patient's consenting next of kin
//   - sending the "admitted" / "discharged" / "cancelled" notifications

import { prisma } from './prisma'
import { notifyUser } from './notifications'

// A next of kin may see an admission's status only while the assignment is BOTH active AND
// has emergency consent given. This is the one place that rule is written down.
const ACTIVE_CONSENTING_ASSIGNMENT = { isActive: true, emergencyConsentGiven: true } as const

// Ids of every patient this next-of-kin user may currently see.
export async function getPatientIdsForKin(kinUserId: string): Promise<string[]> {
  const assignments = await prisma.nextOfKinAssignment.findMany({
    where: { kinUserId, ...ACTIVE_CONSENTING_ASSIGNMENT },
    select: { patientId: true },
  })
  return assignments.map((assignment: { patientId: string }) => assignment.patientId)
}

// True when this next-of-kin user may currently see this patient's admissions.
export async function kinMaySeePatient(kinUserId: string, patientId: string): Promise<boolean> {
  const assignment = await prisma.nextOfKinAssignment.findFirst({
    where: { kinUserId, patientId, ...ACTIVE_CONSENTING_ASSIGNMENT },
    select: { id: true },
  })
  return assignment !== null
}

// What an admission notification says
export interface AdmissionNotice {
  type: 'ADMISSION_ADMITTED' | 'ADMISSION_DISCHARGED' | 'ADMISSION_CANCELLED'
  title: string
  body: string
}

// Tells the patient (unless told not to) and every consenting next of kin.
// notifyUser never throws, so a failed notification can never undo an admission or discharge.
export async function notifyPatientAndKin(
  patientId: string,
  notice: AdmissionNotice,
  options: { includePatient: boolean } = { includePatient: true }
): Promise<void> {
  if (options.includePatient) {
    await notifyUser(patientId, {
      type: notice.type,
      title: notice.title,
      body: notice.body,
      link: '/dashboard/patient#admissions',
    })
  }

  const kinAssignments = await prisma.nextOfKinAssignment.findMany({
    where: { patientId, ...ACTIVE_CONSENTING_ASSIGNMENT },
    select: { kinUserId: true },
  })
  for (const assignment of kinAssignments as { kinUserId: string }[]) {
    await notifyUser(assignment.kinUserId, {
      type: notice.type,
      title: notice.title,
      body: notice.body,
      link: '/dashboard/next-of-kin',
    })
  }
}
