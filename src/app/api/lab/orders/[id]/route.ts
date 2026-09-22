// src/app/api/lab/orders/[id]/route.ts
// PATCH /api/lab/orders/:id — move an order along its workflow
//   { action: 'collect' }                     lab technician marks the sample as collected
//   { action: 'cancel' }                      doctor cancels an order nobody has started
//   { action: 'review', doctorComment? }      doctor signs off completed results (releases them to the patient)

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { LabOrderActionSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { LAB_ORDER_INCLUDE } from '@/src/lib/lab-include'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { role, actorId } = await getRoleAndActor(request)

  const validation = LabOrderActionSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }
  const body = validation.data

  const order = await prisma.labOrder.findUnique({ where: { id: params.id } })
  if (!order) return NextResponse.json({ success: false, error: 'Lab order not found' }, { status: 404 })

  let updateCount = 0

  if (body.action === 'collect') {
    if (!['LAB_TECHNICIAN', 'ADMIN'].includes(role || '')) {
      return NextResponse.json({ success: false, error: 'Only lab technicians can record sample collection' }, { status: 403 })
    }
    // Guarded update: only an order that is still ORDERED can be collected
    const result = await prisma.labOrder.updateMany({
      where: { id: params.id, status: 'ORDERED' },
      data: { status: 'COLLECTED', collectedAt: new Date(), collectedById: actorId },
    })
    updateCount = result.count
  } else if (body.action === 'cancel') {
    if (!['DOCTOR', 'ADMIN'].includes(role || '')) {
      return NextResponse.json({ success: false, error: 'Only doctors can cancel lab orders' }, { status: 403 })
    }
    const result = await prisma.labOrder.updateMany({
      where: { id: params.id, status: 'ORDERED' },
      data: { status: 'CANCELLED' },
    })
    updateCount = result.count
  } else {
    if (!['DOCTOR', 'ADMIN'].includes(role || '')) {
      return NextResponse.json({ success: false, error: 'Only doctors can review lab results' }, { status: 403 })
    }
    const result = await prisma.labOrder.updateMany({
      where: { id: params.id, status: 'COMPLETED', reviewedAt: null },
      data: {
        reviewedAt: new Date(),
        reviewedById: actorId,
        doctorComment: body.doctorComment || null,
      },
    })
    updateCount = result.count
  }

  if (updateCount !== 1) {
    return NextResponse.json(
      { success: false, error: `This order can't be changed that way right now (it is ${order.status.toLowerCase()})` },
      { status: 409 }
    )
  }

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: order.patientId,
    action: 'EDIT',
    resourceType: 'LAB_ORDER',
    resourceId: order.id,
    details: { action: body.action },
    ...getRequestMeta(request),
  })

  const updated = await prisma.labOrder.findUnique({ where: { id: params.id }, include: LAB_ORDER_INCLUDE })
  return NextResponse.json({ success: true, data: updated })
}
