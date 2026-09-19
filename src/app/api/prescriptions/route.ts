// src/app/api/prescriptions/route.ts
// GET /api/prescriptions — list prescriptions (pharmacist sees all pending, doctor sees own, patient sees own)
// POST /api/prescriptions — create a prescription (doctors only)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

function getRoleAndActor(request: NextRequest) {
  let role = request.headers.get('x-user-role')
  let actorId = request.headers.get('x-user-id') ?? 'system'
  if (!role) {
    const token = request.cookies.get('medivault_token')?.value
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        role = payload.role
        actorId = payload.userId ?? 'system'
      } catch {}
    }
  }
  return { role, actorId }
}

export async function GET(request: NextRequest) {
  const { role, actorId } = getRoleAndActor(request)
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const patientId = searchParams.get('patientId')

  let whereClause: Record<string, unknown> = {}

  if (role === 'PHARMACIST' || role === 'ADMIN') {
    // Pharmacists see all prescriptions, optionally filtered by status
    if (statusFilter) whereClause.status = statusFilter
    if (patientId) whereClause.patientId = patientId
  } else if (role === 'DOCTOR') {
    // Doctors see prescriptions they issued
    whereClause.doctorId = actorId
    if (statusFilter) whereClause.status = statusFilter
  } else if (role === 'PATIENT') {
    // Patients see their own prescriptions
    whereClause.patientId = actorId
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const prescriptions = await prisma.prescription.findMany({
    where: whereClause,
    include: {
      patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
      doctor: { select: { id: true, fullName: true, email: true } },
      pharmacist: { select: { id: true, fullName: true, email: true } },
      medicalRecord: { select: { id: true, diagnosis: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ success: true, data: prescriptions })
}

export async function POST(request: NextRequest) {
  const { role, actorId } = getRoleAndActor(request)

  if (!['DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only doctors can create prescriptions' }, { status: 403 })
  }

  const body = await request.json()
  const { patientId, medications, medicalRecordId, notes } = body

  if (!patientId || !medications || !Array.isArray(medications) || medications.length === 0) {
    return NextResponse.json({ success: false, error: 'patientId and at least one medication are required' }, { status: 400 })
  }

  const patient = await prisma.user.findFirst({ where: { id: patientId, role: 'PATIENT' } })
  if (!patient) return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })

  const prescription = await prisma.prescription.create({
    data: {
      patientId,
      doctorId: actorId,
      medicalRecordId: medicalRecordId || null,
      medications: JSON.stringify(medications),
      notes: notes || null,
      status: 'PENDING',
    },
    include: {
      patient: { select: { id: true, fullName: true, email: true, studentNumber: true } },
      doctor: { select: { id: true, fullName: true, email: true } },
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: patientId,
    action: 'CREATE',
    resourceType: 'PRESCRIPTION',
    resourceId: prescription.id,
    details: { medicationCount: medications.length },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: prescription }, { status: 201 })
}