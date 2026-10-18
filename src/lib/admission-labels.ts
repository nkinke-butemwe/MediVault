// src/lib/admission-labels.ts
// Plain-English text for the admission enums, shared by every admissions screen,
// so "LEFT_AGAINST_ADVICE" is always shown as "Left against medical advice".

export const ADMISSION_STATUS_LABELS: Record<string, string> = {
  ADMITTED: 'Admitted',
  DISCHARGED: 'Discharged',
  CANCELLED: 'Cancelled',
}

export const ADMISSION_PRIORITY_LABELS: Record<string, string> = {
  EMERGENCY: 'Emergency',
  URGENT: 'Urgent',
  ROUTINE: 'Routine',
}

export const ADMISSION_SOURCE_LABELS: Record<string, string> = {
  WALK_IN: 'Walk-in',
  APPOINTMENT: 'Appointment',
  REFERRAL: 'Referral',
  TRANSFER_IN: 'Transfer in',
  EMERGENCY: 'Emergency',
}

export const DISCHARGE_DISPOSITION_LABELS: Record<string, string> = {
  HOME: 'Discharged home',
  TRANSFERRED_OUT: 'Transferred to another facility',
  LEFT_AGAINST_ADVICE: 'Left against medical advice',
  DECEASED: 'Deceased',
}

export const ADMISSION_NOTE_KIND_LABELS: Record<string, string> = {
  PROGRESS: 'Progress note',
  WARD_ROUND: 'Ward round',
  PROCEDURE: 'Procedure',
  DIAGNOSIS_UPDATE: 'Diagnosis update',
}

// Looks a value up in one of the tables above. Falls back to the raw value, so a new enum
// value added later still shows something sensible instead of nothing.
export function labelFor(table: Record<string, string>, value: string | null | undefined): string {
  if (!value) return '—'
  return table[value] ?? value
}
