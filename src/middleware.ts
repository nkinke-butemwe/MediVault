// middleware.ts
// Route protection + role-based access control (RBAC).
//
// SECURITY NOTES
//  1. Every token is checked with verifyToken(), which validates the JWT
//     SIGNATURE and expiry. (An earlier version only base64-decoded the
//     payload, which does not prove the token is genuine — anyone could
//     forge one that says "role: ADMIN".)
//  2. PUBLIC_PATHS is matched exactly for '/', and by prefix only for the
//     other entries. (An earlier version prefix-matched '/', which matches
//     EVERY path and turned the whole middleware off.)
//  3. API routes do not trust anything this middleware sets — each one calls
//     getRoleAndActor() from src/lib/auth.ts and verifies the cookie itself.
//     The middleware is the first gate, not the only gate.

import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, verifyToken } from '@/src/lib/jwt'
import { ROLE_DASHBOARDS } from '@/src/lib/roles'
import type { Role } from '@/src/types'

// Paths anyone may open without logging in.
const PUBLIC_EXACT_PATHS = ['/']
const PUBLIC_PREFIX_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

// Which roles may open which dashboard (ADMIN can open the staff ones).
const ROLE_PATHS: Record<string, Role[]> = {
  '/dashboard/patient': ['PATIENT'],
  '/dashboard/receptionist': ['RECEPTIONIST', 'ADMIN'],
  '/dashboard/doctor': ['DOCTOR', 'ADMIN'],
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/next-of-kin': ['NEXT_OF_KIN', 'ADMIN'],
  '/dashboard/pharmacy': ['PHARMACIST', 'ADMIN'],
  '/dashboard/lab': ['LAB_TECHNICIAN', 'ADMIN'],
}

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    PUBLIC_PREFIX_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const tokenCookie = request.cookies.get(AUTH_COOKIE_NAME)
  // verifyToken checks the signature and the expiry; null means "not genuine"
  const user = tokenCookie?.value ? await verifyToken(tokenCookie.value) : null

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Dashboard pages: send people to their own dashboard if they wander into another role's.
  for (const [protectedPath, allowedRoles] of Object.entries(ROLE_PATHS)) {
    if (pathname === protectedPath || pathname.startsWith(`${protectedPath}/`)) {
      if (!allowedRoles.includes(user.role)) {
        const dashboardPath = ROLE_DASHBOARDS[user.role] || '/login'
        return NextResponse.redirect(new URL(dashboardPath, request.url))
      }
      break
    }
  }

  return NextResponse.next()
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
    '/api/prescriptions/:path*',
    '/api/pharmacy/:path*',
    '/api/lab/:path*',
  ],
}
