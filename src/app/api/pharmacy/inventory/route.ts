// src/app/api/pharmacy/inventory/route.ts
// GET /api/pharmacy/inventory — list all drugs
// POST /api/pharmacy/inventory — add a new drug

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

function getRoleAndActor(request: NextRequest) {
  let role = request.headers.get('x-user-role')
  let actorId = request.headers.get('x-user-id') ?? 'system'
  if (!role) {
    const token = request.cookies.get('medivault_token')?.value
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        role = payload.role
        actorId = payload.userId ?? 'system'
      } catch {}
    }
  }
  return { role, actorId }
}

export async function GET(request: NextRequest) {
  const { role } = getRoleAndActor(request)

  if (!['PHARMACIST', 'ADMIN', 'DOCTOR'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const drugs = await prisma.drugInventory.findMany({
    orderBy: { drugName: 'asc' },
    include: {
      updatedBy: { select: { fullName: true } },
    },
  })

  return NextResponse.json({ success: true, data: drugs })
}

export async function POST(request: NextRequest) {
  const { role, actorId } = getRoleAndActor(request)

  if (!['PHARMACIST', 'ADMIN'].includes(role || '')) {
    return NextResponse.json({ success: false, error: 'Only pharmacists can manage inventory' }, { status: 403 })
  }

  const body = await request.json()
  const { drugName, genericName, quantity, unit, expiryDate, reorderLevel } = body

  if (!drugName || quantity === undefined || !unit) {
    return NextResponse.json({ success: false, error: 'drugName, quantity, and unit are required' }, { status: 400 })
  }

  const drug = await prisma.drugInventory.create({
    data: {
      drugName,
      genericName: genericName || null,
      quantity: parseInt(quantity),
      unit,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      reorderLevel: reorderLevel ? parseInt(reorderLevel) : 10,
      updatedById: actorId,
    },
  })

  return NextResponse.json({ success: true, data: drug }, { status: 201 })
}