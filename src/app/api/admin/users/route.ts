// src/app/api/admin/users/route.ts
// GET /api/admin/users — list all users (admin only)
// POST /api/admin/users — create any user type (admin only)

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/src/lib/prisma'
import { CreateUserSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  if (role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filterRole = searchParams.get('role')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10)
  const skip = (page - 1) * pageSize

  const whereClause: Record<string, unknown> = {}
  if (filterRole) whereClause.role = filterRole
  if (search) {
    whereClause.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { studentNumber: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        studentNumber: true,
        role: true,
        fullName: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.user.count({ where: whereClause }),
  ])

  return NextResponse.json({
    success: true,
    data: { items: users, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  if (role !== 'ADMIN') {
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
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email.toLowerCase() }] },
  })

  if (existing) {
    return NextResponse.json(
      { success: false, error: 'A user with this email already exists' },
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
      ...(data.role === 'PATIENT' && {
        patientProfile: {
          create: {
            dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
            bloodType: data.bloodType || null,
            address: data.address || null,
          },
        },
      }),
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      createdAt: true,
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    action: 'CREATE',
    resourceType: 'USER',
    resourceId: user.id,
    details: { createdRole: data.role, createdEmail: data.email },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: user }, { status: 201 })
}
