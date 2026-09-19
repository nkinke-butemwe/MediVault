// src/lib/format.ts
// Small display-formatting helpers.

// Some doctor accounts are stored with the title already inside their name
// (for example "Dr. Grace Phiri"). If the UI adds "Dr. " in front of that,
// the screen shows "Dr. Dr. Grace Phiri".
//
// This helper removes any "Dr" / "Dr." prefix that is already there and then
// adds exactly one, so it is safe for names stored either way.
export function formatDoctorName(fullName: string | null | undefined): string {
  // No name available (for example the doctor account was removed)
  if (!fullName) return 'Unknown doctor'

  // Remove one or more leading "Dr" / "Dr." (case-insensitive) plus spaces
  const nameWithoutTitle = fullName.trim().replace(/^(dr\.?\s+)+/i, '')

  return `Dr. ${nameWithoutTitle}`
}

// ─── Dates ───────────────────────────────────────────────────────────────
// Zambia writes dates as day/month/year (dd/mm/yyyy).
//
// We build the text by hand instead of using toLocaleDateString() because
// that method follows the BROWSER's language setting. A browser set to
// English (US) prints m/d/yyyy, which is confusing here, for example
// 3/4/2026 is 4 March in Zambia but reads as 3 April in the US format.
// Building it ourselves gives the same result on every computer.

// Turns 5 into "05" so days, months, hours and minutes are always 2 digits
function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

// Accepts a date string, a Date or nothing, and returns a valid Date or null
function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return isNaN(date.getTime()) ? null : date
}

// Example: "04/03/2026"  (4 March 2026)
export function formatDate(value: string | Date | null | undefined): string {
  const date = toValidDate(value)
  if (!date) return '—'

  const day = padTwoDigits(date.getDate())
  const month = padTwoDigits(date.getMonth() + 1) // getMonth() counts from 0
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

// Example: "04/03/2026, 14:30"  (24-hour clock)
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toValidDate(value)
  if (!date) return '—'

  const hours = padTwoDigits(date.getHours())
  const minutes = padTwoDigits(date.getMinutes())

  return `${formatDate(date)}, ${hours}:${minutes}`
}
