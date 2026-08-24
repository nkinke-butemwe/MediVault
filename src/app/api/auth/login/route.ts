// src/app/api/auth/login/route.ts
// Handles user login: validates credentials, issues a JWT cookie

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/src/lib/prisma'
import { signToken, setAuthCookie } from '@/src/lib/auth'
import { LoginSchema } from '@/src/lib/validators'
import { checkRateLimit } from '@/src/lib/rate-limit'
import { appLogger } from '@/src/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // ── Step 1: Rate limiting ─────────────────────────────────────────────
    // Use the IP address as the rate limit key to prevent brute-force attacks
    const forwarded = request.headers.get('x-forwarded-for')
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

    const rateLimit = checkRateLimit(`login:${ipAddress}`)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many login attempts. Please try again in ${rateLimit.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      )
    }

    // ── Step 2: Parse and validate the request body ───────────────────────
    const body = await request.json()
    const validation = LoginSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const { identifier, password, role } = validation.data

    // ── Step 3: Look up the user by email OR student number ───────────────
    // The identifier field accepts either format
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { studentNumber: identifier },
        ],
      },
    })

    // Use a generic error message to avoid revealing whether the email exists
    // (This is a security best practice to prevent user enumeration attacks)
    const INVALID_CREDENTIALS_MSG = 'Invalid credentials. Please check your email/student number and password.'

    if (!user) {
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MSG }, { status: 401 })
    }

    // ── Step 4: Check if the account is active ────────────────────────────
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'This account has been deactivated. Please contact the administrator.' },
        { status: 403 }
      )
    }

    // ── Step 5: Verify the role matches ───────────────────────────────────
    // Users must select the correct role to login (extra security layer)
    if (user.role !== role) {
      return NextResponse.json(
        { success: false, error: 'The selected role does not match this account.' },
        { status: 401 }
      )
    }

    // ── Step 6: Verify the password ───────────────────────────────────────
    const passwordMatches = await bcrypt.compare(password, user.passwordHash)
    if (!passwordMatches) {
      return NextResponse.json({ success: false, error: INVALID_CREDENTIALS_MSG }, { status: 401 })
    }

    // ── Step 7: Create a JWT and set the httpOnly cookie ──────────────────
    const token = await signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    })

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        studentNumber: user.studentNumber,
      },
      message: 'Login successful',
    })

    // Store the token in an httpOnly cookie
    setAuthCookie(response, token)

    appLogger.info({ userId: user.id, role: user.role }, 'User logged in')

    return response
  } catch (error) {
    appLogger.error({ error }, 'Login error')
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
