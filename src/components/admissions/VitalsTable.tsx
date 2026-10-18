// src/components/admissions/VitalsTable.tsx
// The vitals readings of one admission as a table (oldest first), plus a form to add a new reading.

'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import type { VitalsReading } from '@/src/types'
import { formatDateTime } from '@/src/lib/format'

interface VitalsTableProps {
  admissionId: string
  readings: VitalsReading[]
  // False once the patient is discharged or the stay is cancelled: no more readings can be added
  canAdd: boolean
  onSaved: () => void
}

// A box left empty means "not measured", so it is left out of what we send
function numberOrUndefined(text: string): number | undefined {
  if (text.trim() === '') return undefined
  return Number(text)
}

function showValue(value: number | null): string {
  return value === null ? '—' : String(value)
}

const inputClasses = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]'

export default function VitalsTable({ admissionId, readings, canAdd, onSaved }: VitalsTableProps) {
  const [form, setForm] = useState({
    temperature: '', pulse: '', systolic: '', diastolic: '', respRate: '', spo2: '', weightKg: '',
  })
  const [saving, setSaving] = useState(false)

  function updateField(field: keyof typeof form, value: string) {
    setForm({ ...form, [field]: value })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const response = await fetch(`/api/admissions/${admissionId}/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temperature: numberOrUndefined(form.temperature),
          pulse: numberOrUndefined(form.pulse),
          systolic: numberOrUndefined(form.systolic),
          diastolic: numberOrUndefined(form.diastolic),
          respRate: numberOrUndefined(form.respRate),
          spo2: numberOrUndefined(form.spo2),
          weightKg: numberOrUndefined(form.weightKg),
        }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('Vitals recorded')
        setForm({ temperature: '', pulse: '', systolic: '', diastolic: '', respRate: '', spo2: '', weightKg: '' })
        onSaved()
      } else {
        toast.error(data.error || 'Could not save the vitals')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {readings.length === 0 ? (
        <p className="text-sm text-slate-400">No vitals recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-100">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Temp °C</th>
                <th className="py-2 pr-3">Pulse</th>
                <th className="py-2 pr-3">BP</th>
                <th className="py-2 pr-3">Resp</th>
                <th className="py-2 pr-3">SpO₂ %</th>
                <th className="py-2 pr-3">Weight kg</th>
                <th className="py-2">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {readings.map((reading) => (
                <tr key={reading.id}>
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDateTime(reading.recordedAt)}</td>
                  <td className="py-2 pr-3">{showValue(reading.temperature)}</td>
                  <td className="py-2 pr-3">{showValue(reading.pulse)}</td>
                  <td className="py-2 pr-3">
                    {reading.systolic !== null && reading.diastolic !== null ? `${reading.systolic}/${reading.diastolic}` : '—'}
                  </td>
                  <td className="py-2 pr-3">{showValue(reading.respRate)}</td>
                  <td className="py-2 pr-3">{showValue(reading.spo2)}</td>
                  <td className="py-2 pr-3">{showValue(reading.weightKg)}</td>
                  <td className="py-2 text-slate-500">{reading.recordedBy.fullName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canAdd && (
        <div className="border border-slate-100 rounded-xl p-4 bg-slate-50">
          <p className="text-sm font-semibold text-slate-700 mb-3">Record new vitals (leave blank what was not measured)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="text-xs text-slate-500">Temp °C
              <input className={inputClasses} type="number" step="0.1" value={form.temperature} onChange={(e) => updateField('temperature', e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">Pulse (bpm)
              <input className={inputClasses} type="number" value={form.pulse} onChange={(e) => updateField('pulse', e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">Systolic
              <input className={inputClasses} type="number" value={form.systolic} onChange={(e) => updateField('systolic', e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">Diastolic
              <input className={inputClasses} type="number" value={form.diastolic} onChange={(e) => updateField('diastolic', e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">Resp rate
              <input className={inputClasses} type="number" value={form.respRate} onChange={(e) => updateField('respRate', e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">SpO₂ %
              <input className={inputClasses} type="number" value={form.spo2} onChange={(e) => updateField('spo2', e.target.value)} />
            </label>
            <label className="text-xs text-slate-500">Weight kg
              <input className={inputClasses} type="number" step="0.1" value={form.weightKg} onChange={(e) => updateField('weightKg', e.target.value)} />
            </label>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 bg-[#0f3b5c] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save vitals'}
          </button>
        </div>
      )}
    </div>
  )
}
