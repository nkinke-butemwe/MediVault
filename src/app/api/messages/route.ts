// src/app/api/messages/route.ts
// Secure messaging between ONE patient and the doctors who treat them.
//
// GET  /api/messages            — your conversations (who you've talked to, last message, unread count)
// GET  /api/messages?with=<id>  — the full thread with that person (and marks their messages as read)
// POST /api/messages            — send a message { recipientId, body }
//
// Privacy rules enforced here:
//   - a patient can only message a doctor on their care team (see src/lib/care-team.ts)
//   - a doctor can only message a patient they treat
//   - nobody else (receptionist, pharmacist, ...) can use messaging at all
//   - a doctor opening a thread is written to the access log, like any other view of patient data

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { getRoleAndActor } from '@/src/lib/auth'
import { SendMessageSchema } from '@/src/lib/validators'
import { getCareTeamDoctorIds, isInCareTeam } from '@/src/lib/care-team'
import { notifyUser } from '@/src/lib/notifications'
import { logAccess, getRequestMeta } from '@/src/lib/logger'

// Builds the pair of ids that identifies a thread, whoever is asking.
// If the caller is a patient, the partner is the doctor, and the other way round.
function threadIds(role: string, actorId: string, partnerId: string) {
  return role === 'PATIENT'
    ? { patientId: actorId, doctorId: partnerId }
    : { patientId: partnerId, doctorId: actorId }
}

export async function GET(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)

  if (role !== 'PATIENT' && role !== 'DOCTOR') {
    return NextResponse.json({ success: false, error: 'Messaging is for patients and their doctors' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const partnerId = searchParams.get('with')

  // ── One thread ───────────────────────────────────────────────────────────
  if (partnerId) {
    const ids = threadIds(role, actorId, partnerId)

    const messages = await prisma.message.findMany({
      where: ids,
      orderBy: { createdAt: 'asc' },
      take: 200,
      include: { sender: { select: { id: true, fullName: true } } },
    })

    // A thread that has no messages yet can only be opened for a real care-team pair
    if (messages.length === 0) {
      const allowed = await isInCareTeam(ids.patientId, ids.doctorId)
      if (!allowed) {
        return NextResponse.json({ success: false, error: 'You can only message your own care team' }, { status: 403 })
      }
    }

    // Opening the thread means the messages from the other person have now been read
    await prisma.message.updateMany({
      where: { ...ids, senderId: partnerId, readAt: null },
      data: { readAt: new Date() },
    })

    if (role === 'DOCTOR') {
      await logAccess({
        accessedByUserId: actorId,
        targetPatientId: ids.patientId,
        action: 'VIEW',
        resourceType: 'MESSAGE',
        details: { messageCount: messages.length },
        ...getRequestMeta(request),
      })
    }

    return NextResponse.json({ success: true, data: messages })
  }

  // ── The list of conversations ────────────────────────────────────────────
  const mine = role === 'PATIENT' ? { patientId: actorId } : { doctorId: actorId }
  const recent = await prisma.message.findMany({
    where: mine,
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  // Group the messages by the OTHER person in the thread
  const partners = new Map<string, { lastBody: string; lastAt: Date; unread: number }>()
  for (const message of recent) {
    const otherId = role === 'PATIENT' ? message.doctorId : message.patientId
    // "recent" is newest-first, so the first message we meet for a partner is their last one
    const entry = partners.get(otherId) ?? { lastBody: message.body, lastAt: message.createdAt, unread: 0 }
    if (message.senderId !== actorId && message.readAt === null) entry.unread += 1
    partners.set(otherId, entry)
  }

  // A patient should also see their care-team doctors they haven't written to yet,
  // so they know who they can message.
  if (role === 'PATIENT') {
    const careTeam = await getCareTeamDoctorIds(actorId)
    for (const doctorId of careTeam) {
      if (!partners.has(doctorId)) partners.set(doctorId, { lastBody: '', lastAt: new Date(0), unread: 0 })
    }
  }

  const people = await prisma.user.findMany({
    where: { id: { in: Array.from(partners.keys()) }, isActive: true },
    select: { id: true, fullName: true },
  })

  const conversations = people
    .map((person) => {
      const entry = partners.get(person.id)!
      return {
        partner: person,
        lastMessage: entry.lastBody || null,
        lastMessageAt: entry.lastBody ? entry.lastAt : null,
        unreadCount: entry.unread,
      }
    })
    .sort((a, b) => (b.lastMessageAt?.getTime() ?? 0) - (a.lastMessageAt?.getTime() ?? 0))

  return NextResponse.json({ success: true, data: conversations })
}

export async function POST(request: NextRequest) {
  const { role, actorId } = await getRoleAndActor(request)

  if (role !== 'PATIENT' && role !== 'DOCTOR') {
    return NextResponse.json({ success: false, error: 'Messaging is for patients and their doctors' }, { status: 403 })
  }

  const validation = SendMessageSchema.safeParse(await request.json())
  if (!validation.success) {
    return NextResponse.json(
      { success: false, error: validation.error.issues[0]?.message ?? 'Invalid message' },
      { status: 400 }
    )
  }
  const { recipientId, body } = validation.data

  // The recipient must be an active user of the OPPOSITE role
  const recipient = await prisma.user.findFirst({
    where: { id: recipientId, role: role === 'PATIENT' ? 'DOCTOR' : 'PATIENT', isActive: true },
    select: { id: true, fullName: true },
  })
  if (!recipient) {
    return NextResponse.json({ success: false, error: 'Recipient not found' }, { status: 404 })
  }

  const ids = threadIds(role, actorId, recipientId)
  const allowed = await isInCareTeam(ids.patientId, ids.doctorId)
  if (!allowed) {
    return NextResponse.json({ success: false, error: 'You can only message your own care team' }, { status: 403 })
  }

  const message = await prisma.message.create({
    data: { ...ids, senderId: actorId, body },
    include: { sender: { select: { id: true, fullName: true } } },
  })

  await logAccess({
    accessedByUserId: actorId,
    targetPatientId: ids.patientId,
    action: 'CREATE',
    resourceType: 'MESSAGE',
    resourceId: message.id,
    ...getRequestMeta(request),
  })

  // The notification says WHO wrote, never what was written
  await notifyUser(recipientId, {
    type: 'NEW_MESSAGE',
    title: 'New message',
    body: `From ${message.sender.fullName}`,
    link: role === 'PATIENT' ? '/dashboard/doctor#messages' : '/dashboard/patient#messages',
  })

  return NextResponse.json({ success: true, data: message }, { status: 201 })
}
