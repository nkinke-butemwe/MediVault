// src/app/dashboard/next-of-kin/page.tsx
// Next of Kin dashboard — view assigned patients, provide/revoke emergency consent

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import toast from 'react-hot-toast'
import type { NextOfKinAssignment, Visit } from '@/src/types'
import {
  HeartIcon,
  InfoIcon,
  CheckCircleIcon,
  ClockIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@/src/components/icons'

export default function NextOfKinDashboard() {
  const { user } = useAuth()

  const [assignments, setAssignments] = useState<NextOfKinAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [patientVisits, setPatientVisits] = useState<Visit[]>([])
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [togglingConsent, setTogglingConsent] = useState<string | null>(null)

  // Fetch the list of patients this next of kin is assigned to
  const fetchAssignments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/next-of-kin')
      const data = await res.json()
      if (data.success) {
        setAssignments(data.data)
      }
    } catch {
      toast.error('Failed to load your assigned patients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Load recent visits for a selected patient
  const handleViewPatient = async (patientId: string) => {
    if (selectedPatientId === patientId) {
      setSelectedPatientId(null)
      return
    }
    setSelectedPatientId(patientId)
    setLoadingVisits(true)
    try {
      const res = await fetch(`/api/visits?patientId=${patientId}`)
      const data = await res.json()
      if (data.success) {
        setPatientVisits(data.data)
      }
    } catch {
      toast.error('Failed to load visit history')
    } finally {
      setLoadingVisits(false)
    }
  }

  // Toggle emergency consent for an assignment
  const handleToggleConsent = async (assignmentId: string) => {
    setTogglingConsent(assignmentId)
    try {
      const res = await fetch(`/api/next-of-kin/${assignmentId}/consent`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        toast.success(data.message)
        fetchAssignments()
      } else {
        toast.error(data.error || 'Failed to update consent')
      }
    } finally {
      setTogglingConsent(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0f3b5c]">Next of Kin Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome, {user?.fullName} · You are registered as next of kin for {assignments.length} patient{assignments.length !== 1 ? 's' : ''}.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <div className="flex justify-center mb-4 text-[#1f7b4d]">
            <HeartIcon size={56} strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No patients assigned yet</h3>
          <p className="text-slate-500 text-sm">
            A patient must assign you as their next of kin from their own MediVault dashboard. 
            They will need your User ID to do so.
          </p>
          <div className="mt-4 bg-slate-50 rounded-xl p-3 text-sm text-slate-600 inline-block">
            Your User ID: <code className="font-mono text-[#0f3b5c]">{user?.id}</code>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Your User ID for sharing */}
          <div className="bg-[#e6f0f9] rounded-2xl p-4 flex items-center gap-3">
            <InfoIcon size={22} className="text-[#0f3b5c] flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#0f3b5c]">Share your User ID with patients</p>
              <p className="text-xs text-[#2c475e] mt-0.5">
                Your ID: <code className="font-mono bg-white/60 px-2 py-0.5 rounded">{user?.id}</code>
              </p>
            </div>
          </div>

          {assignments.map((assignment) => (
            <div key={assignment.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Patient summary row */}
              <div className="p-5 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#0f3b5c] flex items-center justify-center text-white font-bold text-lg">
                    {assignment.patient.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{assignment.patient.fullName}</p>
                    <p className="text-sm text-slate-500">{assignment.patient.email}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Assigned: {new Date(assignment.delegatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Consent status + toggle */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                    assignment.emergencyConsentGiven
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-yellow-50 border border-yellow-200'
                  }`}>
                    {assignment.emergencyConsentGiven ? (
                      <CheckCircleIcon size={18} className="text-green-600 flex-shrink-0" />
                    ) : (
                      <ClockIcon size={18} className="text-yellow-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-xs font-semibold ${
                        assignment.emergencyConsentGiven ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        Emergency Consent: {assignment.emergencyConsentGiven ? 'Granted' : 'Not Given'}
                      </p>
                      {assignment.consentGivenAt && (
                        <p className="text-xs text-slate-400">
                          {new Date(assignment.consentGivenAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleConsent(assignment.id)}
                    disabled={togglingConsent === assignment.id}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-60 ${
                      assignment.emergencyConsentGiven
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {togglingConsent === assignment.id
                      ? 'Updating...'
                      : assignment.emergencyConsentGiven
                      ? 'Revoke Consent'
                      : 'Grant Consent'}
                  </button>

                  <button
                    onClick={() => handleViewPatient(assignment.patientId)}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-[#e6f0f9] text-[#0f3b5c] hover:bg-[#dbeaf8] transition-all inline-flex items-center gap-1.5"
                  >
                    {selectedPatientId === assignment.patientId ? (
                      <>Hide visits <ChevronUpIcon size={15} /></>
                    ) : (
                      <>View visits <ChevronDownIcon size={15} /></>
                    )}
                  </button>
                </div>
              </div>

              {/* Expanded visit history (only date and reason — no detailed clinical notes) */}
              {selectedPatientId === assignment.patientId && (
                <div className="border-t border-slate-100">
                  <div className="px-5 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
                    Recent Visit Summaries
                  </div>
                  {loadingVisits ? (
                    <div className="p-6 text-center">
                      <div className="w-6 h-6 border-3 border-[#0f3b5c] border-t-transparent rounded-full animate-spin mx-auto" />
                    </div>
                  ) : patientVisits.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No visits on record.</div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {/* Next of kin only sees date and reason — not detailed clinical notes */}
                      {patientVisits.slice(0, 5).map((visit) => (
                        <div key={visit.id} className="px-5 py-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-slate-700">{visit.reason}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {new Date(visit.visitDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                            visit.status === 'CHECKED_OUT' ? 'bg-green-100 text-green-700'
                            : visit.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {visit.status.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
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
