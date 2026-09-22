// tests/unit/middleware.test.ts
//
// Tests for middleware.ts — the gate in front of every dashboard page and API
// route. These tests exist because the middleware once (1) trusted any token
// whose payload it could base64-decode, without checking the signature, and
// (2) treated EVERY path as public, so it protected nothing.

import { describe, it, expect, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

const SECRET = 'test-only-secret-do-not-use-in-production'

beforeAll(() => {
  process.env.JWT_SECRET = SECRET
})

import { middleware } from '@/src/middleware'
import { signToken } from '@/src/lib/jwt'

const BASE = 'http://localhost:3000'

function requestTo(path: string, token?: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${path}`, {
    headers: { ...headers, ...(token ? { cookie: `medivault_token=${token}` } : {}) },
  })
}

async function tokenFor(role: string) {
  return signToken({ userId: 'u1', email: 'u1@unza.zm', role: role as never, fullName: 'Test User' })
}

// Builds a token exactly like the real one but signed with a different secret
async function tokenSignedWith(secret: string, role: string, expires: string | number = '1h') {
  return new SignJWT({ userId: 'u1', email: 'u1@unza.zm', role, fullName: 'Attacker' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(new TextEncoder().encode(secret))
}

// A token with a made-up signature: header.payload.garbage. This is what an
// attacker can write by hand, and what the old middleware accepted.
function forgedToken(role: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const payload = { userId: 'x', email: 'x@x', role, fullName: 'x', exp: 9999999999 }
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.not-a-real-signature`
}

const isPassThrough = (res: Response) => res.headers.get('x-middleware-next') === '1'
const redirectTarget = (res: Response) => {
  const location = res.headers.get('location')
  return location ? new URL(location).pathname : null
}

describe('middleware: forged and invalid tokens are rejected', () => {
  it('rejects a hand-made token with a fake signature (API route -> 401)', async () => {
    const res = await middleware(requestTo('/api/admin/users', forgedToken('ADMIN')))
    expect(res.status).toBe(401)
  })

  it('rejects a hand-made token on a dashboard page (redirects to /login)', async () => {
    const res = await middleware(requestTo('/dashboard/admin', forgedToken('ADMIN')))
    expect(redirectTarget(res)).toBe('/login')
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await tokenSignedWith('some-other-secret-entirely', 'ADMIN')
    const res = await middleware(requestTo('/api/admin/users', token))
    expect(res.status).toBe(401)
  })

  it('rejects an expired token', async () => {
    const token = await tokenSignedWith(SECRET, 'ADMIN', Math.floor(Date.now() / 1000) - 60)
    const res = await middleware(requestTo('/api/admin/users', token))
    expect(res.status).toBe(401)
  })

  it('rejects an unsigned token (alg: none)', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: 'x', email: 'x', role: 'ADMIN', fullName: 'x' })}.`
    const res = await middleware(requestTo('/api/admin/users', token))
    expect(res.status).toBe(401)
  })

  it('does not trust an x-user-role header sent by the client', async () => {
    const res = await middleware(requestTo('/api/admin/users', undefined, { 'x-user-role': 'ADMIN', 'x-user-id': 'x' }))
    expect(res.status).toBe(401)
  })
})

describe('middleware: protects routes (it is not switched off)', () => {
  it('sends a visitor with no cookie from a dashboard to /login', async () => {
    const res = await middleware(requestTo('/dashboard/patient'))
    expect(redirectTarget(res)).toBe('/login')
  })

  it('returns 401 for a protected API route with no cookie', async () => {
    for (const path of ['/api/patients', '/api/prescriptions', '/api/pharmacy/inventory', '/api/lab/orders']) {
      const res = await middleware(requestTo(path))
      expect(res.status, path).toBe(401)
    }
  })

  it('leaves the home page, login page and login API public', async () => {
    for (const path of ['/', '/login', '/api/auth/login']) {
      const res = await middleware(requestTo(path))
      expect(isPassThrough(res), path).toBe(true)
    }
  })

  it('does not treat a lookalike path as public', async () => {
    const res = await middleware(requestTo('/loginx/../dashboard'))
    // Anything that is not exactly a public path needs a cookie
    expect(isPassThrough(res)).toBe(false)
  })
})

describe('middleware: role based access to dashboards', () => {
  it('lets a genuine token through to its own dashboard', async () => {
    const res = await middleware(requestTo('/dashboard/patient', await tokenFor('PATIENT')))
    expect(isPassThrough(res)).toBe(true)
  })

  it('sends a patient away from the admin dashboard to the patient one', async () => {
    const res = await middleware(requestTo('/dashboard/admin/users', await tokenFor('PATIENT')))
    expect(redirectTarget(res)).toBe('/dashboard/patient')
  })

  it('lets a lab technician into the lab dashboard but not the doctor one', async () => {
    const token = await tokenFor('LAB_TECHNICIAN')
    expect(isPassThrough(await middleware(requestTo('/dashboard/lab', token)))).toBe(true)
    expect(redirectTarget(await middleware(requestTo('/dashboard/doctor', token)))).toBe('/dashboard/lab')
  })

  it('keeps doctors out of the lab technician dashboard', async () => {
    const res = await middleware(requestTo('/dashboard/lab', await tokenFor('DOCTOR')))
    expect(redirectTarget(res)).toBe('/dashboard/doctor')
  })

  it('lets an admin open staff dashboards', async () => {
    const token = await tokenFor('ADMIN')
    for (const path of ['/dashboard/doctor', '/dashboard/pharmacy', '/dashboard/lab']) {
      expect(isPassThrough(await middleware(requestTo(path, token))), path).toBe(true)
    }
  })
})
