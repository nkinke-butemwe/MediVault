// src/lib/care-team.ts
// Works out which doctors "belong" to a patient's care, so secure messaging
// stays private: a patient can only message a doctor who has actually treated
// them, and a doctor can only message their own patients.
//
// A doctor is on a patient's care team if they have ever written that
// patient's medical record, issued them a prescription, or ordered them a lab test.

import { prisma } from './prisma'

// Returns the ids of every doctor on this patient's care team (no duplicates).
export async function getCareTeamDoctorIds(patientId: string): Promise<string[]> {
  const [records, prescriptions, labOrders, admissions] = await Promise.all([
    prisma.medicalRecord.findMany({ where: { patientId }, select: { doctorId: true }, distinct: ['doctorId'] }),
    prisma.prescription.findMany({ where: { patientId }, select: { doctorId: true }, distinct: ['doctorId'] }),
    prisma.labOrder.findMany({ where: { patientId }, select: { orderedById: true }, distinct: ['orderedById'] }),
    // Both the doctor who admitted the patient and the doctor in charge of the stay
    prisma.admission.findMany({ where: { patientId }, select: { admittingDoctorId: true, attendingDoctorId: true } }),
  ])

  const doctorIds = new Set<string>()
  records.forEach((r) => doctorIds.add(r.doctorId))
  prescriptions.forEach((p) => doctorIds.add(p.doctorId))
  labOrders.forEach((l) => doctorIds.add(l.orderedById))
  admissions.forEach((a) => {
    doctorIds.add(a.admittingDoctorId)
    doctorIds.add(a.attendingDoctorId)
  })
  return Array.from(doctorIds)
}

// True when this doctor is on this patient's care team.
export async function isInCareTeam(patientId: string, doctorId: string): Promise<boolean> {
  const careTeam = await getCareTeamDoctorIds(patientId)
  return careTeam.includes(doctorId)
}
