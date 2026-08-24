// src/app/dashboard/patient/page.tsx
// Patient dashboard — shows medical profile, visits, next of kin management, and access logs

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ComponentType } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import toast from 'react-hot-toast'
import type { MedicalRecord, Visit, NextOfKinAssignment, AccessLog, Medication } from '@/src/types'
import {
  FileTextIcon,
  CalendarIcon,
  ClockIcon,
  HeartIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  PillIcon,
  type IconProps,
} from '@/src/components/icons'

// ── Stat Card component ──────────────────────────────────────────────────────
// "icon" takes an icon component reference (e.g. FileTextIcon), which we
// then render below as <Icon size={22} />. Passing the component itself
// (rather than an already-rendered element) keeps the call sites short.
//
// Note on the "trim": this card used to combine `border-l-4` (a colored
// accent bar on the left edge) with `rounded-2xl` (rounded corners) on the
// SAME element. When you do that, the browser rounds the corners of the
// accent bar too, so the top and bottom of the bar get clipped into little
// curved stubs instead of running the full height of the card. To fix this
// we now draw the accent bar as its own absolutely-positioned rectangle
// with square corners, layered underneath the rounded white card, so the
// bar always looks like a clean, full-height strip.
function StatCard({
  icon: Icon,
  label,
  value,
  accentColor,
}: {
  icon: ComponentType<IconProps>
  label: string
  value: string | number
  accentColor: string
}) {
  return (
    <div className="relative bg-white rounded-2xl p-5 shadow-sm overflow-hidden">
      {/* Square-cornered accent bar, drawn separately so it is never clipped by the card's rounded corners */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
      <div className="flex items-center justify-between pl-2">
        <div>
          <p className="text-sm text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-[#0f3b5c] mt-1">{value}</p>
        </div>
        <Icon size={26} className="text-slate-300" />
      </div>
    </div>
  )
}

// ── Status badge ─────────────────────────────────────────────────────────────
function VisitStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    WAITING: 'bg-yellow-100 text-yellow-800',
    CHECKED_IN: 'bg-blue-100 text-blue-800',
    IN_CONSULTATION: 'bg-purple-100 text-purple-800',
    CHECKED_OUT: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${classes[status] || 'bg-gray-100 text-gray-800'}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default function PatientDashboard() {
  const { user, loading: authLoading } = useAuth()

  // Data state
  const [records, setRecords] = useState<MedicalRecord[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [kinAssignments, setKinAssignments] = useState<NextOfKinAssignment[]>([])
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([])
  const [dataLoading, setDataLoading] = useState(true)

  // Next of kin assignment state
  const [kinUserId, setKinUserId] = useState('')
  const [assigningKin, setAssigningKin] = useState(false)

  // Active section for tab navigation
  const [activeSection, setActiveSection] = useState<'overview' | 'records' | 'visits' | 'kin' | 'logs'>('overview')

  // Fetch all data for this patient
  const fetchData = useCallback(async () => {
    if (!user) return
    setDataLoading(true)
    try {
      const [recRes, visitRes, kinRes, logRes] = await Promise.all([
        fetch(`/api/medical-records?patientId=${user.id}`),
        fetch(`/api/visits?patientId=${user.id}`),
        fetch(`/api/next-of-kin?patientId=${user.id}`),
        fetch(`/api/access-logs`),
      ])
      const [recData, visitData, kinData, logData] = await Promise.all([
        recRes.json(),
        visitRes.json(),
        kinRes.json(),
        logRes.json(),
      ])
      if (recData.success) setRecords(recData.data)
      if (visitData.success) setVisits(visitData.data)
      if (kinData.success) setKinAssignments(kinData.data)
      if (logData.success) setAccessLogs(logData.data.items)
    } catch {
      toast.error('Failed to load some data')
    } finally {
      setDataLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  const handleAssignKin = async () => {
    if (!kinUserId.trim()) {
      toast.error('Please enter a Next of Kin user ID')
      return
    }
    setAssigningKin(true)
    try {
      const res = await fetch('/api/next-of-kin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kinUserId }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Next of kin assigned successfully!')
        setKinUserId('')
        fetchData()
      } else {
        toast.error(data.error || 'Failed to assign next of kin')
      }
    } finally {
      setAssigningKin(false)
    }
  }

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const upcomingVisits = visits.filter(v => ['WAITING', 'CHECKED_IN', 'IN_CONSULTATION'].includes(v.status))
  const pastVisits = visits.filter(v => ['CHECKED_OUT', 'CANCELLED'].includes(v.status))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0f3b5c]">Welcome, {user?.fullName} </h1>
        <p className="text-slate-500 text-sm mt-1">Your personal health portal · Student No: {user?.studentNumber || 'N/A'}</p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['overview', 'records', 'visits', 'kin', 'logs'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeSection === s
                ? 'bg-[#0f3b5c] text-white shadow'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* ── Overview Section ──────────────────────────────────────────── */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={FileTextIcon} label="Medical Records" value={records.length} accentColor="bg-blue-500" />
            <StatCard icon={CalendarIcon} label="Total Visits" value={visits.length} accentColor="bg-teal-500" />
            <StatCard icon={ClockIcon} label="Upcoming" value={upcomingVisits.length} accentColor="bg-yellow-500" />
            <StatCard icon={HeartIcon} label="Next of Kin" value={kinAssignments.length > 0 ? 'Assigned' : 'None'} accentColor="bg-green-500" />
          </div>

          {/* Recent activity */}
          {records.length > 0 && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-semibold text-[#0f3b5c] mb-4">Latest Medical Record</h3>
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-slate-800">{records[0].diagnosis}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      Dr. {records[0].doctor?.fullName} · {new Date(records[0].visitDate).toLocaleDateString()}
                    </p>
                  </div>
                  {records[0].followUpDate && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                      <CalendarIcon size={13} />
                      Follow-up: {new Date(records[0].followUpDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {records[0].allergies && (
                  <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                      <AlertTriangleIcon size={13} />
                      Known Allergies: {records[0].allergies}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Medical Records Section ───────────────────────────────────── */}
      {activeSection === 'records' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-[#0f3b5c]">Medical Records ({records.length})</h2>
          </div>
          {records.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No medical records found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {records.map((record) => (
                <div key={record.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-slate-800">{record.diagnosis}</h3>
                    <span className="text-xs text-slate-400">{new Date(record.visitDate).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">Dr. {record.doctor?.fullName}</p>
                  {record.allergies && (
                    <p className="text-xs bg-red-50 text-red-700 px-3 py-1 rounded-lg inline-flex items-center gap-1.5 mb-2">
                      <AlertTriangleIcon size={13} />
                      Allergies: {record.allergies}
                    </p>
                  )}
                  {record.medications && (record.medications as Medication[]).length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-slate-600 mb-1">Medications:</p>
                      <div className="flex flex-wrap gap-2">
                        {(record.medications as Medication[]).map((med: Medication, i: number) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full inline-flex items-center gap-1">
                            <PillIcon size={12} />
                            {med.name} {med.dose} — {med.duration}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {record.notes && (
                    <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-slate-200 pl-3">{record.notes}</p>
                  )}
                  {record.followUpDate && (
                    <p className="text-xs text-blue-600 mt-2 flex items-center gap-1.5">
                      <CalendarIcon size={13} />
                      Follow-up: {new Date(record.followUpDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Visits Section ────────────────────────────────────────────── */}
      {activeSection === 'visits' && (
        <div className="space-y-4">
          {upcomingVisits.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-[#0f3b5c]">Active / Upcoming Visits</h2>
              </div>
              <div className="divide-y divide-slate-100">
                {upcomingVisits.map((visit) => (
                  <div key={visit.id} className="p-5 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-800">{visit.reason}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {new Date(visit.visitDate).toLocaleDateString()} · {visit.vitals || 'Vitals not recorded'}
                      </p>
                    </div>
                    <VisitStatusBadge status={visit.status} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-[#0f3b5c]">Visit History ({pastVisits.length})</h2>
            </div>
            {pastVisits.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No past visits.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pastVisits.map((visit) => (
                  <div key={visit.id} className="p-5 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-slate-800">{visit.reason}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {new Date(visit.visitDate).toLocaleDateString()} · {visit.vitals || 'N/A'}
                      </p>
                      {visit.doctorNotes && (
                        <p className="text-xs text-slate-400 mt-1 italic">{visit.doctorNotes}</p>
                      )}
                    </div>
                    <VisitStatusBadge status={visit.status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Next of Kin Section ───────────────────────────────────────── */}
      {activeSection === 'kin' && (
        <div className="space-y-4">
          {kinAssignments.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-[#0f3b5c]">Current Next of Kin</h2>
              </div>
              {kinAssignments.map((assignment) => (
                <div key={assignment.id} className="p-5">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-800">{assignment.nextOfKin.fullName}</p>
                      <p className="text-sm text-slate-500">{assignment.nextOfKin.email}</p>
                      {assignment.nextOfKin.phone && (
                        <p className="text-sm text-slate-500">{assignment.nextOfKin.phone}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {assignment.emergencyConsentGiven ? (
                        <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                          <CheckCircleIcon size={13} />
                          Consent Given
                        </span>
                      ) : (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                          <ClockIcon size={13} />
                          Consent Pending
                        </span>
                      )}
                      {assignment.consentGivenAt && (
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(assignment.consentGivenAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#0f3b5c] mb-4">
              {kinAssignments.length > 0 ? 'Update Next of Kin' : 'Assign Next of Kin'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Enter the User ID of the person you want to designate as your next of kin.
              They must already have a MediVault account with the &apos;Next of Kin&apos; role.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={kinUserId}
                onChange={(e) => setKinUserId(e.target.value)}
                placeholder="Next of Kin User ID (e.g. clxxx...)"
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <button
                onClick={handleAssignKin}
                disabled={assigningKin}
                className="bg-[#0f3b5c] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60"
              >
                {assigningKin ? 'Saving...' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Access Logs Section ───────────────────────────────────────── */}
      {activeSection === 'logs' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-lg font-semibold text-[#0f3b5c]">Access History — Who viewed your record</h2>
          </div>
          {accessLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No access logs yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {accessLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {log.accessedBy.fullName} ({log.accessedBy.role})
                    </p>
                    <p className="text-xs text-slate-500">
                      {log.action} · {log.resourceType}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
