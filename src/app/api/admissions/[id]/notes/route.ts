// src/app/api/admissions/[id]/notes/route.ts
// POST /api/admissions/:id/notes — add a note to a current admission.
// Notes are append-only: there is deliberately no edit or delete endpoint.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { CreateAdmissionNoteSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const validation = CreateAdmissionNoteSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid note', details: validation.error.flatten() },
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

  // Notes belong to a stay in progress
  if (admission.status !== 'ADMITTED') {
    return NextResponse.json(
      { success: false, error: 'Notes can only be added while the patient is admitted' },
      { status: 409 }
    )
  }

  const note = await prisma.admissionNote.create({
    data: {
      admissionId: admission.id,
      authorId: actorId,
      kind: validation.data.kind,
      body: validation.data.body,
    },
    include: { author: { select: { id: true, fullName: true } } },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: admission.patientId,
    action: 'CREATE',
    resourceType: 'ADMISSION_NOTE',
    resourceId: note.id,
    details: { admissionId: admission.id, kind: note.kind },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: note }, { status: 201 })
}
