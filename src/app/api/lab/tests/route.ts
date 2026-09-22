// src/app/api/lab/tests/route.ts
// GET /api/lab/tests — the catalogue of tests the clinic lab can run

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'

export async function GET(request: NextRequest) {
  const { role } = await getRoleAndActor(request)

  if (!['DOCTOR', 'LAB_TECHNICIAN', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const tests = await prisma.labTest.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json({ success: true, data: tests })
}
