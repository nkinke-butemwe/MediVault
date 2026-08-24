// src/app/api/admin/users/[id]/route.ts
// PUT /api/admin/users/:id — update any user (admin only)
// DELETE /api/admin/users/:id — deactivate a user (admin only)

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/src/lib/prisma'
import { UpdateUserSchema, ResetPasswordSchema } from '@/src/lib/validators'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  if (role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()

  // Check if this is a password reset request
  if (body.newPassword !== undefined) {
    const validation = ResetPasswordSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(validation.data.newPassword, 12)
    await prisma.user.update({
      where: { id: params.id },
      data: { passwordHash },
    })

    await logAccess({
      accessedByUserId: actorId,
      action: 'EDIT',
      resourceType: 'USER',
      resourceId: params.id,
      details: { action: 'password_reset' },
      ...getRequestMeta(request),
    })

    return NextResponse.json({ success: true, message: 'Password reset successfully' })
  }

  // Regular user update
  const validation = UpdateUserSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: 'Validation failed', details: validation.error.flatten() },
      { status: 400 }
    )
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      email: validation.data.email,
      fullName: validation.data.fullName,
      phone: validation.data.phone,
      isActive: validation.data.isActive,
      role: validation.data.role,
    },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      isActive: true,
      updatedAt: true,
    },
  })

  await logAccess({
    accessedByUserId: actorId,
    action: 'EDIT',
    resourceType: 'USER',
    resourceId: params.id,
    details: { updatedFields: Object.keys(validation.data) },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: user })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const role = request.headers.get('x-user-role')
  const actorId = request.headers.get('x-user-id')!

  if (role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
  }

  // Prevent admin from deleting themselves
  if (params.id === actorId) {
    return NextResponse.json(
      { success: false, error: 'You cannot deactivate your own account' },
      { status: 400 }
    )
  }

  // We soft-delete by setting isActive = false, not actually deleting the record
  // This preserves the audit trail and medical history
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { isActive: false },
    select: { id: true, email: true, fullName: true, isActive: true },
  })

  await logAccess({
    accessedByUserId: actorId,
    action: 'DELETE',
    resourceType: 'USER',
    resourceId: params.id,
    details: { action: 'deactivated', email: user.email },
    ...getRequestMeta(request),
  })

  return NextResponse.json({ success: true, data: user, message: 'User deactivated successfully' })
}
