// src/app/api/visits/[id]/route.ts
// PUT /api/visits/:id — update visit status and notes

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { UpdateVisitSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

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

  const visit = await prisma.visit.update({
    where: { id: params.id },
    data: {
      status: validation.data.status,
      vitals: validation.data.vitals,
      doctorNotes: validation.data.doctorNotes,
      reason: validation.data.reason,
    },
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
    details: { newStatus: validation.data.status },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: visit })
}
