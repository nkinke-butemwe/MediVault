// src/app/api/patients/search/route.ts
// GET /api/patients/search?q=searchterm — search patients by name or student number

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'

export async function GET(request: NextRequest) {
  const { role: effectiveRole } = await getRoleAndActor(request)

  // Only clinical staff can search patients
  if (!['RECEPTIONIST', 'DOCTOR', 'ADMIN'].includes(effectiveRole || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()

  if (!query || query.length < 2) {
    return NextResponse.json({ success: true, data: [] })
  }

  // Search by name, email, or student number (case-insensitive)
  const patients = await prisma.user.findMany({
    where: {
      role: 'PATIENT',
      isActive: true,
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { studentNumber: { contains: query, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      email: true,
      studentNumber: true,
      fullName: true,
      phone: true,
      isActive: true,
      patientProfile: {
        select: { bloodType: true, dateOfBirth: true },
      },
    },
    take: 10, // Limit results for autocomplete performance
    orderBy: { fullName: 'asc' },
  })

  return NextResponse.json({ success: true, data: patients })
}