// src/app/api/patients/search/route.ts
// GET /api/patients/search?q=searchterm — search patients by name or student number

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET(request: NextRequest) {
  // Read role from middleware headers
  let effectiveRole = request.headers.get('x-user-role')

  // Fallback: middleware didn't attach headers, decode JWT cookie directly
  if (!effectiveRole) {
    const token = request.cookies.get('medivault_token')?.value
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        effectiveRole = payload.role
      } catch {}
    }
  }

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