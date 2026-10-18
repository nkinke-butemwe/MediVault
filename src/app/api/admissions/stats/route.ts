// src/app/api/admissions/stats/route.ts
// GET /api/admissions/stats — headline numbers for doctors and admins.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { averageLengthOfStayDays, countReadmissions, startOfLusakaDay } from '@/src/lib/admissions'

// How far back the average stay and readmission count look
const STATS_WINDOW_DAYS = 365

export async function GET(request: NextRequest) {
  const { role } = await getRoleAndActor(request)

  if (!role) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  if (role !== 'DOCTOR' && role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const now = new Date()
  const todayStart = startOfLusakaDay(now)
  const windowStart = new Date(now.getTime() - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [currentAdmissions, dischargesToday, completedAdmissions, recentAdmissions] = await Promise.all([
    prisma.admission.count({ where: { status: 'ADMITTED' } }),
    prisma.admission.count({ where: { status: 'DISCHARGED', dischargedAt: { gte: todayStart } } }),
    prisma.admission.count({ where: { status: 'DISCHARGED' } }),
    // Admissions in the last year, grouped later by patient to find readmissions
    prisma.admission.findMany({
      where: { status: { not: 'CANCELLED' }, admittedAt: { gte: windowStart } },
      select: { id: true, patientId: true, status: true, admittedAt: true, dischargedAt: true },
      orderBy: { admittedAt: 'asc' },
      take: 5000,
    }),
  ])

  // Only finished stays count towards the average
  const finishedStays = recentAdmissions
    .filter((admission: { dischargedAt: Date | null }) => admission.dischargedAt !== null)
    .map((admission: { admittedAt: Date; dischargedAt: Date | null }) => ({
      admittedAt: admission.admittedAt,
      dischargedAt: admission.dischargedAt as Date,
    }))

  return NextResponse.json({
    success: true,
    data: {
      currentAdmissions,
      dischargesToday,
      completedAdmissions,
      averageLengthOfStayDays: averageLengthOfStayDays(finishedStays),
      readmissionCount: countReadmissions(recentAdmissions),
      windowDays: STATS_WINDOW_DAYS,
    },
  })
}
