// src/app/api/appointment-requests/route.ts
// GET  /api/appointment-requests?status= — list requests
//        patient: their own  |  receptionist / doctor / admin: everyone's (default: still-open ones)
// POST /api/appointment-requests — a patient asks for an appointment

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { CreateAppointmentRequestSchema } from '@/src/lib/validators'
import { checkAppointmentDate, parseRequestedDate } from '@/src/lib/appointments'
import { notifyRole } from '@/src/lib/notifications'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

const VALID_STATUSES = ['REQUESTED', 'CONFIRMED', 'DECLINED', 'CANCELLED']

// The fields every response includes, so the screens always get the same shape
const REQUEST_INCLUDE = {
  patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
  handledBy: { select: { id: true, fullName: true } },
} as const

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)
  const { searchParams } = new URL(request.url)
  const statusParam = searchParams.get('status')

  // Optional ?status=REQUESTED,CONFIRMED filter (unknown words are ignored)
  const where: Record<string, unknown> = {}
  if (statusParam) {
    const statuses = statusParam.split(',').filter((s) => VALID_STATUSES.includes(s))
    if (statuses.length > 0) where.status = { in: statuses }
  }

  if (role === 'PATIENT') {
    // A patient only ever sees their own requests
    where.patientId = actorId
  } else if (['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) {
    // Staff see everyone's. With no filter given, show only the ones still waiting for an answer.
    if (!where.status) where.status = 'REQUESTED'
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const requests = await prisma.appointmentRequest.findMany({
    where,
    include: REQUEST_INCLUDE,
    // Oldest open request first for staff (fair queue); newest first for a patient's own list
    orderBy: role === 'PATIENT' ? { createdAt: 'desc' } : { preferredDate: 'asc' },
    take: 200,
  })

  return NextResponse.json({ success: true, data: requests })
}

export async function POST(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)

  if (role !== 'PATIENT') {
    return NextResponse.json({ success: false, error: 'Only patients can request appointments' }, { status: 403 })
  }

  const validation = CreateAppointmentRequestSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid request', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const preferredDate = parseRequestedDate(validation.data.preferredDate)
  const dateProblem = checkAppointmentDate(preferredDate)
  if (dateProblem) {
    return NextResponse.json({ success: false, error: dateProblem }, { status: 400 })
  }

  // Stop a patient flooding the queue: only a few open requests at a time
  const openCount = await prisma.appointmentRequest.count({
    where: { patientId: actorId, status: 'REQUESTED' },
  })
  if (openCount >= 3) {
    return NextResponse.json(
      { success: false, error: 'You already have 3 requests waiting. Please wait for a reply or cancel one.' },
      { status: 409 }
    )
  }

  const created = await prisma.appointmentRequest.create({
    data: { patientId: actorId, preferredDate, reason: validation.data.reason },
    include: REQUEST_INCLUDE,
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: actorId,
    action: 'CREATE',
    resourceType: 'APPOINTMENT_REQUEST',
    resourceId: created.id,
    ...getRequestMeta(request),
  })

  // Tell the front desk there is a new request to answer
  await notifyRole('RECEPTIONIST', {
    type: 'APPOINTMENT_REQUESTED',
    title: 'New appointment request',
    body: `${created.patient.fullName}: ${created.reason}`,
    link: '/dashboard/receptionist#requests',
  })

  return NextResponse.json({ success: true, data: created }, { status: 201 })
}
