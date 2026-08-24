// src/app/api/access-logs/export/route.ts
// GET /api/access-logs/export — export access logs as CSV (admin only)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET(request: NextRequest) {
  const role = request.headers.get('x-user-role')

  if (role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Fetch all logs for export (cap at 10,000 to prevent huge downloads)
  const logs = await prisma.accessLog.findMany({
    include: {
      accessedBy: { select: { fullName: true, email: true, role: true } },
      targetPatient: { select: { fullName: true, email: true } },
    },
    orderBy: { timestamp: 'desc' },
    take: 10000,
  })

  // Convert to CSV format
  const csvHeader = [
    'Timestamp',
    'Accessed By',
    'Accessed By Email',
    'Role',
    'Target Patient',
    'Action',
    'Resource Type',
    'Resource ID',
    'IP Address',
    'Details',
  ].join(',')

  const csvRows = logs.map((log) => {
    const cols = [
      log.timestamp.toISOString(),
      `"${log.accessedBy.fullName}"`,
      log.accessedBy.email,
      log.accessedBy.role,
      log.targetPatient ? `"${log.targetPatient.fullName}"` : '',
      log.action,
      log.resourceType,
      log.resourceId || '',
      log.ipAddress || '',
      log.details ? `"${log.details.replace(/"/g, '""')}"` : '',
    ]
    return cols.join(',')
  })

  const csvContent = [csvHeader, ...csvRows].join('\n')

  // Return as a downloadable CSV file
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="medivault-access-logs-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
