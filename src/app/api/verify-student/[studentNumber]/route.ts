import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { queryUNZASIS } from '@/src/lib/unza-sis-mock'

export async function GET(
  request: NextRequest,
  { params }: { params: { studentNumber: string } }
) {
  // Read role from middleware headers
  let effectiveRole = request.headers.get('x-user-role')
  let actorId = request.headers.get('x-user-id') ?? 'system'

  // Fallback: middleware didn't attach headers, decode JWT cookie directly
  if (!effectiveRole) {
    const token = request.cookies.get('medivault_token')?.value
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        effectiveRole = payload.role
        actorId = payload.userId ?? 'system'
      } catch {}
    }
  }

  // Only receptionists, doctors, and admins can verify students
  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(effectiveRole || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { studentNumber } = params

  // Step 1: Check UNZA SIS first
  const sisCheck = queryUNZASIS(studentNumber)

  if (!sisCheck.found) {
    return NextResponse.json({
      success: true,
      data: { found: false, eligible: false, reason: 'No student record found in UNZA SIS.' },
    })
  }

  if (!sisCheck.eligible) {
    return NextResponse.json({
      success: true,
      data: { found: true, eligible: false, reason: sisCheck.reason },
    })
  }

  // Step 2: Check MediVault database
  const user = await prisma.user.findUnique({
    where: { studentNumber },
    select: {
      id: true,
      email: true,
      studentNumber: true,
      fullName: true,
      phone: true,
      isActive: true,
      role: true,
      createdAt: true,
      patientProfile: {
        select: {
          bloodType: true,
          emergencyContactName: true,
          emergencyContactPhone: true,
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json({
      success: true,
      data: {
        found: false,
        eligible: false,
        reason: 'No student record found for this student number.',
      },
    })
  }

  const eligible = user.role === 'PATIENT' && user.isActive
  const reason = !eligible
    ? user.role !== 'PATIENT'
      ? 'This student number belongs to a non-patient account.'
      : 'This student account has been deactivated.'
    : 'Student is eligible for clinic services.'

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: user.id,
    action: 'VIEW',
    resourceType: 'PROFILE',
    resourceId: user.id,
    details: { verificationMethod: 'student_number', studentNumber },
    ...getRequestMeta(request),
  })

  return NextResponse.json({
    success: true,
    data: {
      found: true,
      eligible,
      reason,
      patient: eligible
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            studentNumber: user.studentNumber,
            phone: user.phone,
            bloodType: user.patientProfile?.bloodType,
            emergencyContactName: user.patientProfile?.emergencyContactName,
            emergencyContactPhone: user.patientProfile?.emergencyContactPhone,
          }
        : null,
    },
  })
}