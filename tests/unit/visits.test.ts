// tests/unit/visits.test.ts
//
// Tests for src/lib/visits.ts — which visit status changes are allowed.

import { describe, it, expect } from 'vitest'
import { canTransitionVisit, isFinalVisitStatus, VISIT_TRANSITIONS, type VisitStatus } from '@/src/lib/visits'

const ALL_STATUSES: VisitStatus[] = ['WAITING', 'CHECKED_IN', 'IN_CONSULTATION', 'CHECKED_OUT', 'CANCELLED']

describe('canTransitionVisit', () => {
  it('lets a waiting visit be checked in or cancelled', () => {
    expect(canTransitionVisit('WAITING', 'CHECKED_IN')).toBe(true)
    expect(canTransitionVisit('WAITING', 'CANCELLED')).toBe(true)
  })

  it('lets a checked-in visit start the consultation or be cancelled', () => {
    expect(canTransitionVisit('CHECKED_IN', 'IN_CONSULTATION')).toBe(true)
    expect(canTransitionVisit('CHECKED_IN', 'CANCELLED')).toBe(true)
  })

  it('lets a consultation only finish with a check-out', () => {
    expect(canTransitionVisit('IN_CONSULTATION', 'CHECKED_OUT')).toBe(true)
    expect(canTransitionVisit('IN_CONSULTATION', 'CANCELLED')).toBe(false)
  })

  it('refuses to skip steps', () => {
    expect(canTransitionVisit('WAITING', 'IN_CONSULTATION')).toBe(false)
    expect(canTransitionVisit('WAITING', 'CHECKED_OUT')).toBe(false)
    expect(canTransitionVisit('CHECKED_IN', 'CHECKED_OUT')).toBe(false)
  })

  it('refuses to go backwards', () => {
    expect(canTransitionVisit('CHECKED_IN', 'WAITING')).toBe(false)
    expect(canTransitionVisit('IN_CONSULTATION', 'CHECKED_IN')).toBe(false)
    expect(canTransitionVisit('CHECKED_OUT', 'WAITING')).toBe(false)
  })

  it('never reopens a cancelled visit', () => {
    for (const next of ALL_STATUSES) {
      expect(canTransitionVisit('CANCELLED', next)).toBe(false)
    }
  })

  it('never changes a checked-out visit', () => {
    for (const next of ALL_STATUSES) {
      expect(canTransitionVisit('CHECKED_OUT', next)).toBe(false)
    }
  })

  it('does not count staying on the same status as a transition', () => {
    for (const status of ALL_STATUSES) {
      expect(canTransitionVisit(status, status)).toBe(false)
    }
  })
})

describe('isFinalVisitStatus', () => {
  it('is true only for CHECKED_OUT and CANCELLED', () => {
    expect(ALL_STATUSES.filter(isFinalVisitStatus)).toEqual(['CHECKED_OUT', 'CANCELLED'])
  })

  it('has an entry in the transition map for every status', () => {
    expect(Object.keys(VISIT_TRANSITIONS).sort()).toEqual([...ALL_STATUSES].sort())
  })
})
