// src/components/admissions/NotesTimeline.tsx
// The notes written during one admission, oldest first, like a chart. Notes cannot be edited or
// deleted (the server has no endpoint for it), so this component only displays and adds.

'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { AdmissionNote, AdmissionNoteKind } from '@/src/types'
import { formatDateTime, formatDoctorName } from '@/src/lib/format'
import { ADMISSION_NOTE_KIND_LABELS, labelFor } from '@/src/lib/admission-labels'

interface NotesTimelineProps {
  admissionId: string
  notes: AdmissionNote[]
  // False once the patient is discharged or the stay is cancelled: no more notes can be added
  canAdd: boolean
  onSaved: () => void
}

const NOTE_KINDS: AdmissionNoteKind[] = ['PROGRESS', 'WARD_ROUND', 'PROCEDURE', 'DIAGNOSIS_UPDATE']

export default function NotesTimeline({ admissionId, notes, canAdd, onSaved }: NotesTimelineProps) {
  const [kind, setKind] = useState<AdmissionNoteKind>('PROGRESS')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (body.trim() === '') {
      toast.error('Write something in the note first')
      return
    }
    setSaving(true)
    try {
      const response = await fetch(`/api/admissions/${admissionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, body }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Note added')
        setBody('')
        onSaved()
      } else {
        toast.error(data.error || 'Could not save the note')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ol className="space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="border-l-2 border-[#0f3b5c] pl-4">
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-[#0f3b5c]">{labelFor(ADMISSION_NOTE_KIND_LABELS, note.kind)}</span>
                {' · '}{formatDateTime(note.createdAt)}{' · '}{formatDoctorName(note.author.fullName)}
              </p>
              {/* whitespace-pre-wrap keeps the line breaks the doctor typed */}
              <p className="text-sm text-slate-800 mt-1 whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ol>
      )}

      {canAdd && (
        <div className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as AdmissionNoteKind)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            {NOTE_KINDS.map((noteKind) => (
              <option key={noteKind} value={noteKind}>{labelFor(ADMISSION_NOTE_KIND_LABELS, noteKind)}</option>
            ))}
          </select>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder="Write a note. Notes cannot be edited or deleted once saved."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#0f3b5c] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Add note'}
          </button>
        </div>
      )}
    </div>
  )
}
