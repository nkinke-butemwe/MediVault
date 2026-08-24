// src/lib/logger.ts
// Access logging utility — records every access to patient data in the database.
//
// NOTE: We intentionally do NOT use pino-pretty here.
// pino-pretty spawns a Node.js worker thread for formatting. On Windows,
// Next.js's webpack bundler cannot resolve the worker file path inside
// .next/server/vendor-chunks/, which causes the worker to crash and
// kills the entire API route request. Using console.log avoids this entirely.

import { prisma } from './prisma'

// ─── Simple Application Logger ────────────────────────────────────────────────
// Wraps console.log/warn/error with a consistent format.
export const appLogger = {
  info: (data: Record<string, unknown>, message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[INFO] ${new Date().toISOString()} — ${message}`, data)
    }
  },
  warn: (data: Record<string, unknown>, message: string) => {
    console.warn(`[WARN] ${new Date().toISOString()} — ${message}`, data)
  },
  error: (data: Record<string, unknown>, message: string) => {
    console.error(`[ERROR] ${new Date().toISOString()} — ${message}`, data)
  },
}

// ─── Database Access Logger ────────────────────────────────────────────────

// Parameters for logging an access event
interface LogAccessParams {
  accessedByUserId: string          // Who performed the action
  targetPatientId?: string | null   // Whose data was accessed
  action: 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE'  // What was done
  resourceType: string              // What type of data: "MEDICAL_RECORD", "VISIT", etc.
  resourceId?: string | null        // The specific record's ID
  details?: Record<string, unknown> // Any extra context (stored as JSON)
  ipAddress?: string | null
  userAgent?: string | null
}

// Records an access event in the AccessLog table.
// This function is "fire-and-forget" — it does not throw errors that would block
// the main request. If logging fails, we just write an error to the app logger.
export async function logAccess(params: LogAccessParams): Promise<void> {
  try {
    await prisma.accessLog.create({
      data: {
        accessedByUserId: params.accessedByUserId,
        targetPatientId: params.targetPatientId ?? null,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ?? null,
        // Store the details object as a JSON string
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    })
  } catch (error) {
    // Log the error but don't let it crash the main request
    appLogger.error({ error, params }, 'Failed to write access log')
  }
}

// Helper: extracts IP and User-Agent from a Next.js Request object
// Makes it easy to pass these to logAccess without repeating this logic everywhere
export function getRequestMeta(request: Request): {
  ipAddress: string | null
  userAgent: string | null
} {
  const forwarded = request.headers.get('x-forwarded-for')
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : null
  const userAgent = request.headers.get('user-agent')
  return { ipAddress, userAgent }
}