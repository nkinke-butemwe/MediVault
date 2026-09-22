// src/app/api/prescriptions/route.ts
// GET /api/prescriptions — list prescriptions (pharmacist sees all pending, doctor sees own, patient sees own)
// POST /api/prescriptions — create a prescription (doctors only)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { CreatePrescriptionSchema } from '@/src/lib/validators'
import { getRoleAndActor } from '@/src/lib/auth'

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)
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
  const { role, actorId } = await getRoleAndActor(request)

  if (!['DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only doctors can create prescriptions' }, { status: 403 })
  }

  const validation = CreatePrescriptionSchema.safeParse(await request.json())
  if (!validation.success) {
    const first = validation.error.issues[0]
    return NextResponse.json(
      { success: false, error: first?.message ?? 'Invalid prescription', details: validation.error.flatten() },
      { status: 400 }
    )
  }
  const { patientId, medications, medicalRecordId, notes } = validation.data

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