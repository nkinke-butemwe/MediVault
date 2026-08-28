// src/app/api/visits/route.ts
<<<<<<< HEAD
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { CreateVisitSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

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
  const patientId = searchParams.get('patientId')

  if (!patientId) {
    if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
    const visits = await prisma.visit.findMany({
      where: { visitDate: { gte: today, lt: tomorrow } },
      include: { patient: { select: { id: true, fullName: true, email: true, studentNumber: true } }, createdBy: { select: { id: true, fullName: true } } },
      orderBy: { visitDate: 'asc' },
    })
    return NextResponse.json({ success: true, data: visits })
  }

  const isOwnVisit = actorId === patientId
  const canViewAll = ['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')
  if (!isOwnVisit && !canViewAll) {
    if (role === 'NEXT_OF_KIN') {
      const assignment = await prisma.nextOfKinAssignment.findFirst({ where: { kinUserId: actorId, patientId, isActive: true } })
      if (!assignment) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
=======
// GET /api/visits?patientId=xxx — get visits for a patient
// POST /api/visits — create a new visit (receptionists/doctors)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { CreateVisitSchema, UpdateVisitSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')

  // If no patientId, return today's visits for receptionist dashboard
  if (!patientId) {
    if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Get all visits for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const visits = await prisma.visit.findMany({
      where: {
        visitDate: { gte: today, lt: tomorrow },
      },
      include: {
        patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { visitDate: 'asc' },
    })

    return NextResponse.json({ success: true, data: visits })
  }

  // Check access for specific patient's visits
  const isOwnVisit = actorId === patientId
  const canViewAll = ['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')

  if (!isOwnVisit && !canViewAll) {
    // Next of kin can see summary visits
    if (role === 'NEXT_OF_KIN') {
      const assignment = await prisma.nextOfKinAssignment.findFirst({
        where: { kinUserId: actorId, patientId, isActive: true },
      })
      if (!assignment) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
    } else {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  const visits = await prisma.visit.findMany({
    where: { patientId },
<<<<<<< HEAD
    include: { patient: { select: { id: true, fullName: true, email: true, studentNumber: true } }, createdBy: { select: { id: true, fullName: true } } },
=======
    include: {
      patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
    orderBy: { visitDate: 'desc' },
  })

  if (!isOwnVisit) {
<<<<<<< HEAD
    await logAccess({ accessedByUserId: actorId, targetPatientId: patientId, action: 'VIEW', resourceType: 'VISIT', details: { visitCount: visits.length }, ...getRequestMeta(request) })
  }
=======
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: patientId,
      action: 'VIEW',
      resourceType: 'VISIT',
      details: { visitCount: visits.length },
      ...getRequestMeta(request),
    })
  }

>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
  return NextResponse.json({ success: true, data: visits })
}

export async function POST(request: NextRequest) {
<<<<<<< HEAD
  const { role, actorId } = getRoleAndActor(request)
  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const validation = CreateVisitSchema.safeParse(body)
  if (!validation.success) return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 })

  const { patientId, reason, vitals, visitDate } = validation.data
  const patient = await prisma.user.findFirst({ where: { id: patientId, role: 'PATIENT' } })
  if (!patient) return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })

  const visit = await prisma.visit.create({
    data: { patientId, reason, vitals: vitals || null, visitDate: visitDate ? new Date(visitDate) : new Date(), status: 'WAITING', createdById: actorId },
    include: { patient: { select: { id: true, fullName: true, email: true, studentNumber: true } }, createdBy: { select: { id: true, fullName: true } } },
  })

  await logAccess({ accessedByUserId: actorId, targetPatientId: patientId, action: 'CREATE', resourceType: 'VISIT', resourceId: visit.id, details: { reason }, ...getRequestMeta(request) })
  return NextResponse.json({ success: true, data: visit }, { status: 201 })
}
=======
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const validation = CreateVisitSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { patientId, reason, vitals, visitDate } = validation.data

  const patient = await prisma.user.findFirst({
    where: { id: patientId, role: 'PATIENT' },
  })
  if (!patient) {
    return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
  }

  const visit = await prisma.visit.create({
    data: {
      patientId,
      reason,
      vitals: vitals || null,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      status: 'WAITING',
      createdById: actorId,
    },
    include: {
      patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: patientId,
    action: 'CREATE',
    resourceType: 'VISIT',
    resourceId: visit.id,
    details: { reason },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: visit }, { status: 201 })
}
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
