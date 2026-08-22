// src/app/dashboard/receptionist/page.tsx
// Receptionist dashboard — student verification, walk-in registration, today's visits

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/src/hooks/useAuth'
import toast from 'react-hot-toast'
import type { Visit } from '@/src/types'
import {
  SearchIcon,
  CalendarIcon,
  UserPlusIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  RefreshIcon,
  PlusIcon,
} from '@/src/components/icons'

// ── Status badge ──────────────────────────────────────────────────────────────
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

// ── Verification result type ───────────────────────────────────────────────────
interface VerificationResult {
  found: boolean
  eligible: boolean
  reason: string
  patient: {
    id: string
    fullName: string
    email: string
    studentNumber: string
    phone: string | null
    bloodType: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
  } | null
}

export default function ReceptionistDashboard() {
  const { user } = useAuth()

  // Student verification state
  const [studentNumber, setStudentNumber] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)

  // Walk-in visit registration state
  const [visitReason, setVisitReason] = useState('')
  const [visitVitals, setVisitVitals] = useState('')
  const [registeringVisit, setRegisteringVisit] = useState(false)

  // Today's visits
  const [todayVisits, setTodayVisits] = useState<Visit[]>([])
  const [visitsLoading, setVisitsLoading] = useState(true)

  // Active section tabs
  const [activeSection, setActiveSection] = useState<'verify' | 'visits' | 'register'>('verify')

  // New patient registration state
  const [newPatient, setNewPatient] = useState({
    fullName: '', email: '', studentNumber: '', password: 'password123', phone: '',
    bloodType: '', dateOfBirth: '', address: '',
  })
  const [creatingPatient, setCreatingPatient] = useState(false)

  const fetchTodayVisits = useCallback(async () => {
    setVisitsLoading(true)
    try {
      const res = await fetch('/api/visits')
      const data = await res.json()
      if (data.success) setTodayVisits(data.data)
    } catch {
      toast.error('Failed to load visits')
    } finally {
      setVisitsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTodayVisits()
  }, [fetchTodayVisits])

  // ── Student Verification ──────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!studentNumber.trim()) {
      toast.error('Please enter a student number')
      return
    }
    setVerifying(true)
    setVerificationResult(null)
    try {
      const res = await fetch(`/api/verify-student/${encodeURIComponent(studentNumber.trim())}`)
      const data = await res.json()
      if (data.success) {
        setVerificationResult(data.data)
      } else {
        toast.error(data.error || 'Verification failed')
      }
    } catch {
      toast.error('Network error during verification')
    } finally {
      setVerifying(false)
    }
  }

  // ── Register Walk-in Visit ────────────────────────────────────────────────
  const handleRegisterVisit = async () => {
    if (!verificationResult?.patient) return
    if (!visitReason.trim()) {
      toast.error('Please enter a reason for the visit')
      return
    }
    setRegisteringVisit(true)
    try {
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: verificationResult.patient.id,
          reason: visitReason,
          vitals: visitVitals || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Visit registered successfully!')
        setVisitReason('')
        setVisitVitals('')
        setVerificationResult(null)
        setStudentNumber('')
        fetchTodayVisits()
      } else {
        toast.error(data.error || 'Failed to register visit')
      }
    } finally {
      setRegisteringVisit(false)
    }
  }

  // ── Update Visit Status ───────────────────────────────────────────────────
  const handleUpdateStatus = async (visitId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/visits/${visitId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Visit status updated')
        fetchTodayVisits()
      } else {
        toast.error(data.error || 'Failed to update status')
      }
    } catch {
      toast.error('Network error')
    }
  }

  // ── Create New Patient Account ────────────────────────────────────────────
  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingPatient(true)
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newPatient, role: 'PATIENT' }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Patient account created for ${newPatient.fullName}`)
        setNewPatient({
          fullName: '', email: '', studentNumber: '', password: 'password123', phone: '',
          bloodType: '', dateOfBirth: '', address: '',
        })
      } else {
        toast.error(data.error || 'Failed to create patient')
      }
    } finally {
      setCreatingPatient(false)
    }
  }

  // Count visits by status
  const waitingCount = todayVisits.filter(v => v.status === 'WAITING').length
  const inProgressCount = todayVisits.filter(v => ['CHECKED_IN', 'IN_CONSULTATION'].includes(v.status)).length
  const completedCount = todayVisits.filter(v => v.status === 'CHECKED_OUT').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0f3b5c]">Receptionist Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          Welcome, {user?.fullName} · {new Date().toLocaleDateString('en-ZM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      {/*
        Note on the accent bar: each card below shows a colored strip on its
        left edge. We draw that strip as its own small absolutely-positioned
        rectangle (with square corners) instead of using Tailwind's
        `border-l-4` directly on the rounded card. If we put border-l-4 on
        the same element as `rounded-2xl`, the browser rounds the corners of
        the border too, which makes the strip look "trimmed" — curved stubs
        at the top and bottom instead of a full straight bar. Separating the
        strip into its own element avoids that clipping entirely.
      */}
      <div className="grid grid-cols-3 gap-4">
        <div className="relative bg-white rounded-2xl p-5 shadow-sm overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow-400" />
          <p className="text-sm text-slate-500 pl-2">Waiting</p>
          <p className="text-3xl font-bold text-[#0f3b5c] pl-2">{waitingCount}</p>
        </div>
        <div className="relative bg-white rounded-2xl p-5 shadow-sm overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400" />
          <p className="text-sm text-slate-500 pl-2">In Progress</p>
          <p className="text-3xl font-bold text-[#0f3b5c] pl-2">{inProgressCount}</p>
        </div>
        <div className="relative bg-white rounded-2xl p-5 shadow-sm overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-400" />
          <p className="text-sm text-slate-500 pl-2">Completed Today</p>
          <p className="text-3xl font-bold text-[#0f3b5c] pl-2">{completedCount}</p>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['verify', 'visits', 'register'] as const).map((s) => {
          // Pick which icon and label go with each tab
          const TabIcon = s === 'verify' ? SearchIcon : s === 'visits' ? CalendarIcon : UserPlusIcon
          const tabLabel = s === 'verify' ? 'Verify Student' : s === 'visits' ? "Today's Visits" : 'Register Patient'
          return (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-2 ${
                activeSection === s
                  ? 'bg-[#0f3b5c] text-white shadow'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <TabIcon size={16} />
              {tabLabel}
            </button>
          )
        })}
      </div>

      {/* ── Student Verification Panel ──────────────────────────────────── */}
      {activeSection === 'verify' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-[#0f3b5c] mb-2">Student Number Verification</h2>
            <p className="text-sm text-slate-500 mb-4">
              Enter the student&apos;s number to verify their eligibility without a physical ID card.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="e.g. 2022082613"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <button
                onClick={handleVerify}
                disabled={verifying}
                className="bg-[#0f3b5c] text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60 inline-flex items-center gap-2"
              >
                {verifying ? (
                  'Checking...'
                ) : (
                  <>
                    Verify
                    <ArrowRightIcon size={16} />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Verification Result */}
          {verificationResult && (
            <div className="relative bg-white rounded-2xl shadow-sm p-6 overflow-hidden">
              {/* Square-cornered accent bar — see note above about avoiding the "trimmed" look */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                verificationResult.eligible ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <div className="flex items-center gap-3 mb-4 pl-2">
                {verificationResult.eligible ? (
                  <CheckCircleIcon size={30} className="text-green-600 flex-shrink-0" />
                ) : (
                  <XCircleIcon size={30} className="text-red-600 flex-shrink-0" />
                )}
                <div>
                  <h3 className={`font-bold text-lg ${verificationResult.eligible ? 'text-green-700' : 'text-red-700'}`}>
                    {verificationResult.eligible ? 'Student Eligible' : 'Not Eligible'}
                  </h3>
                  <p className="text-sm text-slate-500">{verificationResult.reason}</p>
                </div>
              </div>

              {verificationResult.patient && (
                <div className="space-y-4">
                  {/* Patient info card */}
                  <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-slate-500">Full Name:</span> <strong>{verificationResult.patient.fullName}</strong></div>
                    <div><span className="text-slate-500">Student No:</span> <strong>{verificationResult.patient.studentNumber}</strong></div>
                    <div><span className="text-slate-500">Email:</span> <strong>{verificationResult.patient.email}</strong></div>
                    <div><span className="text-slate-500">Phone:</span> <strong>{verificationResult.patient.phone || 'N/A'}</strong></div>
                    {verificationResult.patient.bloodType && (
                      <div><span className="text-slate-500">Blood Type:</span> <strong className="text-red-600">{verificationResult.patient.bloodType}</strong></div>
                    )}
                    {verificationResult.patient.emergencyContactName && (
                      <div><span className="text-slate-500">Emergency Contact:</span> <strong>{verificationResult.patient.emergencyContactName} ({verificationResult.patient.emergencyContactPhone})</strong></div>
                    )}
                  </div>

                  {/* Register walk-in visit */}
                  <div className="border-t border-slate-100 pt-4">
                    <h4 className="font-semibold text-slate-700 mb-3">Register Walk-in Visit</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={visitReason}
                        onChange={(e) => setVisitReason(e.target.value)}
                        placeholder="Reason for visit (e.g. fever and headache)"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                      />
                      <input
                        type="text"
                        value={visitVitals}
                        onChange={(e) => setVisitVitals(e.target.value)}
                        placeholder="Vitals (optional, e.g. BP: 120/80, Temp: 37.1°C)"
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                      />
                      <button
                        onClick={handleRegisterVisit}
                        disabled={registeringVisit || !visitReason}
                        className="bg-[#1f7b4d] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#186040] transition-all disabled:opacity-60 inline-flex items-center gap-2"
                      >
                        {registeringVisit ? (
                          'Registering...'
                        ) : (
                          <>
                            <PlusIcon size={15} />
                            Register Visit
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Today's Visits Panel ────────────────────────────────────────── */}
      {activeSection === 'visits' && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-[#0f3b5c]">
              Today&apos;s Visits ({todayVisits.length})
            </h2>
            <button onClick={fetchTodayVisits} className="text-sm text-[#0f3b5c] hover:underline inline-flex items-center gap-1.5">
              <RefreshIcon size={14} />
              Refresh
            </button>
          </div>
          {visitsLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : todayVisits.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No visits registered today.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-5 py-3 text-left">Patient</th>
                    <th className="px-5 py-3 text-left">Student No</th>
                    <th className="px-5 py-3 text-left">Reason</th>
                    <th className="px-5 py-3 text-left">Vitals</th>
                    <th className="px-5 py-3 text-left">Status</th>
                    <th className="px-5 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayVisits.map((visit) => (
                    <tr key={visit.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">{visit.patient.fullName}</td>
                      <td className="px-5 py-3 text-slate-500">{visit.patient.studentNumber || '—'}</td>
                      <td className="px-5 py-3 text-slate-600 max-w-[200px] truncate">{visit.reason}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{visit.vitals || '—'}</td>
                      <td className="px-5 py-3"><VisitStatusBadge status={visit.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          {visit.status === 'WAITING' && (
                            <button
                              onClick={() => handleUpdateStatus(visit.id, 'CHECKED_IN')}
                              className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200"
                            >
                              Check In
                            </button>
                          )}
                          {visit.status === 'CHECKED_IN' && (
                            <button
                              onClick={() => handleUpdateStatus(visit.id, 'CHECKED_OUT')}
                              className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200"
                            >
                              Check Out
                            </button>
                          )}
                          {['WAITING', 'CHECKED_IN'].includes(visit.status) && (
                            <button
                              onClick={() => handleUpdateStatus(visit.id, 'CANCELLED')}
                              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Register New Patient Panel ───────────────────────────────────── */}
      {activeSection === 'register' && (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-[#0f3b5c] mb-5">Register New Patient</h2>
          <form onSubmit={handleCreatePatient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
              <input
                required
                value={newPatient.fullName}
                onChange={(e) => setNewPatient({ ...newPatient, fullName: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                placeholder="e.g. Mwansa Chilufya"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email Address *</label>
              <input
                required
                type="email"
                value={newPatient.email}
                onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                placeholder="student@students.unza.zm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Student Number</label>
              <input
                value={newPatient.studentNumber}
                onChange={(e) => setNewPatient({ ...newPatient, studentNumber: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                placeholder="e.g. 2023001234"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number</label>
              <input
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                placeholder="+260977000000"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
              <input
                type="date"
                value={newPatient.dateOfBirth}
                onChange={(e) => setNewPatient({ ...newPatient, dateOfBirth: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Blood Type</label>
              <select
                value={newPatient.bloodType}
                onChange={(e) => setNewPatient({ ...newPatient, bloodType: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] bg-white"
              >
                <option value="">Unknown</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bt => (
                  <option key={bt} value={bt}>{bt}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
              <input
                value={newPatient.address}
                onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                placeholder="Student residence or home address"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Temporary Password (patient must change on first login)
              </label>
              <input
                required
                value={newPatient.password}
                onChange={(e) => setNewPatient({ ...newPatient, password: e.target.value })}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={creatingPatient}
                className="bg-[#0f3b5c] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60 inline-flex items-center gap-2"
              >
                {creatingPatient ? (
                  'Creating...'
                ) : (
                  <>
                    <PlusIcon size={15} />
                    Create Patient Account
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
