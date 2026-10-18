// src/components/admissions/DischargeForm.tsx
// The form a doctor uses to discharge a patient. The boxes shown depend on the outcome (disposition):
//   Home                -> summary + instructions
//   Transferred out     -> destination + summary
//   Left against advice -> summary
//   Deceased            -> time and cause of death (doctors only; the server enforces this too)
// The server re-checks every rule, so this form is a convenience, not the only safeguard.

'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { DischargeDisposition } from '@/src/types'
import { DISCHARGE_DISPOSITION_LABELS, labelFor } from '@/src/lib/admission-labels'
import { localInputToIso } from '@/src/lib/datetime-input'

interface DischargeFormProps {
  admissionId: string
  // Only a doctor may record a death, so other roles do not see that option
  canRecordDeath: boolean
  onDischarged: () => void
}

const inputClasses = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]'

export default function DischargeForm({ admissionId, canRecordDeath, onDischarged }: DischargeFormProps) {
  const [disposition, setDisposition] = useState<DischargeDisposition>('HOME')
  const [finalDiagnosis, setFinalDiagnosis] = useState('')
  const [dischargeSummary, setDischargeSummary] = useState('')
  const [dischargeInstructions, setDischargeInstructions] = useState('')
  const [transferDestination, setTransferDestination] = useState('')
  const [timeOfDeath, setTimeOfDeath] = useState('')
  const [causeOfDeath, setCauseOfDeath] = useState('')
  const [followUpDate, setFollowUpDate] = useState('')
  const [dischargedAt, setDischargedAt] = useState('')
  const [saving, setSaving] = useState(false)

  const availableDispositions: DischargeDisposition[] = ['HOME', 'TRANSFERRED_OUT', 'LEFT_AGAINST_ADVICE']
  if (canRecordDeath) {
    availableDispositions.push('DECEASED')
  }

  const showSummary = disposition !== 'DECEASED'
  const showInstructions = disposition === 'HOME'
  const showDestination = disposition === 'TRANSFERRED_OUT'
  const showDeathFields = disposition === 'DECEASED'

  async function handleDischarge() {
    // Ask before doing something that cannot be undone
    const confirmed = window.confirm('Discharge this patient? A discharged admission can never be reopened.')
    if (!confirmed) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admissions/${admissionId}/discharge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disposition,
          finalDiagnosis,
          dischargeSummary,
          dischargeInstructions,
          transferDestination,
          timeOfDeath: localInputToIso(timeOfDeath),
          causeOfDeath,
          followUpDate: followUpDate || undefined,
          dischargedAt: localInputToIso(dischargedAt),
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Patient discharged')
        // Open lab orders or undispensed prescriptions do not block the discharge, but the doctor should know
        const warnings: string[] = data.warnings ?? []
        for (const warning of warnings) {
          toast(warning, { duration: 9000 })
        }
        onDischarged()
      } else {
        toast.error(data.error || 'Could not discharge the patient')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-slate-500">Outcome
        <select
          value={disposition}
          onChange={(event) => setDisposition(event.target.value as DischargeDisposition)}
          className={`${inputClasses} bg-white`}
        >
          {availableDispositions.map((value) => (
            <option key={value} value={value}>{labelFor(DISCHARGE_DISPOSITION_LABELS, value)}</option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-slate-500">Final diagnosis *
        <input className={inputClasses} value={finalDiagnosis} onChange={(event) => setFinalDiagnosis(event.target.value)} />
      </label>

      {showDestination && (
        <label className="block text-xs text-slate-500">Transferred to *
          <input className={inputClasses} value={transferDestination} onChange={(event) => setTransferDestination(event.target.value)} placeholder="e.g. University Teaching Hospital" />
        </label>
      )}

      {showSummary && (
        <label className="block text-xs text-slate-500">Discharge summary *
          <textarea className={inputClasses} rows={3} value={dischargeSummary} onChange={(event) => setDischargeSummary(event.target.value)} />
        </label>
      )}

      {showInstructions && (
        <label className="block text-xs text-slate-500">Instructions for the patient *
          <textarea className={inputClasses} rows={3} value={dischargeInstructions} onChange={(event) => setDischargeInstructions(event.target.value)} />
        </label>
      )}

      {showDeathFields && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block text-xs text-slate-500">Time of death *
            <input type="datetime-local" className={inputClasses} value={timeOfDeath} onChange={(event) => setTimeOfDeath(event.target.value)} />
          </label>
          <label className="block text-xs text-slate-500">Cause of death *
            <input className={inputClasses} value={causeOfDeath} onChange={(event) => setCauseOfDeath(event.target.value)} />
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block text-xs text-slate-500">Follow-up date (optional)
          <input type="date" className={inputClasses} value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-500">Discharge time (blank = now)
          <input type="datetime-local" className={inputClasses} value={dischargedAt} onChange={(event) => setDischargedAt(event.target.value)} />
        </label>
      </div>

      <button
        onClick={handleDischarge}
        disabled={saving}
        className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60"
      >
        {saving ? 'Discharging...' : 'Discharge patient'}
      </button>
    </div>
  )
}
