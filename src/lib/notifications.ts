// src/lib/notifications.ts
// Creates the in-app notifications shown in the bell menu.
//
// Rule for this file: a notification is a "nice to have". If saving one fails,
// the real action (dispensing a prescription, releasing a lab result...) has
// already succeeded and must NOT be turned into an error. So these functions
// catch their own errors and never throw, the same way logAccess() does.

import { prisma } from './prisma'
import { appLogger } from './logger'
import type { Role } from '@/src/types'

// What a caller has to say about a notification (the recipient is added per call)
export interface NotificationContent {
  // Short machine-readable kind, e.g. "LAB_RESULT_READY". The bell uses it to pick an icon.
  type: string
  title: string
  body?: string | null
  // Where clicking the notification should go, e.g. "/dashboard/patient#labs"
  link?: string | null
}

// Sends one notification to one user.
export async function notifyUser(userId: string, content: NotificationContent): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId,
        type: content.type,
        title: content.title,
        body: content.body ?? null,
        link: content.link ?? null,
      },
    })
  } catch (error) {
    appLogger.error({ error, userId, type: content.type }, 'Failed to create notification')
  }
}

// Sends the same notification to every active user who has a given role,
// for example "all receptionists" when a patient requests an appointment.
export async function notifyRole(role: Role, content: NotificationContent): Promise<void> {
  try {
    const recipients = await prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true },
    })
    if (recipients.length === 0) return

    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        type: content.type,
        title: content.title,
        body: content.body ?? null,
        link: content.link ?? null,
      })),
    })
  } catch (error) {
    appLogger.error({ error, role, type: content.type }, 'Failed to notify role')
  }
}
