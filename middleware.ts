// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/api/debug', '/']

const ROLE_PATHS: Record<string, string[]> = {
  '/dashboard/patient': ['PATIENT'],
  '/dashboard/receptionist': ['RECEPTIONIST', 'ADMIN'],
  '/dashboard/doctor': ['DOCTOR', 'ADMIN'],
  '/dashboard/admin': ['ADMIN'],
  '/dashboard/next-of-kin': ['NEXT_OF_KIN', 'ADMIN'],
  '/dashboard/pharmacy': ['PHARMACIST', 'ADMIN'],
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonString = atob(base64)
    return JSON.parse(jsonString)
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  console.log('[MIDDLEWARE] Running on path:', request.nextUrl.pathname)

  const { pathname } = request.nextUrl

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path)
  )
  if (isPublicPath) {
    return NextResponse.next()
  }

  const tokenCookie = request.cookies.get('medivault_token')
  const payload = tokenCookie?.value ? decodeJwtPayload(tokenCookie.value) : null
  const isExpired = payload?.exp ? (payload.exp as number) < Date.now() / 1000 : true

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
    PHARMACIST: '/dashboard/pharmacy',
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
    '/api/prescriptions/:path*',
    '/api/pharmacy/:path*',
  ],
}