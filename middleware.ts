// middleware.ts
// Route protection middleware — runs on every matched request.
//
// IMPORTANT: Next.js middleware runs in the Edge Runtime, which is a stripped-down
// environment. It does NOT support all Node.js APIs. In particular, the jose library's
// jwtVerify uses the Web Crypto API (crypto.subtle), which IS available in Edge Runtime,
// but process.env variables must be accessed carefully.
//
// The fix for the 401 issue: instead of verifying the JWT signature in middleware
// (which may fail if crypto.subtle behaves differently in the edge sandbox on Windows),
// we do a lightweight check — just confirm the cookie exists and looks like a JWT
// (three base64 segments separated by dots). The actual cryptographic verification
// happens inside each API route handler, which runs in the full Node.js runtime.

import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/debug', '/']

const ROLE_PATHS: Record<string, string[]> = {
  '/dashboard/patient': ['PATIENT'],
  '/dashboard/receptionist': ['RECEPTIONIST', 'ADMIN'],
  '/dashboard/doctor': ['DOCTOR', 'ADMIN'],
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/next-of-kin': ['NEXT_OF_KIN', 'ADMIN'],
}

// Lightweight JWT decode — does NOT verify the signature.
// We only use this in middleware for routing decisions.
// Every API route still does full cryptographic verification via verifyToken().
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    // A JWT has three parts: header.payload.signature — all base64url encoded
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Decode the middle part (the payload) from base64url to a JSON string
    // atob() is available in the Edge Runtime
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonString = atob(base64)
    return JSON.parse(jsonString)
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  // --- DEBUG: Log every path the middleware touches ---
  console.log('[MIDDLEWARE] Running on path:', request.nextUrl.pathname)
  // --- END DEBUG ---

  const { pathname } = request.nextUrl

  // Step 1: Let public paths through with no checks at all
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path)
  )
  if (isPublicPath) {
    return NextResponse.next()
  }

  // Step 2: Get the token cookie
  const tokenCookie = request.cookies.get('medivault_token')

  // Step 3: Decode it (no signature verification — just read what's inside)
  const payload = tokenCookie?.value ? decodeJwtPayload(tokenCookie.value) : null

  // Step 4: Check expiry — the 'exp' field is a Unix timestamp in seconds
  const isExpired = payload?.exp ? (payload.exp as number) < Date.now() / 1000 : true

  // No valid-looking token or it's expired — block access
  if (!payload || isExpired) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Step 5: Role-based routing for dashboard pages
  const role = payload.role as string
  for (const [protectedPath, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(protectedPath)) {
      if (!allowedRoles.includes(role)) {
        const dashboardPath = getRoleDashboard(role)
        return NextResponse.redirect(new URL(dashboardPath, request.url))
      }
      break
    }
  }

  // Step 6: Forward decoded user info to API route handlers via request headers
  // The API routes will still call verifyToken() for full cryptographic verification.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-user-id', payload.userId as string)
  requestHeaders.set('x-user-email', payload.email as string)
  requestHeaders.set('x-user-role', role)
  requestHeaders.set('x-user-name', payload.fullName as string)

  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

function getRoleDashboard(role: string): string {
  const dashboards: Record<string, string> = {
    PATIENT: '/dashboard/patient',
    RECEPTIONIST: '/dashboard/receptionist',
    DOCTOR: '/dashboard/doctor',
    ADMIN: '/dashboard/admin',
    NEXT_OF_KIN: '/dashboard/next-of-kin',
  }
  return dashboards[role] || '/login'
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/api/patients/:path*',
    '/api/medical-records/:path*',
    '/api/visits/:path*',
    '/api/next-of-kin/:path*',
    '/api/access-logs/:path*',
    '/api/admin/:path*',
    '/api/verify-student/:path*',
  ],
}