// src/components/admissions/AdmissionBadges.tsx
// Small coloured labels for an admission's status and priority.

import { ADMISSION_PRIORITY_LABELS, ADMISSION_STATUS_LABELS, labelFor } from '@/src/lib/admission-labels'

const STATUS_CLASSES: Record<string, string> = {
  ADMITTED: 'bg-blue-100 text-blue-800',
  DISCHARGED: 'bg-green-100 text-green-800',
  // Cancelled stays are drawn clearly different (red, struck through) so nobody mistakes them for real stays
  CANCELLED: 'bg-red-100 text-red-700 line-through',
}

const PRIORITY_CLASSES: Record<string, string> = {
  EMERGENCY: 'bg-red-100 text-red-700',
  URGENT: 'bg-orange-100 text-orange-800',
  ROUTINE: 'bg-slate-100 text-slate-600',
}

export function AdmissionStatusBadge({ status }: { status: string }) {
  const colourClasses = STATUS_CLASSES[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colourClasses}`}>
      {labelFor(ADMISSION_STATUS_LABELS, status)}
    </span>
  )
}

export function AdmissionPriorityBadge({ priority }: { priority: string | undefined }) {
  if (!priority) return null
  const colourClasses = PRIORITY_CLASSES[priority] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${colourClasses}`}>
      {labelFor(ADMISSION_PRIORITY_LABELS, priority)}
    </span>
  )
}
