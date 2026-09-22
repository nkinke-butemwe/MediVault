// src/app/dashboard/lab/page.tsx
// Lab technician dashboard: a work queue of ordered tests and the results
// entry form. Flags (low / high / critical) are worked out by the server.
'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useHashSection } from '@/src/hooks/useHashSection'
import type { LabOrder, LabOrderItem } from '@/src/types'
import LabOrderCard, { orderHasCritical } from '@/src/components/lab/LabOrderCard'
import { parseAllowedResults } from '@/src/lib/lab'

// Sections this page can show. Must match the #hash values used in the sidebar.
const LAB_SECTIONS = ['queue', 'completed'] as const

// What the technician has typed for one test so far
type Draft = { value: string; notes: string }

export default function LabDashboard() {
  const [tab, setTab] = useHashSection(LAB_SECTIONS, 'queue')
  const [orders, setOrders] = useState<LabOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const status = tab === 'queue' ? 'ORDERED,COLLECTED' : 'COMPLETED'
      const res = await fetch(`/api/lab/orders?status=${status}`)
      const data = await res.json()
      if (data.success) {
        const list: LabOrder[] = data.data
        // Queue: urgent first, then oldest first (first come, first served)
        if (tab === 'queue') {
          list.sort((a, b) =>
            a.priority === b.priority
              ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
              : a.priority === 'URGENT' ? -1 : 1
          )
        }
        setOrders(list)
      } else toast.error(data.error || 'Failed to load lab orders')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }, [tab])

  useEffect(() => { load() }, [load])

  const setDraft = (itemId: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [itemId]: { ...(d[itemId] ?? { value: '', notes: '' }), ...patch } }))

  const handleCollect = async (orderId: string) => {
    setBusyId(orderId)
    try {
      const res = await fetch(`/api/lab/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'collect' }),
      })
      const data = await res.json()
      if (data.success) { toast.success('Sample marked as collected'); load() }
      else toast.error(data.error || 'Failed')
    } catch { toast.error('Network error') }
    finally { setBusyId(null) }
  }

  const handleSaveResults = async (order: LabOrder) => {
    // Send only the tests the technician actually filled in
    const results: Record<string, unknown>[] = []
    for (const item of order.items) {
      if (item.resultAt) continue
      const draft = drafts[item.id]
      if (!draft?.value.trim()) continue

      const isText = !!item.test.allowedResults
      if (isText) {
        results.push({ itemId: item.id, valueText: draft.value.trim(), notes: draft.notes.trim() || null })
      } else {
        const n = Number(draft.value)
        if (!Number.isFinite(n)) { toast.error(`${item.test.name}: enter a valid number`); return }
        results.push({ itemId: item.id, valueNumeric: n, notes: draft.notes.trim() || null })
      }
    }
    if (results.length === 0) { toast.error('Enter at least one result'); return }

    setBusyId(order.id)
    try {
      const res = await fetch(`/api/lab/orders/${order.id}/results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results }),
      })
      const data = await res.json()
      if (data.success) {
        const saved: LabOrder = data.data
        if (orderHasCritical(saved)) toast.error('Critical result recorded — inform the doctor now', { duration: 8000 })
        else toast.success(saved.status === 'COMPLETED' ? 'Order completed' : 'Results saved')
        setDrafts((d) => {
          const next = { ...d }
          for (const r of results) delete next[r.itemId as string]
          return next
        })
        load()
      } else toast.error(data.error || 'Failed to save results')
    } catch { toast.error('Network error') }
    finally { setBusyId(null) }
  }

  const renderEntryRow = (item: LabOrderItem) => {
    const draft = drafts[item.id] ?? { value: '', notes: '' }
    const choices = parseAllowedResults(item.test.allowedResults)
    return (
      <div key={item.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#f4f7fc] rounded-xl px-4 py-2">
        <div className="sm:col-span-4 text-sm font-medium text-[#0f3b5c]">{item.test.name}</div>
        <div className="sm:col-span-3">
          {choices.length > 0 ? (
            <select value={draft.value} onChange={(e) => setDraft(item.id, { value: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]">
              <option value="">Select result…</option>
              {choices.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <div className="flex items-center gap-2">
              <input type="number" step="any" value={draft.value} onChange={(e) => setDraft(item.id, { value: e.target.value })}
                placeholder="Value"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]" />
              <span className="text-xs text-slate-400 whitespace-nowrap">{item.unit}</span>
            </div>
          )}
        </div>
        <div className="sm:col-span-5">
          <input value={draft.notes} onChange={(e) => setDraft(item.id, { notes: e.target.value })} maxLength={500}
            placeholder="Note (optional), e.g. sample haemolysed"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]" />
        </div>
      </div>
    )
  }

  const urgentCount = orders.filter((o) => o.priority === 'URGENT').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f3b5c]">Laboratory Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">
          {tab === 'queue'
            ? orders.length > 0
              ? <><span className="text-yellow-600 font-semibold">{orders.length} order{orders.length > 1 ? 's' : ''} in the queue</span>{urgentCount > 0 && <span className="text-red-600 font-semibold"> · {urgentCount} urgent</span>}</>
              : 'The queue is empty'
            : 'Recently completed orders'}
        </p>
      </div>

      <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-sm w-fit">
        {LAB_SECTIONS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${tab === t ? 'bg-[#0f3b5c] text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
            {t === 'queue' ? 'Work Queue' : 'Completed'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm">
          {tab === 'queue' ? 'No tests waiting.' : 'No completed orders yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <LabOrderCard key={order.id} order={order} showPatient>
              {tab === 'queue' ? (
                <div className="space-y-3">
                  {order.items.filter((i) => !i.resultAt).map(renderEntryRow)}
                  <div className="flex flex-wrap gap-3 pt-1">
                    {order.status === 'ORDERED' && (
                      <button onClick={() => handleCollect(order.id)} disabled={busyId === order.id}
                        className="bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 disabled:opacity-60">
                        Mark sample collected
                      </button>
                    )}
                    <button onClick={() => handleSaveResults(order)} disabled={busyId === order.id}
                      className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60">
                      {busyId === order.id ? 'Saving...' : 'Save results'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className={`text-xs font-semibold ${order.reviewedAt ? 'text-green-600' : 'text-yellow-600'}`}>
                  {order.reviewedAt ? 'Reviewed by doctor and released to patient' : 'Waiting for doctor review'}
                </p>
              )}
            </LabOrderCard>
          ))}
        </div>
      )}
    </div>
  )
}
