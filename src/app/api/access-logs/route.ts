// src/app/api/access-logs/route.ts
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

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1', 10)
  const pageSize = parseInt(searchParams.get('pageSize') || '25', 10)
  const skip = (page - 1) * pageSize
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
    whereClause.targetPatientId = actorId
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const [logs, total] = await Promise.all([
    prisma.accessLog.findMany({
      where: whereClause,
      include: {
        accessedBy: { select: { id: true, fullName: true, email: true, role: true } },
        targetPatient: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { timestamp: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.accessLog.count({ where: whereClause }),
  ])

  return NextResponse.json({
    success: true,
    data: { items: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
  })
}