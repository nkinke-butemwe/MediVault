// src/components/admissions/AdmissionHistory.tsx
// The patient's read-only "My admissions" screen: every stay with its dates, length of stay,
// outcome and (once discharged) the discharge summary and instructions.
// The server only sends a patient their own admissions, and only the fields a patient may see.

'use client'

import { useState, useEffect } from 'react'
import type { Admission } from '@/src/types'
import { formatDate } from '@/src/lib/format'
import { DISCHARGE_DISPOSITION_LABELS, labelFor } from '@/src/lib/admission-labels'
import AdmissionCard from './AdmissionCard'

interface AdmissionHistoryProps {
  // The signed-in patient's own id
  patientId: string
}

// One "label: value" line inside an expanded admission
function Line({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

export default function AdmissionHistory({ patientId }: AdmissionHistoryProps) {
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which admission is expanded to show its discharge details (null = none)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`/api/patients/${patientId}/admissions`)
        const data = await response.json()
        if (data.success) setAdmissions(data.data)
        else setError(data.error || 'Could not load your admissions')
      } catch {
        setError('Could not load your admissions')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [patientId])

  function toggleExpanded(admissionId: string) {
    setExpandedId(expandedId === admissionId ? null : admissionId)
  }

  if (loading) {
    return <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm">Loading...</div>
  }
  if (error) {
    return <div className="bg-white rounded-2xl p-12 text-center text-red-500 shadow-sm">{error}</div>
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h2 className="text-lg font-semibold text-[#0f3b5c]">My admissions ({admissions.length})</h2>
        <p className="text-sm text-slate-500 mt-1">Your stays at the clinic ward. Open one to read your discharge summary and instructions.</p>
      </div>

      {admissions.length === 0 ? (
        <div className="p-12 text-center text-slate-400">You have no admissions on record.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {admissions.map((admission) => (
            <div key={admission.id}>
              <AdmissionCard admission={admission} showPatient={false} onOpen={toggleExpanded} />
              {expandedId === admission.id && (
                <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Line label="Reason for admission" value={admission.reason} />
                  <Line label="Outcome" value={admission.dischargeDisposition ? labelFor(DISCHARGE_DISPOSITION_LABELS, admission.dischargeDisposition) : null} />
                  <Line label="Final diagnosis" value={admission.finalDiagnosis} />
                  <Line label="Discharge summary" value={admission.dischargeSummary} />
                  <Line label="Instructions for you" value={admission.dischargeInstructions} />
                  <Line label="Follow-up date" value={admission.followUpDate ? formatDate(admission.followUpDate) : null} />
                  {admission.status === 'ADMITTED' && (
                    <p className="text-sm text-slate-500 md:col-span-2">You are currently admitted. Your discharge summary will appear here after you are discharged.</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
