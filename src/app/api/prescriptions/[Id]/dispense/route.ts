// src/app/api/prescriptions/[id]/dispense/route.ts
// POST /api/prescriptions/:id/dispense — pharmacist marks a prescription as dispensed
//
// Dispensing now does three things TOGETHER, in one database transaction:
//   1. claims the prescription (PENDING -> DISPENSED) — only one request can win
//   2. takes the prescribed quantities out of the drug inventory
//   3. rolls everything back if any drug is out of stock / expired
// The folder is named [id] (lowercase) so that params.id below is actually set.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { logAccess, getRequestMeta } from '@/src/lib/logger'
import { getRoleAndActor } from '@/src/lib/auth'
import { parsePrescribedItems, planStockDeductions } from '@/src/lib/pharmacy'

// Thrown inside the transaction to abort it with a message the pharmacist can read
class DispenseError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { role, actorId } = await getRoleAndActor(request)

  if (!['PHARMACIST', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only pharmacists can dispense prescriptions' }, { status: 403 })
  }

  const prescription = await prisma.prescription.findUnique({ where: { id: params.id } })
  if (!prescription) return NextResponse.json({ success: false, error: 'Prescription not found' }, { status: 404 })
  if (prescription.status !== 'PENDING') {
    return NextResponse.json({ success: false, error: `Prescription is already ${prescription.status.toLowerCase()}` }, { status: 400 })
  }

  try {
    const { updated, deductions, warnings } = await prisma.$transaction(async (tx) => {
      // Step 1: claim it. If another pharmacist got here first, count is 0.
      const claimed = await tx.prescription.updateMany({
        where: { id: params.id, status: 'PENDING' },
        data: { status: 'DISPENSED', pharmacistId: actorId, dispensedAt: new Date() },
      })
      if (claimed.count !== 1) {
        throw new DispenseError('Prescription was already processed by someone else', 409)
      }

      // Step 2: work out which inventory rows to take stock from
      const items = parsePrescribedItems(prescription.medications)
      const inventory = await tx.drugInventory.findMany()
      const plan = planStockDeductions(items, inventory)
      if (!plan.ok) {
        throw new DispenseError(plan.problems.join(' '), 409)
      }

      // Step 3: take the stock. The "gte" guard means we never go below zero,
      // even if two prescriptions are dispensed at the same moment.
      for (const d of plan.deductions) {
        const result = await tx.drugInventory.updateMany({
          where: { id: d.inventoryId, quantity: { gte: d.quantity } },
          data: { quantity: { decrement: d.quantity }, updatedById: actorId },
        })
        if (result.count !== 1) {
          throw new DispenseError(`Stock for ${d.drugName} changed while dispensing. Please try again.`, 409)
        }
      }

      const updated = await tx.prescription.findUniqueOrThrow({
        where: { id: params.id },
        include: {
          patient: { select: { id: true, fullName: true, email: true } },
          doctor: { select: { id: true, fullName: true } },
          pharmacist: { select: { id: true, fullName: true } },
        },
      })
      return { updated, deductions: plan.deductions, warnings: plan.warnings }
    })

    await logAccess({
      accessedByUserId: actorId,
      targetPatientId: prescription.patientId,
      action: 'EDIT',
      resourceType: 'PRESCRIPTION',
      resourceId: params.id,
      details: { action: 'dispensed', stockTaken: deductions.map((d) => ({ drug: d.drugName, quantity: d.quantity })) },
      ...getRequestMeta(request),
    })

    return NextResponse.json({ success: true, data: updated, warnings })
  } catch (error) {
    if (error instanceof DispenseError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status })
    }
    throw error
  }
}
