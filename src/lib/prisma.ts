// src/lib/prisma.ts
// Prisma client singleton — prevents creating multiple connections during development hot-reload

import { PrismaClient } from '@prisma/client'

// We use a global variable to preserve the Prisma connection across
// Next.js hot reloads in development. In production, we just create one instance.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

// In development, save the client on globalThis so it survives hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
