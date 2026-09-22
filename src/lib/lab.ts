// src/lib/lab.ts
// Pure helpers for the laboratory module (no database, easy to test).

export type LabFlag = 'NORMAL' | 'LOW' | 'HIGH' | 'CRITICAL_LOW' | 'CRITICAL_HIGH' | 'ABNORMAL'

// The reference information copied onto each ordered test
export interface LabReference {
  refLow: number | null
  refHigh: number | null
  criticalLow: number | null
  criticalHigh: number | null
  normalText: string | null
}

export interface LabResultInput {
  valueNumeric?: number | null
  valueText?: string | null
}

// Works out the flag for one result.
//  - Numeric tests are compared with the critical and normal ranges.
//  - Yes/no style tests (e.g. malaria RDT) are NORMAL if the text matches the
//    test's normal answer, otherwise ABNORMAL.
//  - Anything we cannot judge (no range on file) returns null: better to show
//    no flag than a wrong "Normal".
export function computeFlag(ref: LabReference, result: LabResultInput): LabFlag | null {
  const value = result.valueNumeric ?? null

  if (value !== null) {
    if (ref.criticalLow !== null && value < ref.criticalLow) return 'CRITICAL_LOW'
    if (ref.criticalHigh !== null && value > ref.criticalHigh) return 'CRITICAL_HIGH'
    if (ref.refLow !== null && value < ref.refLow) return 'LOW'
    if (ref.refHigh !== null && value > ref.refHigh) return 'HIGH'
    if (ref.refLow === null && ref.refHigh === null) return null
    return 'NORMAL'
  }

  const text = result.valueText?.trim()
  if (text && ref.normalText) {
    return text.toLowerCase() === ref.normalText.trim().toLowerCase() ? 'NORMAL' : 'ABNORMAL'
  }
  return null
}

export function isCriticalFlag(flag: LabFlag | null | undefined): boolean {
  return flag === 'CRITICAL_LOW' || flag === 'CRITICAL_HIGH'
}

export function isAbnormalFlag(flag: LabFlag | null | undefined): boolean {
  return !!flag && flag !== 'NORMAL'
}

// "Negative,Positive" -> ['Negative', 'Positive']
export function parseAllowedResults(allowed: string | null | undefined): string[] {
  if (!allowed) return []
  return allowed.split(',').map((s) => s.trim()).filter(Boolean)
}

// Text like "3.9 – 5.6 mmol/L" for showing the normal range next to a result
export function formatReferenceRange(ref: Pick<LabReference, 'refLow' | 'refHigh' | 'normalText'> & { unit?: string | null }): string {
  const unit = ref.unit ? ` ${ref.unit}` : ''
  if (ref.refLow !== null && ref.refHigh !== null) return `${ref.refLow} – ${ref.refHigh}${unit}`
  if (ref.refHigh !== null) return `< ${ref.refHigh}${unit}`
  if (ref.refLow !== null) return `> ${ref.refLow}${unit}`
  if (ref.normalText) return ref.normalText
  return '—'
}

// Can the technician still record results for an order in this status?
export function canEnterResults(status: string): boolean {
  return status === 'ORDERED' || status === 'COLLECTED'
}
