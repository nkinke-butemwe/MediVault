// src/lib/appointments.ts
// Pure helpers for appointment requests (no database calls, so they are easy to test).

// A patient may ask for an appointment at most this many days from today.
export const MAX_DAYS_AHEAD = 90

// Turns what the browser sends into a Date.
//   "2026-10-20"        (a date picker) -> midnight at the START of that day, server time
//   "2026-10-20T09:30"  (date + time)   -> that moment, server time
// A plain new Date("2026-10-20") would mean midnight in UTC, which on a server
// in a different time zone can land on the previous day and wrongly look "in the past".
export function parseRequestedDate(text: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim())
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return new Date(Number(year), Number(month) - 1, Number(day))
  }
  return new Date(text)
}

// Returns midnight (00:00) at the start of the given day.
function startOfDay(date: Date): Date {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

// Checks a requested date. Returns an error message the patient can read,
// or null when the date is fine.
//   - it must be a real date
//   - it cannot be before today (today itself is fine)
//   - it cannot be more than MAX_DAYS_AHEAD days away
export function checkAppointmentDate(requested: Date, now: Date = new Date()): string | null {
  if (isNaN(requested.getTime())) return 'Please choose a valid date'

  const today = startOfDay(now)
  if (requested.getTime() < today.getTime()) return 'The appointment date cannot be in the past'

  const latest = new Date(today)
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD)
  if (requested.getTime() > latest.getTime()) {
    return `Appointments can only be requested up to ${MAX_DAYS_AHEAD} days ahead`
  }

  return null
}
