// tests/unit/route-safety.test.ts
//
// Guards that read the source files themselves. They exist to stop specific,
// already-fixed mistakes from coming back:
//   - trusting a JWT without verifying it
//   - reading the caller's role from a request header
//   - the [Id] vs [id] folder-name mismatch that broke dispensing
//   - exporting non-handler names from a Next.js route file (breaks `next build`)
//   - a new API route that forgets to check who is calling

import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

const sourceFiles = [
  ...walk(path.join(ROOT, 'src')).filter((f) => /\.(ts|tsx)$/.test(f)),
  path.join(ROOT, 'src/middleware.ts'),
]
const routeFiles = walk(path.join(ROOT, 'src/app/api')).filter((f) => f.endsWith('route.ts'))
const rel = (f: string) => path.relative(ROOT, f)

describe('authentication is never done by hand', () => {
  it('nothing decodes a JWT payload with atob (that skips the signature check)', () => {
    const offenders = sourceFiles.filter((f) => /\batob\(/.test(fs.readFileSync(f, 'utf8'))).map(rel)
    expect(offenders).toEqual([])
  })

  it('no route reads x-user-role / x-user-id request headers', () => {
    const offenders = routeFiles
      .filter((f) => /headers\.get\(['"]x-user-(role|id)['"]\)/.test(fs.readFileSync(f, 'utf8')))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('there is no leftover /api/debug route', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/app/api/debug'))).toBe(false)
  })
})

describe('API routes', () => {
  // Routes that are allowed to work without a logged-in user, or that check the cookie themselves
  const NO_ROLE_CHECK = ['src/app/api/auth/login/route.ts', 'src/app/api/auth/logout/route.ts', 'src/app/api/auth/me/route.ts']

  it('every route asks getRoleAndActor who is calling', () => {
    const offenders = routeFiles
      .filter((f) => !NO_ROLE_CHECK.includes(rel(f).replace(/\\/g, '/')))
      .filter((f) => !fs.readFileSync(f, 'utf8').includes('getRoleAndActor'))
      .map(rel)
    expect(offenders).toEqual([])
  })

  it('route files only export HTTP handlers (Next.js refuses to build otherwise)', () => {
    const allowed = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'dynamic', 'revalidate', 'runtime'])
    const offenders: string[] = []
    for (const f of routeFiles) {
      const source = fs.readFileSync(f, 'utf8')
      for (const match of Array.from(source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/gm))) {
        if (!allowed.has(match[1])) offenders.push(`${rel(f)}: ${match[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('a dynamic folder name matches the params key the route reads', () => {
    // e.g. a folder called [id] must be read as params.id, not params.Id
    const offenders: string[] = []
    for (const f of routeFiles) {
      const folders = Array.from(rel(f).matchAll(/\[(\w+)\]/g)).map((m) => m[1])
      const source = fs.readFileSync(f, 'utf8')
      for (const used of Array.from(source.matchAll(/params\.(\w+)/g))) {
        if (!folders.includes(used[1])) offenders.push(`${rel(f)} reads params.${used[1]} but folders are [${folders.join('], [')}]`)
      }
    }
    expect(offenders).toEqual([])
  })
})
