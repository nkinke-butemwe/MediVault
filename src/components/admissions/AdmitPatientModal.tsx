// src/components/admissions/AdmitPatientModal.tsx
// The pop-up a doctor uses to admit a patient.
//   Step 1: find the patient by student number (or name)
//   Step 2: fill in the complaint, reason, priority, source and who gave consent
// The server checks everything again (patient exists, not already admitted, consent on record...).

'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '@/src/components/Modal'
import { CloseIcon } from '@/src/components/icons'
import { localInputToIso } from '@/src/lib/datetime-input'
import {
  ADMISSION_PRIORITY_LABELS,
  ADMISSION_SOURCE_LABELS,
  labelFor,
} from '@/src/lib/admission-labels'
import type { AdmissionPriority, AdmissionSource } from '@/src/types'

interface AdmitPatientModalProps {
  onClose: () => void
  // Called with the new admission's id, so the screen behind can open it
  onAdmitted: (admissionId: string) => void
}

interface FoundPatient {
  id: string
  fullName: string
  studentNumber: string | null
}

interface KinOption {
  id: string
  emergencyConsentGiven: boolean
  nextOfKin: { id: string; fullName: string }
}

const inputClasses = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]'
const PRIORITIES: AdmissionPriority[] = ['EMERGENCY', 'URGENT', 'ROUTINE']
const SOURCES: AdmissionSource[] = ['WALK_IN', 'APPOINTMENT', 'REFERRAL', 'TRANSFER_IN', 'EMERGENCY']

export default function AdmitPatientModal({ onClose, onAdmitted }: AdmitPatientModalProps) {
  // Step 1: patient lookup
  const [searchText, setSearchText] = useState('')
  const [searching, setSearching] = useState(false)
  const [matches, setMatches] = useState<FoundPatient[]>([])
  const [patient, setPatient] = useState<FoundPatient | null>(null)
  // Only next of kin who are active AND have given consent can consent to an admission
  const [kinOptions, setKinOptions] = useState<KinOption[]>([])

  // Step 2: the admission itself
  const [presentingComplaint, setPresentingComplaint] = useState('')
  const [reason, setReason] = useState('')
  const [provisionalDiagnosis, setProvisionalDiagnosis] = useState('')
  const [priority, setPriority] = useState<AdmissionPriority>('ROUTINE')
  const [source, setSource] = useState<AdmissionSource>('WALK_IN')
  const [referralFrom, setReferralFrom] = useState('')
  const [knownAllergies, setKnownAllergies] = useState('')
  const [existingConditions, setExistingConditions] = useState('')
  const [currentMedication, setCurrentMedication] = useState('')
  const [expectedDischargeAt, setExpectedDischargeAt] = useState('')
  const [consentBy, setConsentBy] = useState<'PATIENT' | 'NEXT_OF_KIN'>('PATIENT')
  const [consentKinAssignmentId, setConsentKinAssignmentId] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSearch() {
    if (searchText.trim().length < 2) {
      toast.error('Type at least 2 characters')
      return
    }
    setSearching(true)
    try {
      const response = await fetch(`/api/patients/search?q=${encodeURIComponent(searchText.trim())}`)
      const data = await response.json()
      if (data.success) {
        setMatches(data.data)
        if (data.data.length === 0) toast.error('No patient found')
      } else {
        toast.error(data.error || 'Search failed')
      }
    } finally {
      setSearching(false)
    }
  }

  async function handlePickPatient(found: FoundPatient) {
    setPatient(found)
    setMatches([])
    // Load this patient's next of kin so the doctor can pick who consented (if not the patient)
    try {
      const response = await fetch(`/api/next-of-kin?patientId=${found.id}`)
      const data = await response.json()
      if (data.success) {
        const consenting = (data.data as KinOption[]).filter((assignment) => assignment.emergencyConsentGiven)
        setKinOptions(consenting)
      }
    } catch {
      setKinOptions([])
    }
  }

  async function handleAdmit() {
    if (!patient) return

    setSaving(true)
    try {
      const response = await fetch('/api/admissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          presentingComplaint,
          reason,
          provisionalDiagnosis,
          priority,
          source,
          referralFrom,
          knownAllergies,
          existingConditions,
          currentMedication,
          expectedDischargeAt: localInputToIso(expectedDischargeAt),
          consentBy,
          consentKinAssignmentId: consentBy === 'NEXT_OF_KIN' ? consentKinAssignmentId : undefined,
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(`Admitted as ${data.data.admissionNumber}`)
        onAdmitted(data.data.id)
        onClose()
      } else {
        toast.error(data.error || 'Could not admit the patient')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#0f3b5c]">Admit a patient</h2>
        <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-slate-600">
          <CloseIcon size={20} />
        </button>
      </div>

      {/* Step 1: find the patient */}
      {!patient ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Find the patient by student number or name.</p>
          <div className="flex gap-2">
            <input
              className={inputClasses}
              placeholder="Student number, e.g. 2022082613"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') handleSearch() }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-[#0f3b5c] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] disabled:opacity-60"
            >
              {searching ? '...' : 'Find'}
            </button>
          </div>
          {matches.length > 0 && (
            <ul className="border border-slate-100 rounded-xl divide-y divide-slate-100">
              {matches.map((match) => (
                <li key={match.id}>
                  <button onClick={() => handlePickPatient(match)} className="w-full text-left px-4 py-3 hover:bg-slate-50">
                    <span className="font-medium text-slate-800">{match.fullName}</span>
                    <span className="text-sm text-slate-500"> · {match.studentNumber ?? 'no student number'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* Step 2: the admission details */
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-[#e6f0f9] rounded-xl px-4 py-3">
            <p className="text-sm text-[#0f3b5c]">
              <span className="font-semibold">{patient.fullName}</span> · {patient.studentNumber}
            </p>
            <button onClick={() => setPatient(null)} className="text-xs text-[#0f3b5c] underline">Change</button>
          </div>

          <label className="block text-xs text-slate-500">Presenting complaint *
            <textarea className={inputClasses} rows={2} value={presentingComplaint} onChange={(event) => setPresentingComplaint(event.target.value)} />
          </label>
          <label className="block text-xs text-slate-500">Reason for admission *
            <textarea className={inputClasses} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <label className="block text-xs text-slate-500">Provisional diagnosis
            <input className={inputClasses} value={provisionalDiagnosis} onChange={(event) => setProvisionalDiagnosis(event.target.value)} />
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs text-slate-500">Priority *
              <select className={`${inputClasses} bg-white`} value={priority} onChange={(event) => setPriority(event.target.value as AdmissionPriority)}>
                {PRIORITIES.map((value) => (
                  <option key={value} value={value}>{labelFor(ADMISSION_PRIORITY_LABELS, value)}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs text-slate-500">Source *
              <select className={`${inputClasses} bg-white`} value={source} onChange={(event) => setSource(event.target.value as AdmissionSource)}>
                {SOURCES.map((value) => (
                  <option key={value} value={value}>{labelFor(ADMISSION_SOURCE_LABELS, value)}</option>
                ))}
              </select>
            </label>
          </div>

          {source === 'REFERRAL' && (
            <label className="block text-xs text-slate-500">Referred by *
              <input className={inputClasses} value={referralFrom} onChange={(event) => setReferralFrom(event.target.value)} />
            </label>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block text-xs text-slate-500">Known allergies
              <input className={inputClasses} value={knownAllergies} onChange={(event) => setKnownAllergies(event.target.value)} />
            </label>
            <label className="block text-xs text-slate-500">Existing conditions
              <input className={inputClasses} value={existingConditions} onChange={(event) => setExistingConditions(event.target.value)} />
            </label>
            <label className="block text-xs text-slate-500">Current medication
              <input className={inputClasses} value={currentMedication} onChange={(event) => setCurrentMedication(event.target.value)} />
            </label>
          </div>

          <label className="block text-xs text-slate-500">Expected discharge (optional)
            <input type="datetime-local" className={inputClasses} value={expectedDischargeAt} onChange={(event) => setExpectedDischargeAt(event.target.value)} />
          </label>

          {/* Consent */}
          <div className="border border-slate-100 rounded-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-600">Who consented to the admission? *</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" checked={consentBy === 'PATIENT'} onChange={() => setConsentBy('PATIENT')} />
              The patient
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                checked={consentBy === 'NEXT_OF_KIN'}
                onChange={() => setConsentBy('NEXT_OF_KIN')}
                disabled={kinOptions.length === 0}
              />
              Next of kin (patient cannot consent)
            </label>
            {kinOptions.length === 0 && (
              <p className="text-xs text-slate-400">
                This patient has no next of kin with emergency consent on record, so only the patient can consent.
              </p>
            )}
            {consentBy === 'NEXT_OF_KIN' && (
              <select
                className={`${inputClasses} bg-white`}
                value={consentKinAssignmentId}
                onChange={(event) => setConsentKinAssignmentId(event.target.value)}
              >
                <option value="">Choose the next of kin who consented</option>
                {kinOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.nextOfKin.fullName}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200">
              Cancel
            </button>
            <button
              onClick={handleAdmit}
              disabled={saving}
              className="bg-[#0f3b5c] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] disabled:opacity-60"
            >
              {saving ? 'Admitting...' : 'Admit patient'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
