// src/app/api/admissions/[id]/route.ts
// GET   /api/admissions/:id — one admission (what you see depends on your role)
// PATCH /api/admissions/:id — update the non-discharge fields while the patient is still admitted

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { UpdateAdmissionSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { ADMISSION_DETAIL_INCLUDE, viewForRole } from '@/src/lib/admission-views'
import { kinMaySeePatient } from '@/src/lib/admission-access'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  const allowedRoles = ['DOCTOR', 'ADMIN', 'RECEPTIONIST', 'PATIENT', 'NEXT_OF_KIN']
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const admission = await prisma.admission.findUnique({
    where: { id: params.id },
    include: ADMISSION_DETAIL_INCLUDE,
  })
  if (!admission) {
    return NextResponse.json({ success: false, error: 'Admission not found' }, { status: 404 })
  }

  // A patient may only open their OWN admissions
  if (role === 'PATIENT' && admission.patientId !== actorId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Next of kin: only for a patient they are assigned to, with consent given
  if (role === 'NEXT_OF_KIN') {
    const allowed = await kinMaySeePatient(actorId, admission.patientId)
    if (!allowed) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  // Everyone except the patient looking at their own record is written to the access log
  if (role !== 'PATIENT') {
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: admission.patientId,
      action: 'VIEW',
      resourceType: 'ADMISSION',
      resourceId: admission.id,
      details: { admissionNumber: admission.admissionNumber, viewedAs: role },
      ...getRequestMeta(request),
    })
  }

  // The view function removes every field this role is not allowed to see
  return NextResponse.json({ success: true, data: viewForRole(role, admission) })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const validation = UpdateAdmissionSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid update', details: validation.error.flatten() },
      { status: 400 }
    )
  }
  const changes = validation.data

  const admission = await prisma.admission.findUnique({ where: { id: params.id } })
  if (!admission) {
    return NextResponse.json({ success: false, error: 'Admission not found' }, { status: 404 })
  }
  if (admission.status !== 'ADMITTED') {
    return NextResponse.json(
      { success: false, error: 'Only a current admission can be edited' },
      { status: 409 }
    )
  }

  // A new expected discharge date still may not be before the admission date
  if (changes.expectedDischargeAt && changes.expectedDischargeAt.getTime() < admission.admittedAt.getTime()) {
    return NextResponse.json(
      { success: false, error: 'The expected discharge date cannot be before the admission date.' },
      { status: 400 }
    )
  }

  // A new attending doctor must be a real, active doctor
  if (changes.attendingDoctorId) {
    const newDoctor = await prisma.user.findFirst({
      where: { id: changes.attendingDoctorId, role: 'DOCTOR', isActive: true },
      select: { id: true },
    })
    if (!newDoctor) {
      return NextResponse.json({ success: false, error: 'Attending doctor not found' }, { status: 400 })
    }
  }

  // The "status: ADMITTED" in the where clause means: if someone discharged the patient a moment ago,
  // update nothing (count 0) and answer 409 instead of editing a closed admission.
  const result = await prisma.admission.updateMany({
    where: { id: params.id, status: 'ADMITTED' },
    data: changes,
  })
  if (result.count !== 1) {
    return NextResponse.json({ success: false, error: 'This admission is no longer current' }, { status: 409 })
  }

  const updated = await prisma.admission.findUnique({
    where: { id: params.id },
    include: ADMISSION_DETAIL_INCLUDE,
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: admission.patientId,
    action: 'EDIT',
    resourceType: 'ADMISSION',
    resourceId: admission.id,
    // Only the NAMES of the changed fields are logged, not the clinical text itself
    details: { event: 'UPDATE', fields: Object.keys(changes) },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: viewForRole(role, updated) })
}
