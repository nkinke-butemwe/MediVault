// src/app/api/admissions/route.ts
// GET  /api/admissions — list admissions (what you see depends on your role)
// POST /api/admissions — a doctor (or admin) admits a patient

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { CreateAdmissionSchema, ListAdmissionsQuerySchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import {
  isReadmission,
  isUniqueViolation,
  nextAdmissionNumber,
  validateAdmissionDates,
} from '@/src/lib/admissions'
import { ADMISSION_LIST_INCLUDE, viewForRole, toClinicalView } from '@/src/lib/admission-views'
import { getPatientIdsForKin, notifyPatientAndKin } from '@/src/lib/admission-access'

// ─── GET: list ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)

  // Not logged in
  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Pharmacists and lab technicians have no access to admissions at all
  const allowedRoles = ['DOCTOR', 'ADMIN', 'RECEPTIONIST', 'PATIENT', 'NEXT_OF_KIN']
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Read the filters from the query string
  const { searchParams } = new URL(request.url)
  const query = ListAdmissionsQuerySchema.safeParse(Object.fromEntries(searchParams.entries()))
  if (!query.success) {
    return NextResponse.json(
      { success: false, error: query.error.issues[0]?.message ?? 'Invalid filters', details: query.error.flatten() },
      { status: 400 }
    )
  }
  const filters = query.data

  // Build the database filter step by step
  const where: Record<string, unknown> = {}

  if (filters.status) where.status = filters.status
  if (filters.priority) where.priority = filters.priority
  if (filters.attendingDoctorId) where.attendingDoctorId = filters.attendingDoctorId

  // Date range on the admission date
  if (filters.from || filters.to) {
    const admittedAtRange: Record<string, Date> = {}
    if (filters.from) admittedAtRange.gte = filters.from
    if (filters.to) admittedAtRange.lte = filters.to
    where.admittedAt = admittedAtRange
  }

  // Search by patient name, student number or admission number
  if (filters.q) {
    where.OR = [
      { admissionNumber: { contains: filters.q, mode: 'insensitive' } },
      { patient: { fullName: { contains: filters.q, mode: 'insensitive' } } },
      { patient: { studentNumber: { contains: filters.q, mode: 'insensitive' } } },
    ]
  }

  // Limit by who is asking
  if (role === 'PATIENT') {
    // A patient only ever sees their own admissions
    where.patientId = actorId
  } else if (role === 'NEXT_OF_KIN') {
    // Next of kin: only patients with an active assignment that has consent given
    const visiblePatientIds = await getPatientIdsForKin(actorId)
    where.patientId = { in: visiblePatientIds }
  }

  const skip = (filters.page - 1) * filters.pageSize

  const [admissions, total] = await Promise.all([
    prisma.admission.findMany({
      where,
      include: ADMISSION_LIST_INCLUDE,
      orderBy: { admittedAt: 'desc' },
      skip,
      take: filters.pageSize,
    }),
    prisma.admission.count({ where }),
  ])

  // Clinical staff viewing the list see diagnoses, so the view is written to the access log
  if (role === 'DOCTOR' || role === 'ADMIN') {
    await logAccess({
      accessedByUserId: actorId,
      action: 'VIEW',
      resourceType: 'ADMISSION_LIST',
      details: { resultCount: admissions.length, status: filters.status ?? null, q: filters.q ?? null },
      ...getRequestMeta(request),
    })
  }

  // Cut each admission down to what this role may see
  const now = new Date()
  const items = admissions.map((admission: Parameters<typeof toClinicalView>[0]) => viewForRole(role, admission, now))

  return NextResponse.json({
    success: true,
    data: { items, total, page: filters.page, pageSize: filters.pageSize },
  })
}

// ─── POST: admit a patient ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Only doctors can admit patients' }, { status: 403 })
  }

  // Step 1: check the shape of the request body
  const validation = CreateAdmissionSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid admission', details: validation.error.flatten() },
      { status: 400 }
    )
  }
  const input = validation.data

  // Step 2: the patient must exist, have the PATIENT role and be active
  const patient = await prisma.user.findFirst({
    where: { id: input.patientId, role: 'PATIENT', isActive: true },
    select: { id: true, fullName: true },
  })
  if (!patient) {
    return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
  }

  // Step 3: decide the attending doctor.
  // A doctor who admits is the attending doctor unless they name someone else.
  // An admin must always name one (an admin is not a clinician).
  let attendingDoctorId = input.attendingDoctorId
  if (!attendingDoctorId) {
    if (role === 'DOCTOR') {
      attendingDoctorId = actorId
    } else {
      return NextResponse.json({ success: false, error: 'Choose an attending doctor' }, { status: 400 })
    }
  }
  // Whoever was chosen must be a real, active doctor
  const attendingDoctor = await prisma.user.findFirst({
    where: { id: attendingDoctorId, role: 'DOCTOR', isActive: true },
    select: { id: true },
  })
  if (!attendingDoctor) {
    return NextResponse.json({ success: false, error: 'Attending doctor not found' }, { status: 400 })
  }

  // Step 4: check the dates (not in the future, expected discharge not before admission)
  const now = new Date()
  const admittedAt = input.admittedAt ?? now
  const dateProblems = validateAdmissionDates({ admittedAt, expectedDischargeAt: input.expectedDischargeAt }, now)
  if (dateProblems.length > 0) {
    return NextResponse.json({ success: false, error: dateProblems[0], details: dateProblems }, { status: 400 })
  }

  // Step 5: if next of kin gave consent, that assignment must be active AND have consent on record
  if (input.consentBy === 'NEXT_OF_KIN') {
    const assignment = await prisma.nextOfKinAssignment.findFirst({
      where: {
        id: input.consentKinAssignmentId,
        patientId: input.patientId,
        isActive: true,
        emergencyConsentGiven: true,
      },
      select: { id: true },
    })
    if (!assignment) {
      return NextResponse.json(
        { success: false, error: 'Next of kin consent is not on record for this patient' },
        { status: 400 }
      )
    }
  }

  // Step 6: if the admission comes from a clinic visit, the visit must belong to this patient
  if (input.visitId) {
    const visit = await prisma.visit.findFirst({
      where: { id: input.visitId, patientId: input.patientId },
      select: { id: true },
    })
    if (!visit) {
      return NextResponse.json({ success: false, error: 'Visit not found for this patient' }, { status: 400 })
    }
  }

  // Step 7: friendly check for "already admitted". (The database index is the real guard; see step 9.)
  const alreadyAdmitted = await prisma.admission.findFirst({
    where: { patientId: input.patientId, status: 'ADMITTED' },
    select: { admissionNumber: true },
  })
  if (alreadyAdmitted) {
    return NextResponse.json(
      { success: false, error: `This patient is already admitted (${alreadyAdmitted.admissionNumber})` },
      { status: 409 }
    )
  }

  // Step 8: was the patient discharged recently? Used for the readmission flag.
  const previousStay = await prisma.admission.findFirst({
    where: { patientId: input.patientId, status: 'DISCHARGED' },
    orderBy: { dischargedAt: 'desc' },
    select: { dischargedAt: true },
  })
  const readmission = isReadmission(previousStay?.dischargedAt ?? null, admittedAt)

  // Step 9: create everything in ONE transaction, so a half-finished admission can never exist
  let admission
  try {
    admission = await prisma.$transaction(async (tx: typeof prisma) => {
      // The number comes from a per-year counter row inside this same transaction
      const admissionNumber = await nextAdmissionNumber(tx, admittedAt.getUTCFullYear())

      const created = await tx.admission.create({
        data: {
          admissionNumber,
          patientId: input.patientId,
          admittingDoctorId: actorId,
          attendingDoctorId: attendingDoctorId as string,
          visitId: input.visitId ?? null,
          priority: input.priority,
          source: input.source,
          referralFrom: input.referralFrom ?? null,
          presentingComplaint: input.presentingComplaint,
          reason: input.reason,
          provisionalDiagnosis: input.provisionalDiagnosis ?? null,
          admissionNotes: input.admissionNotes ?? null,
          examinationFindings: input.examinationFindings ?? null,
          knownAllergies: input.knownAllergies ?? null,
          existingConditions: input.existingConditions ?? null,
          currentMedication: input.currentMedication ?? null,
          admittedAt,
          expectedDischargeAt: input.expectedDischargeAt ?? null,
          consentBy: input.consentBy,
          consentKinAssignmentId: input.consentBy === 'NEXT_OF_KIN' ? input.consentKinAssignmentId : null,
        },
        include: ADMISSION_LIST_INCLUDE,
      })

      // The patient has now left the clinic queue, so close any open visit that led to the admission
      if (input.visitId) {
        await tx.visit.updateMany({
          where: { id: input.visitId, status: { in: ['WAITING', 'CHECKED_IN', 'IN_CONSULTATION'] } },
          data: { status: 'CHECKED_OUT' },
        })
      }

      return created
    })
  } catch (error) {
    // The partial unique index fired: another request admitted this patient a moment earlier
    if (isUniqueViolation(error)) {
      return NextResponse.json({ success: false, error: 'This patient is already admitted' }, { status: 409 })
    }
    throw error
  }

  // Step 10: log it and tell the patient and consenting next of kin
  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: input.patientId,
    action: 'CREATE',
    resourceType: 'ADMISSION',
    resourceId: admission.id,
    details: {
      admissionNumber: admission.admissionNumber,
      priority: input.priority,
      source: input.source,
      consentBy: input.consentBy,
      readmission,
    },
    ...getRequestMeta(request),
  })

  await notifyPatientAndKin(input.patientId, {
    type: 'ADMISSION_ADMITTED',
    title: 'Admitted to the clinic ward',
    body: `${patient.fullName} was admitted (${admission.admissionNumber}).`,
  })

  return NextResponse.json(
    { success: true, data: { ...toClinicalView(admission, now), isReadmission: readmission } },
    { status: 201 }
  )
}
