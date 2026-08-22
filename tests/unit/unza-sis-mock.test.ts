// tests/unit/unza-sis-mock.test.ts
//
// Tests for src/lib/unza-sis-mock.ts — the simulated UNZA Student
// Information System used to verify a student's eligibility by their
// student number, replacing the old physical-ID-card check.

import { describe, it, expect } from 'vitest'
import { queryUNZASIS } from '@/src/lib/unza-sis-mock'

describe('queryUNZASIS', () => {
  it('returns found:false for a student number that does not exist', () => {
    const result = queryUNZASIS('0000000000')
    expect(result.found).toBe(false)
  })

  it('returns eligible:true for a registered, active student', () => {
    const result = queryUNZASIS('2022082613')
    expect(result.found).toBe(true)
    // TypeScript needs us to check `found` before it will let us read
    // `eligible`, because the return type changes shape depending on it.
    if (result.found) {
      expect(result.eligible).toBe(true)
      if (result.eligible) {
        expect(result.student.fullName).toBe('Butemwe Nkinke')
      }
    }
  })

  it('returns eligible:false for a suspended student, with a reason', () => {
    const result = queryUNZASIS('2023050999')
    expect(result.found).toBe(true)
    if (result.found && !result.eligible) {
      expect(result.reason).toMatch(/suspended/i)
    }
  })

  it('returns eligible:false for an alumnus (no longer an active student)', () => {
    const result = queryUNZASIS('2018010001')
    expect(result.found).toBe(true)
    if (result.found && !result.eligible) {
      expect(result.reason).toMatch(/alumnus/i)
    }
  })

  it('trims whitespace from the student number before looking it up', () => {
    // A receptionist might accidentally type a space before or after
    // the number — the lookup should still work.
    const result = queryUNZASIS('  2022082613  ')
    expect(result.found).toBe(true)
  })
})
