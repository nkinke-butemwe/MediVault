// src/app/api/timeline/route.ts
// GET /api/timeline?patientId= — one chronological list of everything in a patient's care:
// medical records, visits, prescriptions, released lab results and appointment requests.
//   patient: always their own timeline
//   doctor / admin: any patient (the view is written to the access log)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { buildTimeline } from '@/src/lib/timeline'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)
  const { searchParams } = new URL(request.url)

  let patientId: string
  if (role === 'PATIENT') {
    // Ignore any ?patientId= a patient sends: they only ever get their own
    patientId = actorId
  } else if (role === 'DOCTOR' || role === 'ADMIN') {
    const requested = searchParams.get('patientId')
    if (!requested) {
      return NextResponse.json({ success: false, error: 'patientId is required' }, { status: 400 })
    }
    patientId = requested
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const [records, visits, prescriptions, labOrders, appointments] = await Promise.all([
    prisma.medicalRecord.findMany({
      where: { patientId },
      include: { doctor: { select: { fullName: true } } },
      orderBy: { visitDate: 'desc' },
      take: 100,
    }),
    prisma.visit.findMany({ where: { patientId }, orderBy: { visitDate: 'desc' }, take: 100 }),
    prisma.prescription.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    // Only results the doctor has released (same rule as /api/lab/orders for patients)
    prisma.labOrder.findMany({
      where: { patientId, status: 'COMPLETED', reviewedAt: { not: null } },
      include: { items: { include: { test: { select: { name: true } } } } },
      orderBy: { reviewedAt: 'desc' },
      take: 100,
    }),
    prisma.appointmentRequest.findMany({ where: { patientId }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ])

  if (role !== 'PATIENT') {
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: patientId,
      action: 'VIEW',
      resourceType: 'TIMELINE',
      ...getRequestMeta(request),
    })
  }

  const events = buildTimeline({ records, visits, prescriptions, labOrders, appointments })
  return NextResponse.json({ success: true, data: events })
}
