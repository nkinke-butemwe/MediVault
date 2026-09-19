// src/app/api/prescriptions/[id]/dispense/route.ts
// POST /api/prescriptions/:id/dispense — pharmacist marks a prescription as dispensed

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

function getRoleAndActor(request: NextRequest) {
  let role = request.headers.get('x-user-role')
  let actorId = request.headers.get('x-user-id') ?? 'system'
  if (!role) {
    const token = request.cookies.get('medivault_token')?.value
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        role = payload.role
        actorId = payload.userId ?? 'system'
      } catch {}
    }
  }
  return { role, actorId }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { role, actorId } = getRoleAndActor(request)

  if (!['PHARMACIST', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only pharmacists can dispense prescriptions' }, { status: 403 })
  }

  const prescription = await prisma.prescription.findUnique({ where: { id: params.id } })
  if (!prescription) return NextResponse.json({ success: false, error: 'Prescription not found' }, { status: 404 })
  if (prescription.status !== 'PENDING') {
    return NextResponse.json({ success: false, error: `Prescription is already ${prescription.status.toLowerCase()}` }, { status: 400 })
  }

  const updated = await prisma.prescription.update({
    where: { id: params.id },
    data: {
      status: 'DISPENSED',
      pharmacistId: actorId,
      dispensedAt: new Date(),
    },
    include: {
      patient: { select: { id: true, fullName: true, email: true } },
      doctor: { select: { id: true, fullName: true } },
      pharmacist: { select: { id: true, fullName: true } },
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: prescription.patientId,
    action: 'EDIT',
    resourceType: 'PRESCRIPTION',
    resourceId: params.id,
    details: { action: 'dispensed' },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: updated })
}