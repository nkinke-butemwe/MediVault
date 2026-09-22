// src/lib/jwt.ts
// Signing and verifying the session JWT — and NOTHING else.
//
// Why this is its own file:
//   middleware.ts runs in Next.js's Edge runtime, and src/lib/auth.ts imports
//   'next/headers' (server-only). Keeping the token code here lets BOTH the
//   middleware and the API routes verify the token's signature with the same
//   function, without dragging server-only imports into the middleware.
//
// Rule for the whole project: never read a role or user id out of a token
// without going through verifyToken(). Decoding the payload by hand (atob)
// does NOT check the signature, so anyone could forge it.

import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload, Role } from '@/src/types'

// The cookie name used to store the JWT
export const AUTH_COOKIE_NAME = 'medivault_token'

// Session duration: 8 hours (in seconds)
export const SESSION_DURATION_SECONDS = 8 * 60 * 60

// Get the JWT secret as a Uint8Array (required by the jose library)
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

// Creates a signed JWT containing the user's basic info.
// The token is stored in an httpOnly cookie so JavaScript cannot read it (XSS protection).
export async function signToken(payload: JWTPayload): Promise<string> {
  const secret = getJwtSecret()

  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(secret)
}

// Verifies a JWT (signature AND expiry) and returns the payload, or null if
// the token is missing, forged, tampered with, expired, or malformed.
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const secret = getJwtSecret()
    // Pin the algorithm so a token cannot pick a weaker one for itself
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] })

    // A validly signed token that is missing our fields is still useless
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.fullName !== 'string'
    ) {
      return null
    }

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as Role,
      fullName: payload.fullName,
    }
  } catch {
    // Token is expired, tampered with, or otherwise invalid
    return null
  }
}
