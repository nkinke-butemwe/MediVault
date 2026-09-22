// src/components/lab/DoctorLabPanel.tsx
// The doctor's lab section for ONE selected patient:
//   1. order new tests from the lab catalogue
//   2. see every order for that patient with its results and flags
//   3. review completed results (this releases them to the patient) or cancel an order nobody has started

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { LabOrder, LabTestInfo } from '@/src/types'
import LabOrderCard from '@/src/components/lab/LabOrderCard'
import { formatReferenceRange } from '@/src/lib/lab'

interface DoctorLabPanelProps {
  patientId: string
  patientName: string
}

export default function DoctorLabPanel({ patientId, patientName }: DoctorLabPanelProps) {
  const [catalogue, setCatalogue] = useState<LabTestInfo[]>([])
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [loading, setLoading] = useState(true)

  // New-order form
  const [selected, setSelected] = useState<string[]>([])
  const [priority, setPriority] = useState<'ROUTINE' | 'URGENT'>('ROUTINE')
  const [clinicalNotes, setClinicalNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Review form: which order is being reviewed and the comment typed so far
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [testsRes, ordersRes] = await Promise.all([
        fetch('/api/lab/tests'),
        fetch(`/api/lab/orders?patientId=${patientId}`),
      ])
      const [testsData, ordersData] = await Promise.all([testsRes.json(), ordersRes.json()])
      if (testsData.success) setCatalogue(testsData.data)
      if (ordersData.success) setOrders(ordersData.data)
      else toast.error(ordersData.error || 'Failed to load lab orders')
    } catch {
      toast.error('Network error while loading lab data')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  // Group the catalogue by category for the checklist
  const byCategory = useMemo(() => {
    const groups = new Map<string, LabTestInfo[]>()
    for (const t of catalogue) groups.set(t.category, [...(groups.get(t.category) ?? []), t])
    return Array.from(groups.entries())
  }, [catalogue])

  const toggle = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const handleOrder = async () => {
    if (selected.length === 0) { toast.error('Select at least one test'); return }
    setSubmitting(true)
    try {
      const res = await fetch('/api/lab/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, testIds: selected, priority, clinicalNotes: clinicalNotes || null }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Lab order sent')
        setSelected([]); setClinicalNotes(''); setPriority('ROUTINE')
        load()
      } else toast.error(data.error || 'Failed to place order')
    } catch { toast.error('Network error') }
    finally { setSubmitting(false) }
  }

  const act = async (orderId: string, body: Record<string, unknown>, successMsg: string) => {
    try {
      const res = await fetch(`/api/lab/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(successMsg)
        setReviewingId(null); setComment('')
        load()
      } else toast.error(data.error || 'Action failed')
    } catch { toast.error('Network error') }
  }

  return (
    <div className="space-y-6">
      {/* Order form */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-[#0f3b5c]">Order Lab Tests</h2>
        <p className="text-sm text-slate-500 mb-4">Patient: <strong>{patientName}</strong></p>

        {loading && catalogue.length === 0 ? (
          <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <div className="space-y-4">
            {byCategory.map(([category, tests]) => (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{category}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {tests.map((t) => (
                    <label key={t.id}
                      className={`flex items-start gap-3 px-4 py-2.5 rounded-xl border cursor-pointer text-sm transition-all ${selected.includes(t.id) ? 'border-[#0f3b5c] bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <input type="checkbox" className="mt-1" checked={selected.includes(t.id)} onChange={() => toggle(t.id)} />
                      <span>
                        <span className="font-medium text-[#0f3b5c]">{t.name}</span>
                        <span className="block text-xs text-slate-400">Normal: {formatReferenceRange(t)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Clinical notes (reason for the tests)</label>
                <input value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} maxLength={1000}
                  placeholder="e.g. fever and chills for 2 days"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as 'ROUTINE' | 'URGENT')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]">
                  <option value="ROUTINE">Routine</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <button onClick={handleOrder} disabled={submitting || selected.length === 0}
              className="bg-[#0f3b5c] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60">
              {submitting ? 'Sending...' : `Send to Lab${selected.length ? ` (${selected.length})` : ''}`}
            </button>
          </div>
        )}
      </div>

      {/* Existing orders */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#0f3b5c]">Lab Orders ({orders.length})</h2>
        {loading ? (
          <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-slate-400 shadow-sm">No lab orders for this patient yet.</div>
        ) : (
          orders.map((order) => (
            <LabOrderCard key={order.id} order={order}>
              {order.status === 'ORDERED' && (
                <button onClick={() => act(order.id, { action: 'cancel' }, 'Order cancelled')}
                  className="text-sm text-red-600 hover:text-red-700 font-semibold">Cancel order</button>
              )}

              {order.status === 'COMPLETED' && !order.reviewedAt && (
                reviewingId === order.id ? (
                  <div className="space-y-3">
                    <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={1000}
                      placeholder="Comment for the patient (optional) — they will see this with the results"
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] resize-none" />
                    <div className="flex gap-3">
                      <button onClick={() => act(order.id, { action: 'review', doctorComment: comment || null }, 'Results released to patient')}
                        className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700">Release to patient</button>
                      <button onClick={() => { setReviewingId(null); setComment('') }}
                        className="bg-slate-100 text-slate-600 px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setReviewingId(order.id)}
                    className="bg-[#0f3b5c] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45]">Review results</button>
                )
              )}

              {order.status === 'COMPLETED' && order.reviewedAt && (
                <p className="text-xs text-green-600 font-semibold">Released to patient</p>
              )}
            </LabOrderCard>
          ))
        )}
      </div>
    </div>
  )
}
