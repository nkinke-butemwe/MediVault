// src/components/admissions/AdmissionCard.tsx
// One admission shown as a clickable row: patient, admission number, dates, length of stay.
// Used in the doctor's list and in a patient's history.

import type { Admission } from '@/src/types'
import { formatDate, formatDoctorName } from '@/src/lib/format'
import { AdmissionPriorityBadge, AdmissionStatusBadge } from './AdmissionBadges'

interface AdmissionCardProps {
  admission: Admission
  // Show the patient's name (true in the doctor's list, false in a patient's own history)
  showPatient?: boolean
  onOpen?: (admissionId: string) => void
}

export default function AdmissionCard({ admission, showPatient = true, onOpen }: AdmissionCardProps) {
  const isCancelled = admission.status === 'CANCELLED'

  // Cancelled stays never really happened, so they have no length of stay
  let lengthText = ''
  if (!isCancelled && admission.lengthOfStayDays !== null) {
    const days = admission.lengthOfStayDays
    lengthText = days === 1 ? '1 day' : `${days} days`
  }

  return (
    <div className={`p-5 flex flex-wrap items-center justify-between gap-3 ${isCancelled ? 'bg-slate-50' : ''}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {showPatient && admission.patient && (
            <p className="font-semibold text-slate-800">{admission.patient.fullName}</p>
          )}
          <span className="text-xs font-mono text-slate-500">{admission.admissionNumber}</span>
          <AdmissionStatusBadge status={admission.status} />
          <AdmissionPriorityBadge priority={admission.priority} />
          {admission.isReadmission && (
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-purple-100 text-purple-700">Readmission</span>
          )}
        </div>

        <p className="text-sm text-slate-500 mt-1">
          {showPatient && admission.patient?.studentNumber ? `${admission.patient.studentNumber} · ` : ''}
          Admitted {formatDate(admission.admittedAt)}
          {admission.dischargedAt ? ` · Discharged ${formatDate(admission.dischargedAt)}` : ''}
          {lengthText ? ` · ${lengthText}` : ''}
        </p>

        {admission.reason && <p className="text-sm text-slate-600 mt-1 truncate">{admission.reason}</p>}
        {admission.attendingDoctor && (
          <p className="text-xs text-slate-400 mt-1">{formatDoctorName(admission.attendingDoctor.fullName)}</p>
        )}
        {isCancelled && admission.cancelReason && (
          <p className="text-xs text-red-600 mt-1">Cancelled: {admission.cancelReason}</p>
        )}
      </div>

      {onOpen && (
        <button
          onClick={() => onOpen(admission.id)}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-[#e6f0f9] text-[#0f3b5c] hover:bg-[#dbeaf8] transition-all"
        >
          Open
        </button>
      )}
    </div>
  )
}
