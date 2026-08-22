// src/lib/auth.ts
// JWT authentication utilities — sign tokens, verify them, and manage httpOnly cookies

import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { JWTPayload, Role } from '@/src/types'

// The cookie name used to store the JWT
export const AUTH_COOKIE_NAME = 'medivault_token'

// Session duration: 8 hours (in seconds)
const SESSION_DURATION_SECONDS = 8 * 60 * 60

// Get the JWT secret as a Uint8Array (required by the jose library)
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

// ─── Token Creation ────────────────────────────────────────────────────────

// Creates a signed JWT containing the user's basic info
// This token is stored in an httpOnly cookie so JavaScript cannot read it (XSS protection)
export async function signToken(payload: JWTPayload): Promise<string> {
  const secret = getJwtSecret()

  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret)

  return token
}

// ─── Token Verification ────────────────────────────────────────────────────

// Verifies a JWT token and returns the decoded payload, or null if invalid/expired
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret)

    // Pull the fields we care about out of the generic payload object
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
      fullName: payload.fullName as string,
    }
  } catch {
    // Token is expired, tampered with, or otherwise invalid
    return null
  }
}

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
