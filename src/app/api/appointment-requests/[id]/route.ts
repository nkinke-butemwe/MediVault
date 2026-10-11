// src/app/api/appointment-requests/[id]/route.ts
// PATCH /api/appointment-requests/:id — answer or withdraw a request
//   { action: 'confirm', scheduledFor, responseNote? }   receptionist agrees; a Visit is created
//   { action: 'decline', responseNote }                  receptionist says no, with a reason
//   { action: 'cancel' }                                 the patient withdraws their own request

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { AppointmentActionSchema } from '@/src/lib/validators'
import { checkAppointmentDate, parseRequestedDate } from '@/src/lib/appointments'
import { notifyUser } from '@/src/lib/notifications'
import { formatDate } from '@/src/lib/format'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

const REQUEST_INCLUDE = {
  patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
  handledBy: { select: { id: true, fullName: true } },
} as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { role, actorId } = await getRoleAndActor(request)

  const validation = AppointmentActionSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid action' },
      { status: 400 }
    )
  }
  const body = validation.data

  const existing = await prisma.appointmentRequest.findUnique({ where: { id: params.id } })
  if (!existing) {
    return NextResponse.json({ success: false, error: 'Appointment request not found' }, { status: 404 })
  }

  // ── Patient withdraws their own request ──────────────────────────────────
  if (body.action === 'cancel') {
    if (role !== 'PATIENT' || existing.patientId !== actorId) {
      return NextResponse.json({ success: false, error: 'You can only cancel your own requests' }, { status: 403 })
    }

    // Guarded update: only a request that is still open or confirmed can be cancelled
    const result = await prisma.appointmentRequest.updateMany({
      where: { id: params.id, status: { in: ['REQUESTED', 'CONFIRMED'] } },
      data: { status: 'CANCELLED' },
    })
    if (result.count !== 1) {
      return NextResponse.json(
        { success: false, error: `This request can't be cancelled (it is ${existing.status.toLowerCase()})` },
        { status: 409 }
      )
    }

    // If it had been confirmed, free the clinic's slot: cancel the visit too, but
    // only if the patient has not already arrived.
    if (existing.visitId) {
      await prisma.visit.updateMany({
        where: { id: existing.visitId, status: 'WAITING' },
        data: { status: 'CANCELLED' },
      })
    }

    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: existing.patientId,
      action: 'EDIT',
      resourceType: 'APPOINTMENT_REQUEST',
      resourceId: existing.id,
      details: { action: 'cancel' },
      ...getRequestMeta(request),
    })

    const cancelled = await prisma.appointmentRequest.findUnique({ where: { id: params.id }, include: REQUEST_INCLUDE })
    return NextResponse.json({ success: true, data: cancelled })
  }

  // ── Everything below is the front desk answering the request ──────────────
  if (!['RECEPTIONIST', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only reception staff can answer appointment requests' }, { status: 403 })
  }

  if (body.action === 'decline') {
    const result = await prisma.appointmentRequest.updateMany({
      where: { id: params.id, status: 'REQUESTED' },
      data: { status: 'DECLINED', handledById: actorId, handledAt: new Date(), responseNote: body.responseNote },
    })
    if (result.count !== 1) {
      return NextResponse.json(
        { success: false, error: `This request was already answered (it is ${existing.status.toLowerCase()})` },
        { status: 409 }
      )
    }

    await notifyUser(existing.patientId, {
      type: 'APPOINTMENT_DECLINED',
      title: 'Appointment request declined',
      body: body.responseNote,
      link: '/dashboard/patient#appointments',
    })
  } else {
    // action === 'confirm'
    const scheduledFor = parseRequestedDate(body.scheduledFor)
    const dateProblem = checkAppointmentDate(scheduledFor)
    if (dateProblem) {
      return NextResponse.json({ success: false, error: dateProblem }, { status: 400 })
    }

    // Claim the request and create the Visit together, so we never end up with
    // a confirmed request that has no visit (or the other way round).
    const claimed = await prisma.$transaction(async (tx) => {
      const result = await tx.appointmentRequest.updateMany({
        where: { id: params.id, status: 'REQUESTED' },
        data: {
          status: 'CONFIRMED',
          handledById: actorId,
          handledAt: new Date(),
          scheduledFor,
          responseNote: body.responseNote || null,
        },
      })
      if (result.count !== 1) return false

      const visit = await tx.visit.create({
        data: {
          patientId: existing.patientId,
          reason: existing.reason,
          visitDate: scheduledFor,
          status: 'WAITING',
          createdById: actorId,
        },
      })
      await tx.appointmentRequest.update({ where: { id: params.id }, data: { visitId: visit.id } })
      return true
    })

    if (!claimed) {
      return NextResponse.json(
        { success: false, error: `This request was already answered (it is ${existing.status.toLowerCase()})` },
        { status: 409 }
      )
    }

    await notifyUser(existing.patientId, {
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment confirmed',
      body: `Your visit is booked for ${formatDate(scheduledFor)}.${body.responseNote ? ' ' + body.responseNote : ''}`,
      link: '/dashboard/patient#appointments',
    })
  }

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: existing.patientId,
    action: 'EDIT',
    resourceType: 'APPOINTMENT_REQUEST',
    resourceId: existing.id,
    details: { action: body.action },
    ...getRequestMeta(request),
  })

  const updated = await prisma.appointmentRequest.findUnique({ where: { id: params.id }, include: REQUEST_INCLUDE })
  return NextResponse.json({ success: true, data: updated })
}
