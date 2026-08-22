// src/lib/rate-limit.ts
// Simple in-memory rate limiter for the login endpoint.
// Prevents brute-force attacks by limiting to 5 attempts per 15 minutes per IP.
// Note: For multi-server production deployments, use Redis instead of in-memory storage.

// Each entry stores how many attempts have been made and when the window resets
interface RateLimitEntry {
  attempts: number
  resetAt: number // Unix timestamp in milliseconds
}

// In-memory store: maps IP address -> attempt data
const rateLimitStore = new Map<string, RateLimitEntry>()

// Configuration
const MAX_ATTEMPTS = 5           // Maximum allowed attempts in the window
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes in milliseconds

// Checks if a given key (usually an IP address) has exceeded the rate limit.
// Returns { allowed: true } if the request can proceed,
// or { allowed: false, retryAfterSeconds } if the limit is exceeded.
export function checkRateLimit(key: string): {
  allowed: boolean
  remainingAttempts?: number
  retryAfterSeconds?: number
} {
  const now = Date.now()
  const entry = rateLimitStore.get(key)

  if (!entry || now > entry.resetAt) {
    // No previous attempts, or the window has expired — start a fresh window
    rateLimitStore.set(key, {
      attempts: 1,
      resetAt: now + WINDOW_MS,
    })
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS - 1 }
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    // Limit exceeded — tell the client how long to wait
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000)
    return { allowed: false, retryAfterSeconds }
  }

  // Increment the attempt counter
  entry.attempts += 1
  rateLimitStore.set(key, entry)

  return { allowed: true, remainingAttempts: MAX_ATTEMPTS - entry.attempts }
}

// Cleans up expired entries to prevent memory leaks.
// In a real app, you might run this on a schedule (e.g., every hour).
export function cleanupRateLimitStore(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}
