// src/app/api/admissions/[id]/vitals/route.ts
// POST /api/admissions/:id/vitals — record one set of observations for a current admission.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { CreateVitalsReadingSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const validation = CreateVitalsReadingSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid vitals', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const admission = await prisma.admission.findUnique({
    where: { id: params.id },
    select: { id: true, patientId: true, status: true },
  })
  if (!admission) {
    return NextResponse.json({ success: false, error: 'Admission not found' }, { status: 404 })
  }
  if (admission.status !== 'ADMITTED') {
    return NextResponse.json(
      { success: false, error: 'Vitals can only be recorded while the patient is admitted' },
      { status: 409 }
    )
  }

  const reading = await prisma.vitalsReading.create({
    data: { admissionId: admission.id, recordedById: actorId, ...validation.data },
    include: { recordedBy: { select: { id: true, fullName: true } } },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: admission.patientId,
    action: 'CREATE',
    resourceType: 'VITALS_READING',
    resourceId: reading.id,
    details: { admissionId: admission.id },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: reading }, { status: 201 })
}
