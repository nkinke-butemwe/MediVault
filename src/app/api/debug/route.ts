// src/app/api/auth/me/route.ts
// Returns the currently authenticated user's details.
// This route reads and verifies the JWT cookie directly — it does NOT rely on
// middleware-injected headers, because custom headers set in middleware's
// NextResponse.next() can be stripped in certain Next.js Edge Runtime configurations.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'
import { verifyToken, AUTH_COOKIE_NAME } from '@/src/lib/auth'

export async function GET(request: NextRequest) {
  // Step 1: Read the token directly from the cookie on this request
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'No session token found' },
      { status: 401 }
    )
  }

  // Step 2: Cryptographically verify the token using the JWT_SECRET
  // This runs in the Node.js runtime so jose works correctly here
  const payload = await verifyToken(token)

  if (!payload) {
    return NextResponse.json(
      { success: false, error: 'Session token is invalid or expired' },
      { status: 401 }
    )
  }

  // Step 3: Fetch fresh user data from the database
  // We don't just return what's in the token — we fetch live data so that
  // deactivated accounts, name changes etc. are reflected immediately
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

  if (!user || !user.isActive) {
    return NextResponse.json(
      { success: false, error: 'User account not found or has been deactivated' },
      { status: 401 }
    )
  }

  return NextResponse.json({ success: true, data: user })
}
