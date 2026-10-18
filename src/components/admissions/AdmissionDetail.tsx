// src/components/admissions/AdmissionDetail.tsx
// Everything about ONE admission for a doctor: summary, notes, vitals, linked labs and
// prescriptions, and (while the patient is still admitted) the discharge form and the cancel button.
// Opening this screen is written to the access log by the server.

'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { Admission } from '@/src/types'
import { formatDate, formatDateTime, formatDoctorName } from '@/src/lib/format'
import {
  ADMISSION_SOURCE_LABELS,
  DISCHARGE_DISPOSITION_LABELS,
  labelFor,
} from '@/src/lib/admission-labels'
import { parsePrescribedItems } from '@/src/lib/pharmacy'
import { ArrowLeftIcon } from '@/src/components/icons'
import { AdmissionPriorityBadge, AdmissionStatusBadge } from './AdmissionBadges'
import NotesTimeline from './NotesTimeline'
import VitalsTable from './VitalsTable'
import DischargeForm from './DischargeForm'
import DoctorLabPanel from '@/src/components/lab/DoctorLabPanel'

interface AdmissionDetailProps {
  admissionId: string
  // "DOCTOR" or "ADMIN". Only a doctor may record a death.
  viewerRole: string
  onBack: () => void
  // Called after a change (discharge, cancel) so the list behind this screen can refresh
  onChanged: () => void
}

// A titled box, so every section of this screen looks the same
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">
      <h3 className="font-semibold text-[#0f3b5c] mb-3">{title}</h3>
      {children}
    </div>
  )
}

// One "label: value" line. Shows nothing when there is no value.
function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-800 whitespace-pre-wrap">{value}</p>
    </div>
  )
}

export default function AdmissionDetail({ admissionId, viewerRole, onBack, onChanged }: AdmissionDetailProps) {
  const [admission, setAdmission] = useState<Admission | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelBox, setShowCancelBox] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showLabPanel, setShowLabPanel] = useState(false)

  const loadAdmission = useCallback(async () => {
    try {
      const response = await fetch(`/api/admissions/${admissionId}`)
      const data = await response.json()
      if (data.success) {
        setAdmission(data.data)
      } else {
        toast.error(data.error || 'Could not load the admission')
      }
    } catch {
      toast.error('Could not load the admission')
    } finally {
      setLoading(false)
    }
  }, [admissionId])

  useEffect(() => {
    loadAdmission()
  }, [loadAdmission])

  // After a note, vitals reading or discharge: reload this screen, and tell the list behind it
  function handleChanged() {
    loadAdmission()
    onChanged()
  }

  async function handleCancel() {
    if (cancelReason.trim().length < 3) {
      toast.error('Write a reason for cancelling')
      return
    }
    setCancelling(true)
    try {
      const response = await fetch(`/api/admissions/${admissionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Admission cancelled')
        setShowCancelBox(false)
        setCancelReason('')
        handleChanged()
      } else {
        toast.error(data.error || 'Could not cancel the admission')
      }
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!admission) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="text-sm text-slate-500 hover:text-[#0f3b5c] inline-flex items-center gap-1.5">
          <ArrowLeftIcon size={14} /> Back
        </button>
        <p className="text-slate-500">This admission could not be loaded.</p>
      </div>
    )
  }

  const isCurrent = admission.status === 'ADMITTED'

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-slate-500 hover:text-[#0f3b5c] inline-flex items-center gap-1.5">
        <ArrowLeftIcon size={14} /> Back to admissions
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-bold text-[#0f3b5c]">{admission.patient?.fullName}</h2>
          <span className="text-sm font-mono text-slate-500">{admission.admissionNumber}</span>
          <AdmissionStatusBadge status={admission.status} />
          <AdmissionPriorityBadge priority={admission.priority} />
        </div>
        <p className="text-sm text-slate-500 mt-1">
          {admission.patient?.studentNumber ? `${admission.patient.studentNumber} · ` : ''}
          Admitted {formatDateTime(admission.admittedAt)}
          {admission.dischargedAt ? ` · Discharged ${formatDateTime(admission.dischargedAt)}` : ''}
          {admission.lengthOfStayDays !== null && admission.status !== 'CANCELLED'
            ? ` · ${admission.lengthOfStayDays} day(s)`
            : ''}
        </p>
        {admission.attendingDoctor && (
          <p className="text-xs text-slate-400 mt-1">Attending: {formatDoctorName(admission.attendingDoctor.fullName)}</p>
        )}
        {admission.status === 'CANCELLED' && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-700">
            This admission was cancelled{admission.cancelledAt ? ` on ${formatDate(admission.cancelledAt)}` : ''}.
            Reason: {admission.cancelReason}
          </div>
        )}
      </div>

      {/* Why the patient was admitted */}
      <Section title="Admission summary">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Fact label="Presenting complaint" value={admission.presentingComplaint} />
          <Fact label="Reason for admission" value={admission.reason} />
          <Fact label="Provisional diagnosis" value={admission.provisionalDiagnosis} />
          <Fact label="Source" value={labelFor(ADMISSION_SOURCE_LABELS, admission.source)} />
          <Fact label="Referred from" value={admission.referralFrom} />
          <Fact label="Examination findings" value={admission.examinationFindings} />
          <Fact label="Known allergies" value={admission.knownAllergies} />
          <Fact label="Existing conditions" value={admission.existingConditions} />
          <Fact label="Current medication" value={admission.currentMedication} />
          <Fact label="Admission notes" value={admission.admissionNotes} />
          <Fact label="Expected discharge" value={admission.expectedDischargeAt ? formatDate(admission.expectedDischargeAt) : null} />
          <Fact label="Consent given by" value={admission.consentBy === 'NEXT_OF_KIN' ? 'Next of kin' : 'Patient'} />
        </div>
      </Section>

      {/* Discharge details (once discharged) */}
      {admission.status === 'DISCHARGED' && (
        <Section title="Discharge">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Fact label="Outcome" value={labelFor(DISCHARGE_DISPOSITION_LABELS, admission.dischargeDisposition)} />
            <Fact label="Final diagnosis" value={admission.finalDiagnosis} />
            <Fact label="Transferred to" value={admission.transferDestination} />
            <Fact label="Discharge summary" value={admission.dischargeSummary} />
            <Fact label="Instructions for the patient" value={admission.dischargeInstructions} />
            <Fact label="Follow-up date" value={admission.followUpDate ? formatDate(admission.followUpDate) : null} />
            <Fact label="Time of death" value={admission.timeOfDeath ? formatDateTime(admission.timeOfDeath) : null} />
            <Fact label="Cause of death" value={admission.causeOfDeath} />
          </div>
        </Section>
      )}

      <Section title={`Notes (${admission.notes?.length ?? 0})`}>
        <NotesTimeline admissionId={admission.id} notes={admission.notes ?? []} canAdd={isCurrent} onSaved={handleChanged} />
      </Section>

      <Section title={`Vitals (${admission.vitals?.length ?? 0})`}>
        <VitalsTable admissionId={admission.id} readings={admission.vitals ?? []} canAdd={isCurrent} onSaved={handleChanged} />
      </Section>

      {/* Lab orders and prescriptions linked to this stay (they stay linked after discharge) */}
      <Section title="Linked lab orders and prescriptions">
        {(admission.labOrders?.length ?? 0) === 0 && (admission.prescriptions?.length ?? 0) === 0 ? (
          <p className="text-sm text-slate-400">Nothing linked to this admission yet. Lab orders and prescriptions made for this stay appear here.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {admission.labOrders?.map((order) => (
              <p key={order.id} className="text-slate-700">
                Lab order · {formatDate(order.createdAt)} · {order.status.toLowerCase()}
                {order.reviewedAt ? ' · reviewed' : ''}
              </p>
            ))}
            {admission.prescriptions?.map((prescription) => {
              const drugNames = parsePrescribedItems(prescription.medications).map((item) => item.name)
              return (
                <p key={prescription.id} className="text-slate-700">
                  Prescription · {formatDate(prescription.createdAt)} · {prescription.status.toLowerCase()}
                  {drugNames.length > 0 ? ` · ${drugNames.join(', ')}` : ''}
                </p>
              )
            })}
          </div>
        )}
      </Section>

      {/* Ordering labs from here links the order to this admission */}
      {isCurrent && admission.patient && (
        <Section title="Order lab tests for this stay">
          {!showLabPanel ? (
            <button
              onClick={() => setShowLabPanel(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-[#e6f0f9] text-[#0f3b5c] hover:bg-[#dbeaf8]"
            >
              Open lab ordering
            </button>
          ) : (
            <DoctorLabPanel patientId={admission.patient.id} patientName={admission.patient.fullName} admissionId={admission.id} />
          )}
        </Section>
      )}

      {/* Discharge and cancel: only while the patient is still admitted */}
      {isCurrent && (
        <Section title="Discharge patient">
          <DischargeForm admissionId={admission.id} canRecordDeath={viewerRole === 'DOCTOR'} onDischarged={handleChanged} />
        </Section>
      )}

      {isCurrent && (
        <Section title="Cancel this admission">
          <p className="text-sm text-slate-500 mb-3">
            Only for an admission made by mistake. It stays in the history, marked as cancelled, with your reason.
          </p>
          {!showCancelBox ? (
            <button
              onClick={() => setShowCancelBox(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-100 text-red-700 hover:bg-red-200"
            >
              Cancel admission
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={2}
                placeholder="Why is this admission being cancelled?"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {cancelling ? 'Cancelling...' : 'Confirm cancel'}
                </button>
                <button
                  onClick={() => setShowCancelBox(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                  Keep admission
                </button>
              </div>
            </div>
          )}
        </Section>
      )}
    </div>
  )
}
