// src/components/patient/TimelineView.tsx
// The patient's care timeline: records, visits, prescriptions, released lab
// results and appointment requests in ONE list, newest first. The server
// builds the list (src/lib/timeline.ts); this component only displays it.

'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ComponentType } from 'react'
import type { TimelineEvent, TimelineKind } from '@/src/types'
import { formatDate } from '@/src/lib/format'
import { setUrlHash } from '@/src/hooks/useHashSection'
import {
  FileTextIcon,
  CalendarIcon,
  PillIcon,
  FlaskIcon,
  ClockIcon,
  type IconProps,
} from '@/src/components/icons'

// Colour + icon + label for each kind of event
const KIND_STYLES: Record<TimelineKind, { label: string; icon: ComponentType<IconProps>; dot: string }> = {
  RECORD: { label: 'Records', icon: FileTextIcon, dot: 'bg-blue-100 text-blue-700' },
  VISIT: { label: 'Visits', icon: CalendarIcon, dot: 'bg-teal-100 text-teal-700' },
  PRESCRIPTION: { label: 'Prescriptions', icon: PillIcon, dot: 'bg-green-100 text-green-700' },
  LAB: { label: 'Lab results', icon: FlaskIcon, dot: 'bg-purple-100 text-purple-700' },
  APPOINTMENT: { label: 'Appointments', icon: ClockIcon, dot: 'bg-yellow-100 text-yellow-800' },
}

export default function TimelineView({ patientId }: { patientId?: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // null means "show every kind"
  const [filter, setFilter] = useState<TimelineKind | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // A patient never needs to pass an id; a doctor passes the patient's id
      const url = patientId ? `/api/timeline?patientId=${encodeURIComponent(patientId)}` : '/api/timeline'
      const response = await fetch(url)
      const data = await response.json()
      if (data.success) setEvents(data.data)
      else setError(data.error || 'Could not load the timeline')
    } catch {
      setError('Could not load the timeline')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-8 h-8 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const visibleEvents = filter ? events.filter((event) => event.kind === filter) : events

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#0f3b5c]">Care Timeline</h2>
        <p className="text-sm text-slate-500 mt-1">Everything in your care at the clinic, in date order.</p>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium border ${
              filter === null ? 'bg-[#0f3b5c] text-white border-[#0f3b5c]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All ({events.length})
          </button>
          {(Object.keys(KIND_STYLES) as TimelineKind[]).map((kind) => {
            const count = events.filter((event) => event.kind === kind).length
            if (count === 0) return null
            return (
              <button
                key={kind}
                onClick={() => setFilter(kind)}
                className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  filter === kind ? 'bg-[#0f3b5c] text-white border-[#0f3b5c]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {KIND_STYLES[kind].label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-2xl p-4">{error}</div>}

      {!error && visibleEvents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm">Nothing on your timeline yet.</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <ol className="relative border-l-2 border-slate-100 ml-4 space-y-6">
            {visibleEvents.map((event) => {
              const style = KIND_STYLES[event.kind]
              const KindIcon = style.icon
              return (
                <li key={event.id} className="ml-6">
                  <span className={`absolute -left-[17px] w-8 h-8 rounded-full flex items-center justify-center ring-4 ring-white ${style.dot}`}>
                    <KindIcon size={15} />
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800">{event.title}</p>
                    {event.status && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {event.status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  {event.detail && <p className="text-sm text-slate-500 mt-0.5">{event.detail}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-400">{formatDate(event.date)}</span>
                    {event.section && (
                      <button onClick={() => setUrlHash(event.section as string, 'push')} className="text-xs text-blue-600 hover:underline">
                        View details
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}
    </div>
  )
}
