// src/app/api/visits/[id]/route.ts
// PUT /api/visits/:id — update visit status and notes
//
// Who may change what:
//   DOCTOR        status, vitals, reason and doctorNotes
//   ADMIN         status, vitals and reason (but NOT doctorNotes — clinical notes are the doctor's)
//   RECEPTIONIST  status and vitals only (check-in, check-out, cancel)
//
// Status changes must follow the rules in src/lib/visits.ts.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { UpdateVisitSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { getRoleAndActor } from '@/src/lib/auth'
import { canTransitionVisit } from '@/src/lib/visits'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const validation = UpdateVisitSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { status, vitals, doctorNotes, reason } = validation.data

  // Clinical notes can only be written by a doctor.
  // We check for "undefined" (not truthiness) so that even an attempt to
  // blank the notes with null or "" is refused for non-doctors.
  if (doctorNotes !== undefined && role !== 'DOCTOR') {
    return NextResponse.json(
      { success: false, error: 'Only doctors can write clinical notes' },
      { status: 403 }
    )
  }

  // Receptionists may only touch status and vitals, never the reason for the visit.
  if (reason !== undefined && role === 'RECEPTIONIST') {
    return NextResponse.json(
      { success: false, error: 'Receptionists can only update the visit status and vitals' },
      { status: 403 }
    )
  }

  // Load the visit first so we can (a) answer 404 if it does not exist and
  // (b) know its current status for the transition check below.
  const existingVisit = await prisma.visit.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  })
  if (!existingVisit) {
    return NextResponse.json({ success: false, error: 'Visit not found' }, { status: 404 })
  }

  // Refuse status changes the clinic workflow does not allow
  // (for example CHECKED_OUT -> WAITING, or reopening a CANCELLED visit).
  if (status !== undefined && !canTransitionVisit(existingVisit.status, status)) {
    return NextResponse.json(
      { success: false, error: `Cannot change a visit from ${existingVisit.status} to ${status}` },
      { status: 409 }
    )
  }

  try {
    const visit = await prisma.visit.update({
      where: { id: params.id },
      data: { status, vitals, doctorNotes, reason },
      include: {
        patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    })

    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: visit.patientId,
      action: 'EDIT',
      resourceType: 'VISIT',
      resourceId: visit.id,
      details: { newStatus: status },
      ...getRequestMeta(request),
    })

    return NextResponse.json({ success: true, data: visit })
  } catch (error) {
    // P2025 = "record to update not found". This only happens if the visit was
    // deleted between our lookup above and the update (a rare race), but we
    // still answer with a clean 404 instead of a 500.
    const errorCode = (error as { code?: string } | null)?.code
    if (errorCode === 'P2025') {
      return NextResponse.json({ success: false, error: 'Visit not found' }, { status: 404 })
    }
    throw error
  }
}
