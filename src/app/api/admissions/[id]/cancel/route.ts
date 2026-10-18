// src/app/api/admissions/[id]/cancel/route.ts
// POST /api/admissions/:id/cancel — cancel an admission that was made by mistake.
// A cancelled admission is never deleted. It stays in the history, marked as cancelled, with its reason.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { CancelAdmissionSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { canTransition } from '@/src/lib/admissions'
import { ADMISSION_DETAIL_INCLUDE, toClinicalView } from '@/src/lib/admission-views'
import { notifyPatientAndKin } from '@/src/lib/admission-access'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const validation = CancelAdmissionSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'A reason is required', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const admission = await prisma.admission.findUnique({ where: { id: params.id } })
  if (!admission) {
    return NextResponse.json({ success: false, error: 'Admission not found' }, { status: 404 })
  }
  if (!canTransition(admission.status, 'CANCELLED')) {
    return NextResponse.json(
      { success: false, error: `This admission is already ${admission.status.toLowerCase()}` },
      { status: 409 }
    )
  }

  // Same safety net as discharge: only a still-ADMITTED row can be changed
  const result = await prisma.admission.updateMany({
    where: { id: params.id, status: 'ADMITTED' },
    data: {
      status: 'CANCELLED',
      cancelReason: validation.data.reason,
      cancelledAt: new Date(),
      cancelledById: actorId,
    },
  })
  if (result.count !== 1) {
    return NextResponse.json({ success: false, error: 'This admission is no longer current' }, { status: 409 })
  }

  const cancelled = await prisma.admission.findUnique({
    where: { id: params.id },
    include: ADMISSION_DETAIL_INCLUDE,
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: admission.patientId,
    action: 'EDIT',
    resourceType: 'ADMISSION',
    resourceId: admission.id,
    details: { event: 'CANCEL' },
    ...getRequestMeta(request),
  })

  await notifyPatientAndKin(admission.patientId, {
    type: 'ADMISSION_CANCELLED',
    title: 'Admission cancelled',
    body: `Admission ${admission.admissionNumber} was cancelled.`,
  })

  return NextResponse.json({ success: true, data: toClinicalView(cancelled) })
}
