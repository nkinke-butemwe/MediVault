// src/lib/lab-include.ts
// The Prisma "include" used by every lab order endpoint, so all responses have
// the same shape. (It lives here, not in a route file, because Next.js only
// allows route files to export HTTP handlers.)

// Shared include so every response has the same shape
export const LAB_ORDER_INCLUDE = {
  patient: { select: { id: true, fullName: true, studentNumber: true, email: true } },
  orderedBy: { select: { id: true, fullName: true } },
  collectedBy: { select: { id: true, fullName: true } },
  completedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  items: {
    include: { test: { select: { id: true, code: true, name: true, category: true, allowedResults: true } } },
    orderBy: { test: { name: 'asc' as const } },
  },
} as const
