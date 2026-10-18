// src/lib/admissions.ts
// Pure helpers for the inpatient admissions module (no database calls, so they are easy to test).
//
// The API routes call these to decide what is allowed. The rules live here, in one
// place, instead of being repeated inside every route.
//
// All dates are Date objects in UTC. Showing them in Africa/Lusaka time is the job of
// the display helpers in src/lib/format.ts.

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

// How far into the future an admission time may be before we call it a mistake.
// A few minutes of slack covers a clinic computer whose clock runs slightly fast.
export const FUTURE_TOLERANCE_MINUTES = 5

// A patient who comes back within this many days of a discharge counts as a readmission.
export const READMISSION_WINDOW_DAYS = 30

// ─── Statuses and transitions ──────────────────────────────────────────────

export type AdmissionStatusValue = 'ADMITTED' | 'DISCHARGED' | 'CANCELLED'

export type DischargeDispositionValue = 'HOME' | 'TRANSFERRED_OUT' | 'LEFT_AGAINST_ADVICE' | 'DECEASED'

// Which status changes are allowed.
//   ADMITTED   -> DISCHARGED or CANCELLED
//   DISCHARGED -> nothing (a discharged stay is never reopened)
//   CANCELLED  -> nothing
export function canTransition(from: AdmissionStatusValue, to: AdmissionStatusValue): boolean {
  if (from !== 'ADMITTED') {
    return false
  }
  return to === 'DISCHARGED' || to === 'CANCELLED'
}

// ─── Length of stay and readmission ────────────────────────────────────────

// Whole days between admission and discharge (or "now" if the patient is still in).
// Example: admitted Monday 08:00, discharged Tuesday 07:00 is 0 days; Tuesday 09:00 is 1 day.
// It never returns a negative number.
export function lengthOfStayDays(admittedAt: Date, dischargedAt: Date | null = null, now: Date = new Date()): number {
  const endOfStay = dischargedAt ?? now
  const elapsedMilliseconds = endOfStay.getTime() - admittedAt.getTime()
  if (elapsedMilliseconds <= 0) {
    return 0
  }
  return Math.floor(elapsedMilliseconds / MILLISECONDS_PER_DAY)
}

// True when a new admission starts within `windowDays` after the patient's previous discharge.
// Pass null when the patient has no earlier discharge.
export function isReadmission(
  previousDischargedAt: Date | null,
  newAdmittedAt: Date,
  windowDays: number = READMISSION_WINDOW_DAYS
): boolean {
  if (previousDischargedAt === null) {
    return false
  }
  const gapMilliseconds = newAdmittedAt.getTime() - previousDischargedAt.getTime()
  // A negative gap means the "previous" stay actually ended after this one began, so it is not a readmission.
  if (gapMilliseconds < 0) {
    return false
  }
  return gapMilliseconds <= windowDays * MILLISECONDS_PER_DAY
}

// ─── Date rules ────────────────────────────────────────────────────────────

// True when `date` is later than now plus the tolerance.
export function isInFuture(date: Date, now: Date = new Date()): boolean {
  const latestAllowed = now.getTime() + FUTURE_TOLERANCE_MINUTES * 60 * 1000
  return date.getTime() > latestAllowed
}

// Checks the dates sent when someone is admitted. Returns a list of problems (empty = fine).
export function validateAdmissionDates(
  input: { admittedAt: Date; expectedDischargeAt?: Date | null },
  now: Date = new Date()
): string[] {
  const problems: string[] = []

  if (isInFuture(input.admittedAt, now)) {
    problems.push('The admission date cannot be in the future.')
  }

  if (input.expectedDischargeAt && input.expectedDischargeAt.getTime() < input.admittedAt.getTime()) {
    problems.push('The expected discharge date cannot be before the admission date.')
  }

  return problems
}

// ─── Discharge rules ───────────────────────────────────────────────────────

export interface DischargeInput {
  disposition: DischargeDispositionValue
  dischargedAt: Date
  finalDiagnosis?: string | null
  dischargeSummary?: string | null
  dischargeInstructions?: string | null
  transferDestination?: string | null
  timeOfDeath?: Date | null
  causeOfDeath?: string | null
}

// A text field counts as "filled in" only if it has something other than spaces in it.
function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

// Checks a discharge. Returns a list of problems (empty = fine).
//   - dischargedAt must not be before admittedAt, and not in the future
//   - a final diagnosis is always required
//   - each disposition needs its own extra fields:
//       HOME                 -> discharge summary + discharge instructions
//       TRANSFERRED_OUT      -> transfer destination + discharge summary
//       LEFT_AGAINST_ADVICE  -> discharge summary
//       DECEASED             -> time of death + cause of death
export function validateDischarge(input: DischargeInput, admittedAt: Date, now: Date = new Date()): string[] {
  const problems: string[] = []

  if (input.dischargedAt.getTime() < admittedAt.getTime()) {
    problems.push('The discharge date cannot be before the admission date.')
  }
  if (isInFuture(input.dischargedAt, now)) {
    problems.push('The discharge date cannot be in the future.')
  }

  if (!hasText(input.finalDiagnosis)) {
    problems.push('A final diagnosis is required.')
  }

  if (input.disposition === 'HOME') {
    if (!hasText(input.dischargeSummary)) problems.push('A discharge summary is required when sending the patient home.')
    if (!hasText(input.dischargeInstructions)) problems.push('Discharge instructions are required when sending the patient home.')
  }

  if (input.disposition === 'TRANSFERRED_OUT') {
    if (!hasText(input.transferDestination)) problems.push('The transfer destination is required.')
    if (!hasText(input.dischargeSummary)) problems.push('A discharge summary is required for a transfer.')
  }

  if (input.disposition === 'LEFT_AGAINST_ADVICE') {
    if (!hasText(input.dischargeSummary)) problems.push('A discharge summary is required when the patient leaves against advice.')
  }

  if (input.disposition === 'DECEASED') {
    if (!input.timeOfDeath) {
      problems.push('The time of death is required.')
    } else {
      if (input.timeOfDeath.getTime() < admittedAt.getTime()) {
        problems.push('The time of death cannot be before the admission date.')
      }
      if (isInFuture(input.timeOfDeath, now)) {
        problems.push('The time of death cannot be in the future.')
      }
    }
    if (!hasText(input.causeOfDeath)) problems.push('The cause of death is required.')
  }

  return problems
}

// Only a doctor may record a death. Everyone else who can discharge may use the other dispositions.
// This is a permission rule (403), kept separate from the field checks above (400).
export function canUseDisposition(role: string | null, disposition: DischargeDispositionValue): boolean {
  if (disposition === 'DECEASED') {
    return role === 'DOCTOR'
  }
  return role === 'DOCTOR' || role === 'ADMIN'
}

// ─── Discharge warnings (never block the discharge) ────────────────────────

// Builds the warning messages shown after a discharge when work is still open.
export function buildDischargeWarnings(counts: { pendingLabOrders: number; undispensedPrescriptions: number }): string[] {
  const warnings: string[] = []

  if (counts.pendingLabOrders > 0) {
    warnings.push(`${counts.pendingLabOrders} lab order(s) linked to this admission are still pending.`)
  }
  if (counts.undispensedPrescriptions > 0) {
    warnings.push(`${counts.undispensedPrescriptions} prescription(s) linked to this admission have not been dispensed.`)
  }

  return warnings
}

// ─── Admission numbers ─────────────────────────────────────────────────────

// Example: formatAdmissionNumber(2026, 123) is "ADM-2026-000123"
export function formatAdmissionNumber(year: number, sequence: number): string {
  const paddedSequence = String(sequence).padStart(6, '0')
  return `ADM-${year}-${paddedSequence}`
}

export function isValidAdmissionNumber(value: string): boolean {
  return /^ADM-\d{4}-\d{6,}$/.test(value)
}

// The smallest part of a Prisma transaction client that nextAdmissionNumber needs.
// (Typed this way so tests can pass a tiny fake instead of a real database.)
export interface AdmissionNumberClient {
  $queryRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>
}

// Hands out the next admission number for a year.
//
// MUST be called inside the same transaction that creates the admission.
// One counter row exists per year. The single INSERT ... ON CONFLICT ... DO UPDATE statement
// below is atomic in PostgreSQL: if two requests arrive at the same moment, the database makes
// the second one wait for the first, so they can never receive the same number.
// If the transaction later fails and rolls back, the counter rolls back too (no gaps).
export async function nextAdmissionNumber(tx: AdmissionNumberClient, year: number): Promise<string> {
  const rows = (await tx.$queryRaw`
    INSERT INTO "AdmissionCounter" ("year", "lastNumber")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "lastNumber" = "AdmissionCounter"."lastNumber" + 1
    RETURNING "lastNumber"
  `) as { lastNumber: number }[]

  const sequence = rows[0].lastNumber
  return formatAdmissionNumber(year, sequence)
}

// ─── Database error helper ─────────────────────────────────────────────────

// Prisma reports a "unique index violated" error with the code P2002.
// For admissions this means the one_active_admission_per_patient index fired.
export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }
  return (error as { code?: unknown }).code === 'P2002'
}

// ─── Statistics helpers ────────────────────────────────────────────────────

// Lusaka is UTC+2 all year (Zambia has no daylight saving time).
const LUSAKA_OFFSET_HOURS = 2

// The moment (in UTC) when "today" began in Lusaka.
// Example: now = 2026-10-18T00:30:00Z is 02:30 in Lusaka, so today began at 2026-10-17T22:00:00Z.
export function startOfLusakaDay(now: Date = new Date()): Date {
  const offsetMilliseconds = LUSAKA_OFFSET_HOURS * 60 * 60 * 1000
  // Shift the clock to Lusaka time, cut it back to midnight, then shift it back to UTC
  const lusakaClock = new Date(now.getTime() + offsetMilliseconds)
  lusakaClock.setUTCHours(0, 0, 0, 0)
  return new Date(lusakaClock.getTime() - offsetMilliseconds)
}

// Average stay in days (with one decimal) over finished admissions. Returns 0 for an empty list.
export function averageLengthOfStayDays(stays: { admittedAt: Date; dischargedAt: Date }[]): number {
  if (stays.length === 0) {
    return 0
  }
  let totalMilliseconds = 0
  for (const stay of stays) {
    const milliseconds = stay.dischargedAt.getTime() - stay.admittedAt.getTime()
    totalMilliseconds += Math.max(milliseconds, 0)
  }
  const averageDays = totalMilliseconds / stays.length / MILLISECONDS_PER_DAY
  return Math.round(averageDays * 10) / 10
}

// Marks each admission in one patient's history as a readmission or not.
// Cancelled admissions are ignored (the patient was never really in).
// Returns a Map from admission id to true/false.
export function flagReadmissions(
  admissions: { id: string; status: string; admittedAt: Date; dischargedAt: Date | null }[],
  windowDays: number = READMISSION_WINDOW_DAYS
): Map<string, boolean> {
  const flags = new Map<string, boolean>()

  // Oldest first, so "the previous stay" is simply the one before in the list
  const oldestFirst = admissions
    .filter((admission) => admission.status !== 'CANCELLED')
    .sort((a, b) => a.admittedAt.getTime() - b.admittedAt.getTime())

  let previousDischargedAt: Date | null = null
  for (const admission of oldestFirst) {
    flags.set(admission.id, isReadmission(previousDischargedAt, admission.admittedAt, windowDays))
    previousDischargedAt = admission.dischargedAt
  }

  // Cancelled admissions are never readmissions
  for (const admission of admissions) {
    if (!flags.has(admission.id)) {
      flags.set(admission.id, false)
    }
  }
  return flags
}

// How many admissions (across many patients) were readmissions.
export function countReadmissions(
  admissions: { id: string; patientId: string; status: string; admittedAt: Date; dischargedAt: Date | null }[],
  windowDays: number = READMISSION_WINDOW_DAYS
): number {
  // Group the admissions by patient
  const byPatient = new Map<string, typeof admissions>()
  for (const admission of admissions) {
    const group = byPatient.get(admission.patientId) ?? []
    group.push(admission)
    byPatient.set(admission.patientId, group)
  }

  let readmissionCount = 0
  for (const group of Array.from(byPatient.values())) {
    const flags = flagReadmissions(group, windowDays)
    for (const isFlagged of Array.from(flags.values())) {
      if (isFlagged) readmissionCount += 1
    }
  }
  return readmissionCount
}
