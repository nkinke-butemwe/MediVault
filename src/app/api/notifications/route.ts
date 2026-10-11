// src/app/api/notifications/route.ts
// GET   /api/notifications — the logged-in user's latest notifications + how many are unread
// PATCH /api/notifications — mark some as read ({ ids: [...] }) or all of them ({ all: true })
// Every role can use this, but only ever for their OWN notifications.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { MarkNotificationsReadSchema } from '@/src/lib/validators'

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)
  if (!role) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: actorId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.notification.count({ where: { userId: actorId, readAt: null } }),
  ])

  return NextResponse.json({ success: true, data: { items, unreadCount } })
}

export async function PATCH(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)
  if (!role) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const validation = MarkNotificationsReadSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json({ success: false, error: 'Send { all: true } or { ids: [...] }' }, { status: 400 })
  }

  // "userId: actorId" means someone can never mark another person's notifications as read
  const where =
    'all' in validation.data
      ? { userId: actorId, readAt: null }
      : { userId: actorId, readAt: null, id: { in: validation.data.ids } }

  const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } })
  return NextResponse.json({ success: true, data: { updated: result.count } })
}
