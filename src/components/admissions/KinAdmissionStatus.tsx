// src/components/admissions/KinAdmissionStatus.tsx
// A small status card for the next-of-kin dashboard: is the patient admitted or discharged, and when.
// It shows nothing clinical. The server only returns admissions for patients whose assignment is
// active AND has emergency consent given, so if consent is revoked this card goes empty.

'use client'

import { useState, useEffect } from 'react'
import type { Admission } from '@/src/types'
import { formatDate } from '@/src/lib/format'
import { HospitalIcon } from '@/src/components/icons'
import { AdmissionStatusBadge } from './AdmissionBadges'

export default function KinAdmissionStatus() {
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch('/api/admissions?pageSize=20')
        const data = await response.json()
        if (data.success) setAdmissions(data.data.items)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Nothing to say: stay out of the way
  if (loading || admissions.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex items-center gap-2">
        <HospitalIcon size={18} className="text-[#0f3b5c]" />
        <h2 className="text-lg font-semibold text-[#0f3b5c]">Clinic ward status</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {admissions.map((admission) => (
          <div key={admission.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-slate-800">{admission.patient?.fullName}</p>
              <p className="text-xs text-slate-500">
                Admitted {formatDate(admission.admittedAt)}
                {admission.dischargedAt ? ` · Discharged ${formatDate(admission.dischargedAt)}` : ''}
              </p>
            </div>
            <AdmissionStatusBadge status={admission.status} />
          </div>
        ))}
      </div>
    </div>
  )
}
