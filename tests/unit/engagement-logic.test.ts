// tests/unit/engagement-logic.test.ts
//
// Tests for the pure logic behind appointment requests, the care timeline and
// the validators for appointments, messages and notifications. None of this
// touches the database.

import { describe, it, expect } from 'vitest'
import { checkAppointmentDate, parseRequestedDate, MAX_DAYS_AHEAD } from '@/src/lib/appointments'
import { buildTimeline } from '@/src/lib/timeline'
import {
  CreateAppointmentRequestSchema,
  AppointmentActionSchema,
  SendMessageSchema,
  MarkNotificationsReadSchema,
} from '@/src/lib/validators'

// A fixed "now" so the tests give the same answer on any day: Thu 8 Oct 2026, 15:00
const NOW = new Date(2026, 9, 8, 15, 0, 0)

describe('parseRequestedDate', () => {
  it('reads a date-only string as the start of that day in LOCAL time', () => {
    const parsed = parseRequestedDate('2026-10-20')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(9)
    expect(parsed.getDate()).toBe(20)
    expect(parsed.getHours()).toBe(0)
  })

  it('reads a date-time string as that local moment', () => {
    const parsed = parseRequestedDate('2026-10-20T09:30')
    expect(parsed.getDate()).toBe(20)
    expect(parsed.getHours()).toBe(9)
    expect(parsed.getMinutes()).toBe(30)
  })

  it('gives an invalid date for nonsense', () => {
    expect(isNaN(parseRequestedDate('not a date').getTime())).toBe(true)
  })
})

describe('checkAppointmentDate', () => {
  it('accepts today (even though the time of day has passed)', () => {
    expect(checkAppointmentDate(new Date(2026, 9, 8), NOW)).toBeNull()
  })

  it('accepts a date next week', () => {
    expect(checkAppointmentDate(new Date(2026, 9, 15), NOW)).toBeNull()
  })

  it('rejects yesterday', () => {
    expect(checkAppointmentDate(new Date(2026, 9, 7), NOW)).toMatch(/past/)
  })

  it(`accepts exactly ${MAX_DAYS_AHEAD} days ahead but not one day more`, () => {
    const limit = new Date(2026, 9, 8 + MAX_DAYS_AHEAD)
    const tooFar = new Date(2026, 9, 8 + MAX_DAYS_AHEAD + 1)
    expect(checkAppointmentDate(limit, NOW)).toBeNull()
    expect(checkAppointmentDate(tooFar, NOW)).toMatch(/ahead/)
  })

  it('rejects an invalid date', () => {
    expect(checkAppointmentDate(new Date('garbage'), NOW)).toMatch(/valid date/)
  })
})

describe('buildTimeline', () => {
  const empty = { records: [], visits: [], prescriptions: [], labOrders: [], appointments: [] }

  it('merges everything and sorts newest first', () => {
    const events = buildTimeline({
      records: [{ id: 'r1', diagnosis: 'Malaria', visitDate: '2026-03-01T08:00:00.000Z', doctor: { fullName: 'Dr. Mwanza' } }],
      visits: [{ id: 'v1', reason: 'Fever', visitDate: '2026-05-01T08:00:00.000Z', status: 'CHECKED_OUT' }],
      prescriptions: [{ id: 'p1', createdAt: '2026-04-01T08:00:00.000Z', status: 'DISPENSED', medications: JSON.stringify([{ name: 'Coartem' }, { name: 'Paracetamol' }]) }],
      labOrders: [],
      appointments: [],
    })
    expect(events.map((e) => e.id)).toEqual(['visit-v1', 'prescription-p1', 'record-r1'])
  })

  it('lists prescribed drug names and the prescribing doctor', () => {
    const events = buildTimeline({
      ...empty,
      records: [{ id: 'r1', diagnosis: 'Malaria', visitDate: new Date(), doctor: { fullName: 'Dr. Mwanza' } }],
      prescriptions: [{ id: 'p1', createdAt: new Date(), status: 'PENDING', medications: JSON.stringify([{ name: 'Coartem' }]) }],
    })
    expect(events.find((e) => e.kind === 'PRESCRIPTION')?.detail).toBe('Coartem')
    expect(events.find((e) => e.kind === 'RECORD')?.detail).toBe('Recorded by Dr. Mwanza')
  })

  it('survives a prescription whose medications are not valid JSON', () => {
    const events = buildTimeline({ ...empty, prescriptions: [{ id: 'p1', createdAt: new Date(), status: 'PENDING', medications: '{oops' }] })
    expect(events).toHaveLength(1)
    expect(events[0].detail).toBeNull()
  })

  it('hides lab orders the doctor has not reviewed yet', () => {
    const events = buildTimeline({
      ...empty,
      labOrders: [
        { id: 'unreviewed', status: 'COMPLETED', reviewedAt: null, doctorComment: null, items: [{ test: { name: 'Glucose' } }] },
        { id: 'in-progress', status: 'COLLECTED', reviewedAt: new Date(), doctorComment: null, items: [] },
      ],
    })
    expect(events).toEqual([])
  })

  it('shows a reviewed lab order on the day it was released, with the test names', () => {
    const events = buildTimeline({
      ...empty,
      labOrders: [{ id: 'l1', status: 'COMPLETED', reviewedAt: '2026-06-01T10:00:00.000Z', doctorComment: null, items: [{ test: { name: 'Haemoglobin' } }, { test: { name: 'WBC' } }] }],
    })
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'LAB', date: '2026-06-01T10:00:00.000Z', detail: 'Haemoglobin, WBC', section: 'labs' })
  })

  it('does not list a confirmed appointment twice (its visit is already on the timeline)', () => {
    const events = buildTimeline({
      ...empty,
      visits: [{ id: 'v9', reason: 'Check-up', visitDate: '2026-10-20T07:00:00.000Z', status: 'WAITING' }],
      appointments: [{ id: 'a1', status: 'CONFIRMED', reason: 'Check-up', preferredDate: '2026-10-20T00:00:00.000Z', scheduledFor: '2026-10-20T07:00:00.000Z', visitId: 'v9' }],
    })
    expect(events.map((e) => e.kind)).toEqual(['VISIT'])
  })

  it('still lists requested and declined appointments', () => {
    const events = buildTimeline({
      ...empty,
      appointments: [
        { id: 'a1', status: 'REQUESTED', reason: 'Follow-up', preferredDate: '2026-10-20T00:00:00.000Z', scheduledFor: null, visitId: null },
        { id: 'a2', status: 'DECLINED', reason: 'Certificate', preferredDate: '2026-10-10T00:00:00.000Z', scheduledFor: null, visitId: null },
      ],
    })
    expect(events.map((e) => e.status)).toEqual(['REQUESTED', 'DECLINED'])
  })
})

describe('appointment validators', () => {
  it('accepts a normal request', () => {
    expect(CreateAppointmentRequestSchema.safeParse({ preferredDate: '2026-10-20', reason: 'Follow-up visit' }).success).toBe(true)
  })

  it('rejects a missing date and a too-short reason', () => {
    expect(CreateAppointmentRequestSchema.safeParse({ preferredDate: '', reason: 'Follow-up visit' }).success).toBe(false)
    expect(CreateAppointmentRequestSchema.safeParse({ preferredDate: '2026-10-20', reason: 'a' }).success).toBe(false)
  })

  it('requires a reason when declining but not when confirming', () => {
    expect(AppointmentActionSchema.safeParse({ action: 'decline' }).success).toBe(false)
    expect(AppointmentActionSchema.safeParse({ action: 'decline', responseNote: 'No doctor free' }).success).toBe(true)
    expect(AppointmentActionSchema.safeParse({ action: 'confirm', scheduledFor: '2026-10-20T09:00' }).success).toBe(true)
    expect(AppointmentActionSchema.safeParse({ action: 'confirm' }).success).toBe(false)
  })

  it('only knows the three actions', () => {
    expect(AppointmentActionSchema.safeParse({ action: 'cancel' }).success).toBe(true)
    expect(AppointmentActionSchema.safeParse({ action: 'delete' }).success).toBe(false)
  })
})

describe('message and notification validators', () => {
  it('trims a message and rejects an empty or oversized one', () => {
    const ok = SendMessageSchema.safeParse({ recipientId: 'd1', body: '  hello  ' })
    expect(ok.success && ok.data.body).toBe('hello')
    expect(SendMessageSchema.safeParse({ recipientId: 'd1', body: '   ' }).success).toBe(false)
    expect(SendMessageSchema.safeParse({ recipientId: 'd1', body: 'x'.repeat(2001) }).success).toBe(false)
  })

  it('needs a recipient', () => {
    expect(SendMessageSchema.safeParse({ recipientId: '', body: 'hi' }).success).toBe(false)
  })

  it('marks read either by ids or all, but not nothing', () => {
    expect(MarkNotificationsReadSchema.safeParse({ all: true }).success).toBe(true)
    expect(MarkNotificationsReadSchema.safeParse({ ids: ['a', 'b'] }).success).toBe(true)
    expect(MarkNotificationsReadSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(MarkNotificationsReadSchema.safeParse({}).success).toBe(false)
  })
})
