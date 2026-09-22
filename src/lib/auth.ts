// src/lib/auth.ts
// JWT authentication utilities — sign tokens, verify them, and manage httpOnly cookies

import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { JWTPayload, Role } from '@/src/types'
import {
  AUTH_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  signToken,
  verifyToken,
} from '@/src/lib/jwt'

// Token signing/verifying lives in src/lib/jwt.ts (so the Edge middleware can
// use it too). Re-exported here so existing imports keep working.
export { AUTH_COOKIE_NAME, signToken, verifyToken }

// ─── Cookie Management ────────────────────────────────────────────────────

// Reads the JWT from the request cookie (used in API routes and middleware)
export async function getTokenFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// Reads the JWT from the server-side cookie store (used in Server Components and API routes)
export async function getCurrentUser(): Promise<JWTPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// The one way API routes find out WHO is calling and WHAT ROLE they have.
//
// It verifies the JWT signature from the cookie. It deliberately does not
// trust x-user-* request headers (a client can send any header it likes) and
// never decodes the token without verifying it.
//
// Not logged in / forged / expired token  ->  { role: null, actorId: 'system' }
// so every route's existing "is this role allowed?" check simply says no.
export async function getRoleAndActor(
  request: NextRequest
): Promise<{ role: Role | null; actorId: string }> {
  const user = await getTokenFromRequest(request)
  if (!user) return { role: null, actorId: 'system' }
  return { role: user.role, actorId: user.userId }
}

// Sets the auth cookie by writing the raw Set-Cookie header directly.
// We bypass response.cookies.set() because on Next.js 14 + Windows,
// that method sometimes silently drops the cookie when there is also
// a JSON body in the same response. Writing the header string directly
// is the most reliable cross-platform approach.
export function setAuthCookie(response: NextResponse, token: string): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production'

  // Build the Set-Cookie string manually so we control every attribute exactly
  const cookieParts = [
    `${AUTH_COOKIE_NAME}=${token}`,
    `Max-Age=${SESSION_DURATION_SECONDS}`,
    'Path=/',
    'HttpOnly',        // JavaScript cannot read this cookie (XSS protection)
    'SameSite=Lax',    // Sent on same-site and top-level navigations (CSRF protection)
  ]

  // Only require HTTPS in production — dev runs over plain HTTP on localhost
  if (isProduction) {
    cookieParts.push('Secure')
  }

  response.headers.set('Set-Cookie', cookieParts.join('; '))
  return response
}

// Clears the auth cookie by overwriting it with an empty value and Max-Age=0
export function clearAuthCookie(response: NextResponse): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production'

  const cookieParts = [
    `${AUTH_COOKIE_NAME}=`,  // Empty value replaces the token
    'Max-Age=0',              // Tell the browser to delete this cookie immediately
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (isProduction) {
    cookieParts.push('Secure')
  }

  response.headers.set('Set-Cookie', cookieParts.join('; '))
  return response
}
