// src/app/api/access-logs/route.ts
<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

function getRoleAndActor(request: NextRequest) {
  let role = request.headers.get('x-user-role')
  let actorId = request.headers.get('x-user-id') ?? 'system'
  if (!role) {
    const token = request.cookies.get('medivault_token')?.value
    if (token) { try { const p = JSON.parse(atob(token.split('.')[1])); role = p.role; actorId = p.userId ?? 'system' } catch {} }
  }
  return { role, actorId }
}

export async function GET(request: NextRequest) {
  const { role, actorId } = getRoleAndActor(request)
=======
// GET /api/access-logs — get all access logs (admin) or own logs (patient)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10)
  const skip = (page - 1) * pageSize
<<<<<<< HEAD
  const filterByAction = searchParams.get('action')
  const search = searchParams.get('search')?.trim()

  let whereClause: Record<string, unknown> = {}

  if (role === 'ADMIN') {
    if (filterByAction) whereClause.action = filterByAction
    if (search) {
      whereClause.OR = [
        { accessedBy: { fullName: { contains: search, mode: 'insensitive' } } },
        { accessedBy: { email: { contains: search, mode: 'insensitive' } } },
        { targetPatient: { fullName: { contains: search, mode: 'insensitive' } } },
        { targetPatient: { email: { contains: search, mode: 'insensitive' } } },
      ]
    }
  } else if (role === 'PATIENT') {
=======

  // Filter parameters (admin only)
  const filterByUserId = searchParams.get('userId')
  const filterByPatientId = searchParams.get('patientId')
  const filterByAction = searchParams.get('action')
  const filterByResourceType = searchParams.get('resourceType')

  // Patients can only see logs about their own data
  // Admins can see all logs with optional filters
  let whereClause: Record<string, unknown> = {}

  if (role === 'ADMIN') {
    // Admin can filter by anything
    if (filterByUserId) whereClause.accessedByUserId = filterByUserId
    if (filterByPatientId) whereClause.targetPatientId = filterByPatientId
    if (filterByAction) whereClause.action = filterByAction
    if (filterByResourceType) whereClause.resourceType = filterByResourceType
  } else if (role === 'PATIENT') {
    // Patients only see logs where their record was accessed
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
    whereClause.targetPatientId = actorId
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const [logs, total] = await Promise.all([
    prisma.accessLog.findMany({
      where: whereClause,
      include: {
<<<<<<< HEAD
        accessedBy: { select: { id: true, fullName: true, email: true, role: true } },
        targetPatient: { select: { id: true, fullName: true, email: true } },
=======
        accessedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        targetPatient: {
          select: { id: true, fullName: true, email: true },
        },
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.accessLog.count({ where: whereClause }),
  ])

  return NextResponse.json({
    success: true,
<<<<<<< HEAD
    data: { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}
=======
    data: {
      items: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
