import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { queryUNZASIS } from '@/src/lib/unza-sis-mock'
import { getRoleAndActor } from '@/src/lib/auth'
import { checkRateLimit } from '@/src/lib/rate-limit'

// Each staff member may look up at most 30 student numbers per minute.
// This is plenty for a busy front desk but stops someone from running through
// student numbers to find out which ones exist.
const VERIFY_LIMIT = { maxAttempts: 30, windowMs: 60 * 1000 }

export async function GET(
  request: NextRequest,
  { params }: { params: { studentNumber: string } }
) {
  const { role: effectiveRole, actorId } = await getRoleAndActor(request)

  // Only receptionists, doctors, and admins can verify students
  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(effectiveRole || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Rate limit per logged-in user (not per IP, because the whole clinic may share one IP)
  const rateLimit = checkRateLimit(`verify-student:${actorId}`, VERIFY_LIMIT)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: `Too many lookups. Please try again in ${rateLimit.retryAfterSeconds} seconds.` },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    )
  }

  const { studentNumber } = params

  // Small helper: records a lookup that did NOT end in a patient being shown.
  // targetPatientId is null because no patient was found/eligible.
  const logFailedLookup = (outcome: 'NOT_FOUND' | 'SUSPENDED' | 'ALUMNUS') =>
    logAccess({
      accessedByUserId: actorId,
      targetPatientId: null,
      action: 'VIEW',
      resourceType: 'PROFILE',
      details: { studentNumber, outcome },
      ...getRequestMeta(request),
    })

  // Step 1: Check UNZA SIS first
  const sisCheck = queryUNZASIS(studentNumber)

  if (!sisCheck.found) {
    await logFailedLookup('NOT_FOUND')
    return NextResponse.json({
      success: true,
      data: { found: false, eligible: false, reason: 'No student record found in UNZA SIS.' },
    })
  }

  if (!sisCheck.eligible) {
    await logFailedLookup(sisCheck.outcome)
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
    await logFailedLookup('NOT_FOUND')
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