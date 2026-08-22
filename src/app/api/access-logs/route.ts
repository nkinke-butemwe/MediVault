// src/app/api/access-logs/route.ts
// GET /api/access-logs — get all access logs (admin) or own logs (patient)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10)
  const skip = (page - 1) * pageSize

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
    whereClause.targetPatientId = actorId
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const [logs, total] = await Promise.all([
    prisma.accessLog.findMany({
      where: whereClause,
      include: {
        accessedBy: {
          select: { id: true, fullName: true, email: true, role: true },
        },
        targetPatient: {
          select: { id: true, fullName: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.accessLog.count({ where: whereClause }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      items: logs,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}
