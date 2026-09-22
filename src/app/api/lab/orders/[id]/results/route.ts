// src/app/api/lab/orders/[id]/results/route.ts
// PUT /api/lab/orders/:id/results — the lab technician enters results for an order.
// Flags (LOW / HIGH / CRITICAL...) are worked out HERE on the server from the
// reference ranges, so a result can never be saved with a wrong flag.
// When every test in the order has a result, the order becomes COMPLETED.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { EnterLabResultsSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { LAB_ORDER_INCLUDE } from '@/src/lib/lab-include'
import { computeFlag, canEnterResults, isCriticalFlag, parseAllowedResults } from '@/src/lib/lab'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!['LAB_TECHNICIAN', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only lab technicians can enter results' }, { status: 403 })
  }

  const validation = EnterLabResultsSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid results', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const order = await prisma.labOrder.findUnique({
    where: { id: params.id },
    include: { items: { include: { test: true } } },
  })
  if (!order) return NextResponse.json({ success: false, error: 'Lab order not found' }, { status: 404 })
  if (!canEnterResults(order.status)) {
    return NextResponse.json({ success: false, error: `Results can't be entered for a ${order.status.toLowerCase()} order` }, { status: 409 })
  }

  // Check every submitted row belongs to THIS order and suits the test type
  const itemsById = new Map(order.items.map((i) => [i.id, i]))
  const prepared: { itemId: string; data: Record<string, unknown>; critical: boolean; testCode: string }[] = []

  for (const entry of validation.data.results) {
    const item = itemsById.get(entry.itemId)
    if (!item) {
      return NextResponse.json({ success: false, error: 'A result does not belong to this order' }, { status: 400 })
    }

    const isTextTest = !!item.test.allowedResults
    if (isTextTest) {
      const allowed = parseAllowedResults(item.test.allowedResults)
      const text = entry.valueText?.trim()
      if (!text || !allowed.some((a) => a.toLowerCase() === text.toLowerCase())) {
        return NextResponse.json(
          { success: false, error: `${item.test.name} must be one of: ${allowed.join(', ')}` },
          { status: 400 }
        )
      }
    } else if (entry.valueNumeric === null || entry.valueNumeric === undefined) {
      return NextResponse.json({ success: false, error: `${item.test.name} needs a numeric value` }, { status: 400 })
    }

    const flag = computeFlag(item, entry)
    prepared.push({
      itemId: item.id,
      testCode: item.test.code,
      critical: isCriticalFlag(flag),
      data: {
        valueNumeric: isTextTest ? null : entry.valueNumeric ?? null,
        valueText: isTextTest ? entry.valueText!.trim() : null,
        flag,
        notes: entry.notes || null,
        resultAt: new Date(),
      },
    })
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const p of prepared) {
      await tx.labOrderItem.update({ where: { id: p.itemId }, data: p.data })
    }

    // Is every test in the order now resulted?
    const remaining = await tx.labOrderItem.count({ where: { orderId: order.id, resultAt: null } })
    const now = new Date()
    await tx.labOrder.update({
      where: { id: order.id },
      data: {
        // Entering a result implies the sample was taken
        ...(order.collectedAt ? {} : { collectedAt: now, collectedById: actorId }),
        status: remaining === 0 ? 'COMPLETED' : 'COLLECTED',
        ...(remaining === 0 ? { completedAt: now, completedById: actorId } : {}),
      },
    })

    return tx.labOrder.findUniqueOrThrow({ where: { id: order.id }, include: LAB_ORDER_INCLUDE })
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: order.patientId,
    action: 'EDIT',
    resourceType: 'LAB_ORDER',
    resourceId: order.id,
    details: {
      action: 'results_entered',
      tests: prepared.map((p) => p.testCode),
      criticalCount: prepared.filter((p) => p.critical).length,
    },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: updated })
}
