// src/app/api/next-of-kin/[id]/consent/route.ts
// POST /api/next-of-kin/:id/consent — toggle emergency consent for an assignment

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  // Only the next of kin themselves can grant/revoke consent
  if (role !== 'NEXT_OF_KIN' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Find the assignment and make sure this next of kin is the one assigned
  const assignment = await prisma.nextOfKinAssignment.findFirst({
    where: {
      id: params.id,
      ...(role === 'NEXT_OF_KIN' ? { kinUserId: actorId } : {}), // Admin can update any
    },
  })

  if (!assignment) {
    return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 })
  }

  // Toggle the consent status
  const newConsentValue = !assignment.emergencyConsentGiven

  const updated = await prisma.nextOfKinAssignment.update({
    where: { id: params.id },
    data: {
      emergencyConsentGiven: newConsentValue,
      // Record the time consent was given; clear it if consent is revoked
      consentGivenAt: newConsentValue ? new Date() : null,
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: assignment.patientId,
    action: 'EDIT',
    resourceType: 'NEXT_OF_KIN',
    resourceId: assignment.id,
    details: { consentGranted: newConsentValue },
    ...getRequestMeta(request),
  })

  return NextResponse.json({
    success: true,
    data: updated,
    message: newConsentValue
      ? 'Emergency consent granted successfully'
      : 'Emergency consent has been revoked',
  })
}
