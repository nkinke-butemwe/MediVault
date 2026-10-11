// src/components/receptionist/AppointmentRequestsPanel.tsx
// The front desk's queue of appointment requests from patients.
// Confirming one books a visit on the chosen date and tells the patient;
// declining one needs a short reason the patient will read.

'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { AppointmentRequest, AppointmentStatus } from '@/src/types'
import { formatDate } from '@/src/lib/format'
import { CheckCircleIcon, XCircleIcon } from '@/src/components/icons'

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  CONFIRMED: 'bg-green-100 text-green-700',
  DECLINED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

// Turns the patient's preferred date into the value a date-time input needs,
// pre-filled at 09:00 so the receptionist only changes it if needed.
function defaultSlot(preferredDate: string): string {
  const date = new Date(preferredDate)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}T09:00`
}

export default function AppointmentRequestsPanel({ onChanged }: { onChanged?: () => void }) {
  const [view, setView] = useState<'open' | 'answered'>('open')
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
  const [loading, setLoading] = useState(true)
  // Which request is being answered right now, and with what
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  const [mode, setMode] = useState<'confirm' | 'decline'>('confirm')
  const [slot, setSlot] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = view === 'open' ? 'REQUESTED' : 'CONFIRMED,DECLINED,CANCELLED'
      const response = await fetch(`/api/appointment-requests?status=${status}`)
      const data = await response.json()
      if (data.success) setRequests(data.data)
    } catch {
      toast.error('Could not load appointment requests')
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    load()
  }, [load])

  const startAnswering = (request: AppointmentRequest, chosenMode: 'confirm' | 'decline') => {
    setAnsweringId(request.id)
    setMode(chosenMode)
    setSlot(defaultSlot(request.preferredDate))
    setNote('')
  }

  const handleSave = async () => {
    if (!answeringId) return
    if (mode === 'decline' && note.trim().length < 3) {
      toast.error('Please give the patient a reason')
      return
    }
    if (mode === 'confirm' && !slot) {
      toast.error('Choose the appointment date and time')
      return
    }

    setSaving(true)
    try {
      const body = mode === 'confirm' ? { action: 'confirm', scheduledFor: slot, responseNote: note || null } : { action: 'decline', responseNote: note }
      const response = await fetch(`/api/appointment-requests/${answeringId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(mode === 'confirm' ? 'Appointment confirmed and visit booked' : 'Request declined')
        setAnsweringId(null)
        load()
        onChanged?.()
      } else {
        toast.error(data.error || 'Could not save your answer')
        // Someone else may have answered it first; refresh so the queue is correct
        load()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['open', 'answered'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setView(tab)
              setAnsweringId(null)
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              view === tab ? 'bg-[#0f3b5c] text-white shadow' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab === 'open' ? 'Waiting for reply' : 'Answered'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-[#0f3b5c]">
            {view === 'open' ? 'Appointment Requests' : 'Answered Requests'} ({requests.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            {view === 'open' ? 'No requests waiting. Nice work.' : 'Nothing answered yet.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <div key={request.id} className="p-5">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">
                      {request.patient.fullName}
                      {request.patient.studentNumber && (
                        <span className="text-slate-400 font-normal"> · {request.patient.studentNumber}</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">{request.reason}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Wants {formatDate(request.preferredDate)}
                      {request.scheduledFor && ` · Booked ${formatDate(request.scheduledFor)}`}
                      {request.handledBy && ` · Answered by ${request.handledBy.fullName}`}
                    </p>
                    {request.responseNote && <p className="text-xs text-slate-500 italic mt-1">&ldquo;{request.responseNote}&rdquo;</p>}
                  </div>

                  {request.status === 'REQUESTED' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => startAnswering(request, 'confirm')}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-700 inline-flex items-center gap-1.5"
                      >
                        <CheckCircleIcon size={13} /> Confirm
                      </button>
                      <button
                        onClick={() => startAnswering(request, 'decline')}
                        className="bg-white text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-50 inline-flex items-center gap-1.5"
                      >
                        <XCircleIcon size={13} /> Decline
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLES[request.status]}`}>{request.status}</span>
                  )}
                </div>

                {/* The answer form opens under the request being answered */}
                {answeringId === request.id && (
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl space-y-3">
                    {mode === 'confirm' && (
                      <label className="block">
                        <span className="text-xs font-medium text-slate-600">Appointment date and time</span>
                        <input
                          type="datetime-local"
                          value={slot}
                          onChange={(event) => setSlot(event.target.value)}
                          className="mt-1 block px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                        />
                      </label>
                    )}
                    <label className="block">
                      <span className="text-xs font-medium text-slate-600">
                        {mode === 'confirm' ? 'Note for the patient (optional)' : 'Reason (the patient will read this)'}
                      </span>
                      <input
                        type="text"
                        value={note}
                        maxLength={500}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder={mode === 'confirm' ? 'e.g. Please bring your student ID' : 'e.g. No doctor available that day, please request another date'}
                        className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#0f3b5c] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] disabled:opacity-60"
                      >
                        {saving ? 'Saving...' : mode === 'confirm' ? 'Confirm appointment' : 'Decline request'}
                      </button>
                      <button onClick={() => setAnsweringId(null)} className="px-4 py-2 rounded-xl text-sm text-slate-500 hover:bg-slate-100">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
