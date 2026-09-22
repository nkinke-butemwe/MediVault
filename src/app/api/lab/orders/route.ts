// src/app/api/lab/orders/route.ts
// GET  /api/lab/orders?patientId=&status= — list lab orders (what you see depends on your role)
// POST /api/lab/orders — a doctor orders one or more tests for a patient

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { CreateLabOrderSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { LAB_ORDER_INCLUDE } from '@/src/lib/lab-include'

const VALID_STATUSES = ['ORDERED', 'COLLECTED', 'COMPLETED', 'CANCELLED']

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)
  const { searchParams } = new URL(request.url)
  const patientId = searchParams.get('patientId')
  const statusParam = searchParams.get('status')

  const where: Record<string, unknown> = {}
  if (statusParam) {
    const statuses = statusParam.split(',').filter((s) => VALID_STATUSES.includes(s))
    if (statuses.length > 0) where.status = { in: statuses }
  }

  if (role === 'PATIENT') {
    // A patient sees only their own results, and only once the doctor has reviewed them
    where.patientId = actorId
    where.status = 'COMPLETED'
    where.reviewedAt = { not: null }
  } else if (role === 'DOCTOR' || role === 'ADMIN' || role === 'LAB_TECHNICIAN') {
    if (patientId) where.patientId = patientId
  } else {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const orders = await prisma.labOrder.findMany({
    where,
    include: LAB_ORDER_INCLUDE,
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  // Record who looked at a specific patient's lab data (patients viewing their own are not logged)
  if (role !== 'PATIENT' && patientId) {
    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: patientId,
      action: 'VIEW',
      resourceType: 'LAB_ORDER',
      details: { orderCount: orders.length },
      ...getRequestMeta(request),
    })
  }

  return NextResponse.json({ success: true, data: orders })
}

export async function POST(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!['DOCTOR', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only doctors can order lab tests' }, { status: 403 })
  }

  const validation = CreateLabOrderSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid lab order', details: validation.error.flatten() },
      { status: 400 }
    )
  }
  const { patientId, testIds, priority, clinicalNotes } = validation.data

  const patient = await prisma.user.findFirst({ where: { id: patientId, role: 'PATIENT', isActive: true } })
  if (!patient) return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 })

  const uniqueTestIds = Array.from(new Set(testIds))
  const tests = await prisma.labTest.findMany({ where: { id: { in: uniqueTestIds }, isActive: true } })
  if (tests.length !== uniqueTestIds.length) {
    return NextResponse.json({ success: false, error: 'One or more selected tests do not exist' }, { status: 400 })
  }

  const order = await prisma.labOrder.create({
    data: {
      patientId,
      orderedById: actorId,
      priority,
      clinicalNotes: clinicalNotes || null,
      items: {
        // Copy the ranges now so later catalogue edits never change an old order
        create: tests.map((t) => ({
          testId: t.id,
          unit: t.unit,
          refLow: t.refLow,
          refHigh: t.refHigh,
          criticalLow: t.criticalLow,
          criticalHigh: t.criticalHigh,
          normalText: t.normalText,
        })),
      },
    },
    include: LAB_ORDER_INCLUDE,
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: patientId,
    action: 'CREATE',
    resourceType: 'LAB_ORDER',
    resourceId: order.id,
    details: { tests: tests.map((t) => t.code), priority },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: order }, { status: 201 })
}
