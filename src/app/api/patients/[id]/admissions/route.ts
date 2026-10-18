// src/app/api/patients/[id]/admissions/route.ts
// GET /api/patients/:id/admissions — a patient's whole admission history, newest first,
// with the length of stay and a readmission flag for each stay.
//   doctor / admin: any patient (the view is written to the access log)
//   patient: only their own history

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { flagReadmissions } from '@/src/lib/admissions'
import { ADMISSION_LIST_INCLUDE, viewForRole } from '@/src/lib/admission-views'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN' && role !== 'PATIENT') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }
  // A patient may only ask for their own history
  if (role === 'PATIENT' && params.id !== actorId) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const admissions = await prisma.admission.findMany({
    where: { patientId: params.id },
    include: ADMISSION_LIST_INCLUDE,
    orderBy: { admittedAt: 'desc' },
    take: 200,
  })

  // Work out which stays were readmissions (needs the whole history in date order)
  const readmissionFlags = flagReadmissions(admissions)

  const now = new Date()
  const history = admissions.map((admission: { id: string }) => ({
    ...viewForRole(role, admission as Parameters<typeof viewForRole>[1], now),
    isReadmission: readmissionFlags.get(admission.id) ?? false,
  }))

  if (role !== 'PATIENT') {
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: params.id,
      action: 'VIEW',
      resourceType: 'ADMISSION_HISTORY',
      details: { admissionCount: admissions.length },
      ...getRequestMeta(request),
    })
  }

  return NextResponse.json({ success: true, data: history })
}
