// src/app/api/medical-records/route.ts
// GET /api/medical-records?patientId=xxx — get records for a patient
// POST /api/medical-records — create a new medical record (doctors only)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { CreateMedicalRecordSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')

  if (!patientId) {
    return NextResponse.json({ success: false, error: 'patientId query parameter is required' }, { status: 400 })
  }

  // Access control:
  // - Patients can only see their own records
  // - Doctors and Admins can see any patient's records
  // - Next of kin can see basic records for their assigned patients
  const isOwnRecord = actorId === patientId
  const canViewAll = ['DOCTOR', 'ADMIN'].includes(role || '')
  
  if (!isOwnRecord && !canViewAll && role !== 'NEXT_OF_KIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // For next of kin, verify they are actually assigned to this patient
  if (role === 'NEXT_OF_KIN') {
    const assignment = await prisma.nextOfKinAssignment.findFirst({
      where: { kinUserId: actorId, patientId, isActive: true },
    })
    if (!assignment) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }
  }

  const records = await prisma.medicalRecord.findMany({
    where: { patientId },
    include: {
      doctor: {
        select: { id: true, fullName: true, email: true },
      },
    },
    orderBy: { visitDate: 'desc' },
  })

  // Parse the medications JSON string back into an array for each record
  const formattedRecords = records.map((record) => ({
    ...record,
    medications: record.medications ? JSON.parse(record.medications) : [],
  }))

  if (!isOwnRecord) {
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: patientId,
      action: 'VIEW',
      resourceType: 'MEDICAL_RECORD',
      details: { recordCount: records.length },
      ...getRequestMeta(request),
    })
  }

  return NextResponse.json({ success: true, data: formattedRecords })
}

export async function POST(request: NextRequest) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  // Only doctors (and admins) can create medical records
  if (!['DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only doctors can create medical records' }, { status: 403 })
  }

  const body = await request.json()
  const validation = CreateMedicalRecordSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const { patientId, diagnosis, medications, allergies, notes, visitDate, followUpDate } =
    validation.data

  // Make sure the patient exists
  const patient = await prisma.user.findFirst({
    where: { id: patientId, role: 'PATIENT' },
  })
  if (!patient) {
    return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })
  }

  const record = await prisma.medicalRecord.create({
    data: {
      patientId,
      doctorId: actorId, // The logged-in doctor is automatically set as the author
      diagnosis,
      // Store medications array as a JSON string in the database
      medications: medications ? JSON.stringify(medications) : null,
      allergies: allergies || null,
      notes: notes || null,
      visitDate: visitDate ? new Date(visitDate) : new Date(),
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
    include: {
      doctor: { select: { id: true, fullName: true, email: true } },
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: patientId,
    action: 'CREATE',
    resourceType: 'MEDICAL_RECORD',
    resourceId: record.id,
    details: { diagnosis },
    ...getRequestMeta(request),
  })

  return NextResponse.json(
    {
      success: true,
      data: { ...record, medications: medications || [] },
    },
    { status: 201 }
  )
}
