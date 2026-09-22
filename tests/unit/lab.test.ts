// tests/unit/lab.test.ts
//
// Tests for the laboratory module's pure logic (src/lib/lab.ts) and the lab
// input schemas in src/lib/validators.

import { describe, it, expect } from 'vitest'
import {
  computeFlag, isCriticalFlag, isAbnormalFlag, parseAllowedResults, formatReferenceRange, canEnterResults,
  type LabReference,
} from '@/src/lib/lab'
import { CreateLabOrderSchema, EnterLabResultsSchema, LabOrderActionSchema } from '@/src/lib/validators'

// Haemoglobin, like the seeded catalogue: normal 12–17.5, critical below 7 or above 20
const hb: LabReference = { refLow: 12, refHigh: 17.5, criticalLow: 7, criticalHigh: 20, normalText: null }
const malaria: LabReference = { refLow: null, refHigh: null, criticalLow: null, criticalHigh: null, normalText: 'Negative' }

describe('computeFlag (numeric tests)', () => {
  it('is NORMAL inside the range, including exactly on the limits', () => {
    expect(computeFlag(hb, { valueNumeric: 14 })).toBe('NORMAL')
    expect(computeFlag(hb, { valueNumeric: 12 })).toBe('NORMAL')
    expect(computeFlag(hb, { valueNumeric: 17.5 })).toBe('NORMAL')
  })

  it('is LOW / HIGH just outside the range', () => {
    expect(computeFlag(hb, { valueNumeric: 11.9 })).toBe('LOW')
    expect(computeFlag(hb, { valueNumeric: 18 })).toBe('HIGH')
  })

  it('is CRITICAL beyond the critical limits, and critical wins over low/high', () => {
    expect(computeFlag(hb, { valueNumeric: 6.9 })).toBe('CRITICAL_LOW')
    expect(computeFlag(hb, { valueNumeric: 20.1 })).toBe('CRITICAL_HIGH')
    // exactly on the critical limit is still just LOW, not critical
    expect(computeFlag(hb, { valueNumeric: 7 })).toBe('LOW')
  })

  it('handles a test with only an upper limit (e.g. creatinine has no critical low)', () => {
    const crea: LabReference = { refLow: 60, refHigh: 110, criticalLow: null, criticalHigh: 500, normalText: null }
    expect(computeFlag(crea, { valueNumeric: 5 })).toBe('LOW')
    expect(computeFlag(crea, { valueNumeric: 501 })).toBe('CRITICAL_HIGH')
  })

  it('returns null rather than a wrong NORMAL when the test has no range on file', () => {
    const none: LabReference = { refLow: null, refHigh: null, criticalLow: null, criticalHigh: null, normalText: null }
    expect(computeFlag(none, { valueNumeric: 5 })).toBeNull()
  })

  it('a value of zero is judged, not ignored', () => {
    expect(computeFlag(hb, { valueNumeric: 0 })).toBe('CRITICAL_LOW')
  })
})

describe('computeFlag (text tests)', () => {
  it('is NORMAL when the text matches the normal answer (ignoring case and spaces)', () => {
    expect(computeFlag(malaria, { valueText: 'Negative' })).toBe('NORMAL')
    expect(computeFlag(malaria, { valueText: '  negative ' })).toBe('NORMAL')
  })

  it('is ABNORMAL for any other answer', () => {
    expect(computeFlag(malaria, { valueText: 'Positive' })).toBe('ABNORMAL')
  })

  it('returns null with no result or no normal answer on file', () => {
    expect(computeFlag(malaria, {})).toBeNull()
    expect(computeFlag({ ...malaria, normalText: null }, { valueText: 'Positive' })).toBeNull()
  })
})

describe('flag helpers', () => {
  it('isCriticalFlag / isAbnormalFlag', () => {
    expect(isCriticalFlag('CRITICAL_LOW')).toBe(true)
    expect(isCriticalFlag('HIGH')).toBe(false)
    expect(isCriticalFlag(null)).toBe(false)
    expect(isAbnormalFlag('HIGH')).toBe(true)
    expect(isAbnormalFlag('NORMAL')).toBe(false)
    expect(isAbnormalFlag(null)).toBe(false)
  })

  it('parseAllowedResults splits and trims a comma list', () => {
    expect(parseAllowedResults('Negative, Trace ,1+')).toEqual(['Negative', 'Trace', '1+'])
    expect(parseAllowedResults(null)).toEqual([])
    expect(parseAllowedResults('')).toEqual([])
  })

  it('formatReferenceRange shows a readable range', () => {
    expect(formatReferenceRange({ refLow: 3.9, refHigh: 5.6, normalText: null, unit: 'mmol/L' })).toBe('3.9 – 5.6 mmol/L')
    expect(formatReferenceRange({ refLow: null, refHigh: 5.2, normalText: null, unit: 'mmol/L' })).toBe('< 5.2 mmol/L')
    expect(formatReferenceRange({ refLow: null, refHigh: null, normalText: 'Negative' })).toBe('Negative')
    expect(formatReferenceRange({ refLow: null, refHigh: null, normalText: null })).toBe('—')
  })

  it('canEnterResults only while the order is open', () => {
    expect(canEnterResults('ORDERED')).toBe(true)
    expect(canEnterResults('COLLECTED')).toBe(true)
    expect(canEnterResults('COMPLETED')).toBe(false)
    expect(canEnterResults('CANCELLED')).toBe(false)
  })
})

describe('lab input schemas', () => {
  it('CreateLabOrderSchema defaults to routine priority', () => {
    const parsed = CreateLabOrderSchema.parse({ patientId: 'p1', testIds: ['t1'] })
    expect(parsed.priority).toBe('ROUTINE')
  })

  it('CreateLabOrderSchema needs at least one test and a valid priority', () => {
    expect(CreateLabOrderSchema.safeParse({ patientId: 'p1', testIds: [] }).success).toBe(false)
    expect(CreateLabOrderSchema.safeParse({ patientId: 'p1', testIds: ['t1'], priority: 'WHENEVER' }).success).toBe(false)
    expect(CreateLabOrderSchema.safeParse({ patientId: '', testIds: ['t1'] }).success).toBe(false)
  })

  it('EnterLabResultsSchema accepts a number or a text result, but not neither', () => {
    expect(EnterLabResultsSchema.safeParse({ results: [{ itemId: 'i1', valueNumeric: 0 }] }).success).toBe(true)
    expect(EnterLabResultsSchema.safeParse({ results: [{ itemId: 'i1', valueText: 'Negative' }] }).success).toBe(true)
    expect(EnterLabResultsSchema.safeParse({ results: [{ itemId: 'i1' }] }).success).toBe(false)
    expect(EnterLabResultsSchema.safeParse({ results: [] }).success).toBe(false)
  })

  it('EnterLabResultsSchema rejects NaN and Infinity', () => {
    expect(EnterLabResultsSchema.safeParse({ results: [{ itemId: 'i1', valueNumeric: NaN }] }).success).toBe(false)
    expect(EnterLabResultsSchema.safeParse({ results: [{ itemId: 'i1', valueNumeric: Infinity }] }).success).toBe(false)
  })

  it('LabOrderActionSchema only allows the three known actions', () => {
    expect(LabOrderActionSchema.safeParse({ action: 'collect' }).success).toBe(true)
    expect(LabOrderActionSchema.safeParse({ action: 'cancel' }).success).toBe(true)
    expect(LabOrderActionSchema.safeParse({ action: 'review', doctorComment: 'Start iron' }).success).toBe(true)
    expect(LabOrderActionSchema.safeParse({ action: 'delete' }).success).toBe(false)
  })
})
