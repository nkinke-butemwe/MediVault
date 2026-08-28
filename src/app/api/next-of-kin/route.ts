// src/app/api/next-of-kin/route.ts
<<<<<<< HEAD
=======
// GET /api/next-of-kin?patientId=xxx — get next of kin for a patient
// POST /api/next-of-kin — create an assignment (patient assigns someone)

>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { CreateNextOfKinSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

<<<<<<< HEAD
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

  if (!patientId && role === 'NEXT_OF_KIN') {
    const assignments = await prisma.nextOfKinAssignment.findMany({
      where: { kinUserId: actorId, isActive: true },
      include: { patient: { select: { id: true, fullName: true, email: true, studentNumber: true, patientProfile: true } } },
=======
export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')

  // Next of kin dashboard: get all patients this user is assigned to
  if (!patientId && role === 'NEXT_OF_KIN') {
    const assignments = await prisma.nextOfKinAssignment.findMany({
      where: { kinUserId: actorId, isActive: true },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            email: true,
            studentNumber: true,
            patientProfile: true,
          },
        },
      },
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
    })
    return NextResponse.json({ success: true, data: assignments })
  }

<<<<<<< HEAD
  if (!patientId) return NextResponse.json({ success: false, error: 'patientId is required' }, { status: 400 })

  const isOwnRecord = actorId === patientId
  const canView = ['DOCTOR', 'ADMIN', 'RECEPTIONIST'].includes(role || '')
  if (!isOwnRecord && !canView) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const assignments = await prisma.nextOfKinAssignment.findMany({
    where: { patientId, isActive: true },
    include: { nextOfKin: { select: { id: true, fullName: true, email: true, phone: true } } },
  })
=======
  if (!patientId) {
    return NextResponse.json({ success: false, error: 'patientId is required' }, { status: 400 })
  }

  // Patients can view their own next of kin; staff can view any
  const isOwnRecord = actorId === patientId
  const canView = ['DOCTOR', 'ADMIN', 'RECEPTIONIST'].includes(role || '')

  if (!isOwnRecord && !canView) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const assignments = await prisma.nextOfKinAssignment.findMany({
    where: { patientId, isActive: true },
    include: {
      nextOfKin: {
        select: { id: true, fullName: true, email: true, phone: true },
      },
    },
  })

>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
  return NextResponse.json({ success: true, data: assignments })
}

export async function POST(request: NextRequest) {
<<<<<<< HEAD
  const { role, actorId } = getRoleAndActor(request)
  if (!['PATIENT', 'ADMIN'].includes(role || '')) return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const validation = CreateNextOfKinSchema.safeParse(body)
  if (!validation.success) return NextResponse.json({ success: false, error: 'Validation failed', details: validation.error.flatten() }, { status: 400 })

  const { kinUserId } = validation.data
  const patientId = actorId

  const kinUser = await prisma.user.findFirst({ where: { id: kinUserId, role: 'NEXT_OF_KIN', isActive: true } })
  if (!kinUser) return NextResponse.json({ success: false, error: 'Next of kin user not found or does not have the NEXT_OF_KIN role' }, { status: 404 })

  await prisma.nextOfKinAssignment.updateMany({ where: { patientId, isActive: true }, data: { isActive: false } })

  const assignment = await prisma.nextOfKinAssignment.create({
    data: { patientId, kinUserId },
    include: { nextOfKin: { select: { id: true, fullName: true, email: true, phone: true } } },
  })

  await logAccess({ accessedByUserId: actorId, targetPatientId: patientId, action: 'CREATE', resourceType: 'NEXT_OF_KIN', resourceId: assignment.id, details: { kinUserId }, ...getRequestMeta(request) })
  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}
=======
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  // Only patients (and admins) can assign a next of kin
  if (!['PATIENT', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const validation = CreateNextOfKinSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { kinUserId } = validation.data
  const patientId = actorId // Patients can only assign for themselves

  // Make sure the next of kin user exists and has the right role
  const kinUser = await prisma.user.findFirst({
    where: { id: kinUserId, role: 'NEXT_OF_KIN', isActive: true },
  })
  if (!kinUser) {
    return NextResponse.json(
      { success: false, error: 'Next of kin user not found or does not have the NEXT_OF_KIN role' },
      { status: 404 }
    )
  }

  // Deactivate any existing assignment for this patient
  await prisma.nextOfKinAssignment.updateMany({
    where: { patientId, isActive: true },
    data: { isActive: false },
  })

  // Create the new assignment
  const assignment = await prisma.nextOfKinAssignment.create({
    data: {
      patientId,
      kinUserId,
    },
    include: {
      nextOfKin: { select: { id: true, fullName: true, email: true, phone: true } },
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: patientId,
    action: 'CREATE',
    resourceType: 'NEXT_OF_KIN',
    resourceId: assignment.id,
    details: { kinUserId },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}
>>>>>>> 24e509d1c2e47ba1acd6cf4a8e84e6ee7b5f38cd
