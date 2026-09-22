// tests/unit/roles-and-format.test.ts
//
// Tests for two small helpers added while fixing the bugs found in testing:
//   - src/lib/roles.ts   (which dashboard each role lands on)
//   - src/lib/format.ts  (the "Dr. Dr." doctor-name bug)

import { describe, it, expect } from 'vitest'
import { ROLE_DASHBOARDS, getDashboardPath } from '@/src/lib/roles'
import { formatDoctorName, formatDate, formatDateTime } from '@/src/lib/format'

describe('getDashboardPath', () => {
  it('sends a pharmacist to the pharmacy dashboard, not the patient one', () => {
    expect(getDashboardPath('PHARMACIST')).toBe('/dashboard/pharmacy')
  })

  it('has a dashboard for every role', () => {
    expect(Object.keys(ROLE_DASHBOARDS).sort()).toEqual(
      ['ADMIN', 'DOCTOR', 'LAB_TECHNICIAN', 'NEXT_OF_KIN', 'PATIENT', 'PHARMACIST', 'RECEPTIONIST']
    )
  })

  it('sends a lab technician to the lab dashboard', () => {
    expect(getDashboardPath('LAB_TECHNICIAN')).toBe('/dashboard/lab')
  })

  it('sends an unknown role to /login instead of a patient dashboard', () => {
    expect(getDashboardPath('SOMETHING_ELSE')).toBe('/login')
  })
})

describe('formatDoctorName', () => {
  it('does not double the title when the stored name already starts with "Dr."', () => {
    expect(formatDoctorName('Dr. Grace Phiri')).toBe('Dr. Grace Phiri')
  })

  it('adds the title when the stored name has none', () => {
    expect(formatDoctorName('Grace Phiri')).toBe('Dr. Grace Phiri')
  })

  it('handles "Dr" without a dot, different casing and repeated titles', () => {
    expect(formatDoctorName('dr Grace Phiri')).toBe('Dr. Grace Phiri')
    expect(formatDoctorName('Dr. Dr. Grace Phiri')).toBe('Dr. Grace Phiri')
  })

  it('does not strip a name that merely starts with the letters "Dr"', () => {
    expect(formatDoctorName('Drake Mulenga')).toBe('Dr. Drake Mulenga')
  })

  it('handles a missing doctor', () => {
    expect(formatDoctorName(undefined)).toBe('Unknown doctor')
  })
})

describe('formatDate / formatDateTime (dd/mm/yyyy)', () => {
  // These use local-time Date parts, so build dates in local time (no "Z")
  it('writes day before month with leading zeros', () => {
    expect(formatDate(new Date(2026, 2, 4))).toBe('04/03/2026') // 4 March 2026
  })

  it('does not swap day and month for dates like 12 January', () => {
    expect(formatDate(new Date(2026, 0, 12))).toBe('12/01/2026')
  })

  it('adds a 24-hour time for date-times', () => {
    expect(formatDateTime(new Date(2026, 2, 4, 9, 5))).toBe('04/03/2026, 09:05')
    expect(formatDateTime(new Date(2026, 2, 4, 14, 30))).toBe('04/03/2026, 14:30')
  })

  it('accepts ISO strings', () => {
    expect(formatDate(new Date(2026, 11, 25).toISOString())).toBe('25/12/2026')
  })

  it('shows a dash for missing or invalid dates instead of "Invalid Date"', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('not a date')).toBe('—')
    expect(formatDateTime('')).toBe('—')
  })
})
