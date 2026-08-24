// src/app/api/patients/[id]/route.ts
// GET /api/patients/:id — get a specific patient's full profile
// PUT /api/patients/:id — update a patient's profile

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { UpdatePatientProfileSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!
  const { id } = params

  // Patients can view their own profile; staff can view any patient
  const isOwnProfile = actorId === id
  const isStaff = ['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')

  if (!isOwnProfile && !isStaff) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const patient = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      studentNumber: true,
      fullName: true,
      phone: true,
      isActive: true,
      role: true,
      createdAt: true,
      patientProfile: true,
    },
  })

  if (!patient || patient.role !== 'PATIENT') {
    return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
  }

  // Log the access (but not if a patient is viewing their own record, to keep logs clean)
  if (!isOwnProfile) {
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: id,
      action: 'VIEW',
      resourceType: 'PROFILE',
      resourceId: id,
      ...getRequestMeta(request),
    })
  }

  return NextResponse.json({ success: true, data: patient })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!
  const { id } = params

  // Patients can update their own profile; admins can update any profile
  const isOwnProfile = actorId === id
  if (!isOwnProfile && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const validation = UpdatePatientProfileSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { phone, dateOfBirth, bloodType, address, emergencyContactName, emergencyContactPhone } =
    validation.data

  // Update user record and patient profile in a single transaction
  const [updatedUser] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { phone: phone ?? undefined },
      select: { id: true, email: true, fullName: true, phone: true },
    }),
    prisma.patientProfile.upsert({
      where: { userId: id },
      update: {
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        bloodType: bloodType ?? undefined,
        address: address ?? undefined,
        emergencyContactName: emergencyContactName ?? undefined,
        emergencyContactPhone: emergencyContactPhone ?? undefined,
      },
      create: {
        userId: id,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        bloodType,
        address,
        emergencyContactName,
        emergencyContactPhone,
      },
    }),
  ])

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: id,
    action: 'EDIT',
    resourceType: 'PROFILE',
    resourceId: id,
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: updatedUser })
}
