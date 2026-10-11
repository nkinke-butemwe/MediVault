// src/components/patient/AppointmentsPanel.tsx
// Lets a patient ask for an appointment and follow what happened to each request.
//   REQUESTED -> waiting for reception to answer
//   CONFIRMED -> booked (it also appears under "My Visits")
//   DECLINED  -> reception said no and left a reason
//   CANCELLED -> the patient withdrew it

'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { AppointmentRequest, AppointmentStatus } from '@/src/types'
import { formatDate } from '@/src/lib/format'
import { MAX_DAYS_AHEAD } from '@/src/lib/appointments'
import { CalendarIcon, CloseIcon } from '@/src/components/icons'

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

// Turns a Date into the "YYYY-MM-DD" text a date input understands (in local time)
function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export default function AppointmentsPanel({ onChanged }: { onChanged?: () => void }) {
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [preferredDate, setPreferredDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // The earliest and latest dates the date picker will allow
  const today = new Date()
  const latest = new Date()
  latest.setDate(latest.getDate() + MAX_DAYS_AHEAD)

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/appointment-requests')
      const data = await response.json()
      if (data.success) setRequests(data.data)
    } catch {
      toast.error('Could not load your appointment requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSubmit = async () => {
    if (!preferredDate) {
      toast.error('Please choose a date')
      return
    }
    if (reason.trim().length < 3) {
      toast.error('Please say why you want to come in')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/appointment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredDate, reason }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Request sent. Reception will reply soon.')
        setPreferredDate('')
        setReason('')
        load()
        onChanged?.()
      } else {
        toast.error(data.error || 'Could not send your request')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this appointment request?')) return
    const response = await fetch(`/api/appointment-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    const data = await response.json()
    if (data.success) {
      toast.success('Request cancelled')
      load()
      onChanged?.()
    } else {
      toast.error(data.error || 'Could not cancel')
    }
  }

  return (
    <div className="space-y-4">
      {/* New request form */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#0f3b5c] flex items-center gap-2">
          <CalendarIcon size={18} /> Request an Appointment
        </h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">
          Tell reception when you would like to come and why. They will confirm a date or reply with another option.
        </p>
        <div className="grid md:grid-cols-[200px_1fr_auto] gap-3 items-end">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Preferred date</span>
            <input
              type="date"
              value={preferredDate}
              min={toDateInputValue(today)}
              max={toDateInputValue(latest)}
              onChange={(event) => setPreferredDate(event.target.value)}
              className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Reason for visit</span>
            <input
              type="text"
              value={reason}
              maxLength={300}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Follow-up on my cough, medical certificate..."
              className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
            />
          </label>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#0f3b5c] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Send request'}
          </button>
        </div>
      </div>

      {/* My requests */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-[#0f3b5c]">My Requests ({requests.length})</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">You haven&apos;t requested any appointments yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <div key={request.id} className="p-5 flex justify-between items-start gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{request.reason}</p>
                  <p className="text-sm text-slate-500 mt-1">
                    Asked for {formatDate(request.preferredDate)}
                    {request.status === 'CONFIRMED' && request.scheduledFor && (
                      <span className="text-green-700 font-medium"> · Booked for {formatDate(request.scheduledFor)}</span>
                    )}
                  </p>
                  {request.responseNote && (
                    <p className="text-xs text-slate-500 mt-2 italic border-l-2 border-slate-200 pl-3">
                      Reception: {request.responseNote}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[request.status]}`}>
                    {request.status}
                  </span>
                  {(request.status === 'REQUESTED' || request.status === 'CONFIRMED') && (
                    <button
                      onClick={() => handleCancel(request.id)}
                      className="text-xs text-red-600 hover:underline inline-flex items-center gap-1"
                    >
                      <CloseIcon size={12} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
