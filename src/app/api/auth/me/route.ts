// src/app/api/auth/me/route.ts
// Returns the currently authenticated user's details.
// This route is self-contained — it reads and verifies the JWT cookie directly.
// We do NOT rely on middleware-injected headers because those get stripped
// in Next.js 14 Edge Runtime on Windows.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { verifyToken, AUTH_COOKIE_NAME } from '@/src/lib/auth'

export async function GET(request: NextRequest) {
  // Step 1: Read the cookie from the incoming request
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  // If there's no cookie at all, the user is not logged in
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'No session token found' },
      { status: 401 }
    )
  }

  // Step 2: Cryptographically verify the token using our secret key
  // verifyToken() uses jose in the full Node.js runtime (not Edge), so it works correctly
  const payload = await verifyToken(token)

  // If verification fails (wrong signature, expired, malformed), reject
  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Session token is invalid or expired' },
      { status: 401 }
    )
  }

  // Step 3: Fetch fresh user data from the database
  // We don't just trust what's in the token — we re-fetch so we get
  // the latest isActive status, name changes, etc.
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      studentNumber: true,
      role: true,
      fullName: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  })

  // If the user was deleted or deactivated since the token was issued, block them
  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, error: 'User not found or deactivated' },
      { status: 401 }
    )
  }

  // Step 4: Return the user data
  return NextResponse.json({ success: true, data: user })
}