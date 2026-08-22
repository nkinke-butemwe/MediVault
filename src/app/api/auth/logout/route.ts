// src/app/api/auth/logout/route.ts
// Clears the auth cookie, effectively logging the user out

import { NextResponse } from 'next/server'
import { clearAuthCookie } from '@/src/lib/auth'

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' })
  clearAuthCookie(response)
  return response
}
