// src/app/api/patients/route.ts
// GET /api/patients — list all patients (admin/doctor/receptionist only)
// POST /api/patients — create a new patient account

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/src/lib/prisma'
import { CreateUserSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const userId = request.headers.get('x-user-id')!

  // Only staff roles can list all patients
  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const skip = (page - 1) * pageSize

  const [patients, total] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'PATIENT', isActive: true },
      select: {
        id: true,
        email: true,
        studentNumber: true,
        fullName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        patientProfile: true,
      },
      orderBy: { fullName: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where: { role: 'PATIENT', isActive: true } }),
  ])

  await logAccess({
    accessedByUserId: userId,
    action: 'VIEW',
    resourceType: 'PROFILE',
    details: { note: 'Listed all patients' },
    ...getRequestMeta(request),
  })

  return NextResponse.json({
    success: true,
    data: { items: patients, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  // Only admin and receptionists can create patient accounts
  if (!['RECEPTIONIST', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const validation = CreateUserSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const data = validation.data

  // Check if email already exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: data.email.toLowerCase() },
        data.studentNumber ? { studentNumber: data.studentNumber } : {},
      ].filter((c) => Object.keys(c).length > 0),
    },
  })

  if (existing) {
    return NextResponse.json(
      { success: false, error: 'A user with this email or student number already exists' },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(data.password, 12)

  const user = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      studentNumber: data.studentNumber || null,
      passwordHash,
      role: data.role,
      fullName: data.fullName,
      phone: data.phone || null,
      // If creating a patient, also create their profile
      ...(data.role === 'PATIENT' && {
        patientProfile: {
          create: {
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            bloodType: data.bloodType || null,
            address: data.address || null,
            emergencyContactName: data.emergencyContactName || null,
            emergencyContactPhone: data.emergencyContactPhone || null,
          },
        },
      }),
    },
    select: {
      id: true,
      email: true,
      studentNumber: true,
      role: true,
      fullName: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: data.role === 'PATIENT' ? user.id : null,
    action: 'CREATE',
    resourceType: 'PROFILE',
    resourceId: user.id,
    details: { createdRole: data.role },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: user }, { status: 201 })
}
