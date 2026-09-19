// src/app/dashboard/pharmacy/page.tsx
'use client'

import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface Medication { name: string; dose: string; duration: string; quantity?: number }
interface Prescription {
  id: string
  status: 'PENDING' | 'DISPENSED' | 'CANCELLED'
  medications: string
  notes: string | null
  createdAt: string
  dispensedAt: string | null
  patient: { fullName: string; studentNumber: string | null; email: string }
  doctor: { fullName: string }
  pharmacist?: { fullName: string }
}
interface DrugItem {
  id: string
  drugName: string
  genericName: string | null
  quantity: number
  unit: string
  expiryDate: string | null
  reorderLevel: number
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  DISPENSED: 'bg-green-100 text-green-700 border-green-200',
  CANCELLED: 'bg-red-100 text-red-700 border-red-200',
}

export default function PharmacyDashboard() {
  const [tab, setTab] = useState<'prescriptions' | 'inventory'>('prescriptions')
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [inventory, setInventory] = useState<DrugItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'PENDING' | 'DISPENSED' | 'ALL'>('PENDING')
  const [dispensing, setDispensing] = useState<string | null>(null)

  // Inventory form
  const [showAddDrug, setShowAddDrug] = useState(false)
  const [drugForm, setDrugForm] = useState({ drugName: '', genericName: '', quantity: '', unit: 'tablets', expiryDate: '', reorderLevel: '10' })

  const fetchPrescriptions = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/prescriptions${filter !== 'ALL' ? `?status=${filter}` : ''}`)
      const data = await res.json()
      if (data.success) setPrescriptions(data.data)
      else toast.error('Failed to load prescriptions')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  const fetchInventory = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/pharmacy/inventory')
      const data = await res.json()
      if (data.success) setInventory(data.data)
      else toast.error('Failed to load inventory')
    } catch { toast.error('Network error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (tab === 'prescriptions') fetchPrescriptions()
    else fetchInventory()
  }, [tab, filter])

  const handleDispense = async (id: string) => {
    setDispensing(id)
    try {
      const res = await fetch(`/api/prescriptions/${id}/dispense`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast.success('Prescription dispensed successfully')
        fetchPrescriptions()
      } else toast.error(data.error || 'Failed to dispense')
    } catch { toast.error('Network error') }
    finally { setDispensing(null) }
  }

  const handleAddDrug = async () => {
    try {
      const res = await fetch('/api/pharmacy/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...drugForm, quantity: parseInt(drugForm.quantity), reorderLevel: parseInt(drugForm.reorderLevel) }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Drug added to inventory')
        setShowAddDrug(false)
        setDrugForm({ drugName: '', genericName: '', quantity: '', unit: 'tablets', expiryDate: '', reorderLevel: '10' })
        fetchInventory()
      } else toast.error(data.error || 'Failed to add drug')
    } catch { toast.error('Network error') }
  }

  const parseMeds = (meds: string): Medication[] => {
    try { return JSON.parse(meds) } catch { return [] }
  }

  const pendingCount = prescriptions.filter(p => p.status === 'PENDING').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0f3b5c]">Pharmacy Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            {pendingCount > 0 ? <span className="text-yellow-600 font-semibold">{pendingCount} prescription{pendingCount > 1 ? 's' : ''} pending dispensing</span> : 'No pending prescriptions'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white rounded-2xl p-1 shadow-sm w-fit">
        {(['prescriptions', 'inventory'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${tab === t ? 'bg-[#0f3b5c] text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>
            {t === 'prescriptions' ? ' Prescriptions' : ' Drug Inventory'}
          </button>
        ))}
      </div>

      {/* Prescriptions Tab */}
      {tab === 'prescriptions' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            {(['PENDING', 'DISPENSED', 'ALL'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${filter === f ? 'bg-[#0f3b5c] text-white border-[#0f3b5c]' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                {f}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
          ) : prescriptions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-slate-400 shadow-sm">
              <div className="text-5xl mb-3"></div>
              <p className="font-medium">No {filter !== 'ALL' ? filter.toLowerCase() : ''} prescriptions</p>
            </div>
          ) : (
            <div className="space-y-4">
              {prescriptions.map(rx => (
                <div key={rx.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-[#0f3b5c] text-lg">{rx.patient.fullName}</h3>
                        <span className={`px-3 py-0.5 rounded-full text-xs font-semibold border ${STATUS_COLORS[rx.status]}`}>{rx.status}</span>
                      </div>
                      <p className="text-slate-400 text-sm">Student: {rx.patient.studentNumber || 'N/A'} · Prescribed by {rx.doctor.fullName}</p>
                      <p className="text-slate-400 text-xs mt-1">{new Date(rx.createdAt).toLocaleString()}</p>
                    </div>
                    {rx.status === 'PENDING' && (
                      <button
                        onClick={() => handleDispense(rx.id)}
                        disabled={dispensing === rx.id}
                        className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-all disabled:opacity-60"
                      >
                        {dispensing === rx.id ? 'Dispensing...' : '✓ Mark Dispensed'}
                      </button>
                    )}
                    {rx.status === 'DISPENSED' && (
                      <div className="text-right">
                        <p className="text-green-600 text-sm font-semibold">Dispensed</p>
                        <p className="text-slate-400 text-xs">{rx.dispensedAt ? new Date(rx.dispensedAt).toLocaleString() : ''}</p>
                        {rx.pharmacist && <p className="text-slate-400 text-xs">by {rx.pharmacist.fullName}</p>}
                      </div>
                    )}
                  </div>

                  {/* Medications */}
                  <div className="bg-[#f4f7fc] rounded-xl p-4">
                    <p className="text-xs font-semibold text-[#0f3b5c] mb-3 uppercase tracking-wide">Medications</p>
                    <div className="space-y-2">
                      {parseMeds(rx.medications).map((med, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white rounded-lg px-4 py-2">
                          <div className="w-2 h-2 rounded-full bg-[#0f3b5c] shrink-0" />
                          <span className="font-medium text-sm text-[#0f3b5c]">{med.name}</span>
                          <span className="text-slate-400 text-sm">·</span>
                          <span className="text-slate-600 text-sm">{med.dose}</span>
                          <span className="text-slate-400 text-sm">·</span>
                          <span className="text-slate-500 text-sm">{med.duration}</span>
                          {med.quantity && <span className="ml-auto text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Qty: {med.quantity}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {rx.notes && (
                    <p className="mt-3 text-slate-500 text-sm"><span className="font-semibold">Notes:</span> {rx.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {tab === 'inventory' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddDrug(true)}
              className="bg-[#0f3b5c] text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all">
              + Add Drug
            </button>
          </div>

          {/* Add Drug Form */}
          {showAddDrug && (
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-blue-100">
              <h3 className="font-bold text-[#0f3b5c] mb-4">Add New Drug to Inventory</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#1e3a5f] block mb-1">Drug Name *</label>
                  <input className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    value={drugForm.drugName} onChange={e => setDrugForm(f => ({ ...f, drugName: e.target.value }))} placeholder="e.g. Amoxicillin" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e3a5f] block mb-1">Generic Name</label>
                  <input className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    value={drugForm.genericName} onChange={e => setDrugForm(f => ({ ...f, genericName: e.target.value }))} placeholder="e.g. Amoxicillin trihydrate" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e3a5f] block mb-1">Quantity *</label>
                  <input type="number" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    value={drugForm.quantity} onChange={e => setDrugForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e3a5f] block mb-1">Unit *</label>
                  <select className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] bg-white"
                    value={drugForm.unit} onChange={e => setDrugForm(f => ({ ...f, unit: e.target.value }))}>
                    <option>tablets</option>
                    <option>capsules</option>
                    <option>ml</option>
                    <option>vials</option>
                    <option>sachets</option>
                    <option>tubes</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e3a5f] block mb-1">Expiry Date</label>
                  <input type="date" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    value={drugForm.expiryDate} onChange={e => setDrugForm(f => ({ ...f, expiryDate: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#1e3a5f] block mb-1">Reorder Level</label>
                  <input type="number" className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                    value={drugForm.reorderLevel} onChange={e => setDrugForm(f => ({ ...f, reorderLevel: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={handleAddDrug} className="bg-[#0f3b5c] text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all">Add Drug</button>
                <button onClick={() => setShowAddDrug(false)} className="bg-slate-100 text-slate-600 px-6 py-2 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all">Cancel</button>
              </div>
            </div>
          )}

          {/* Inventory Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />)}</div>
            ) : inventory.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <div className="text-5xl mb-3"></div>
                <p className="font-medium">No drugs in inventory</p>
                <p className="text-sm mt-1">Click "Add Drug" to get started</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[#f4f7fc] text-[#0f3b5c] font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Drug Name</th>
                    <th className="px-4 py-3 text-left">Generic Name</th>
                    <th className="px-4 py-3 text-left">Stock</th>
                    <th className="px-4 py-3 text-left">Unit</th>
                    <th className="px-4 py-3 text-left">Expiry</th>
                    <th className="px-4 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map(drug => {
                    const isLow = drug.quantity <= drug.reorderLevel
                    const isExpired = drug.expiryDate && new Date(drug.expiryDate) < new Date()
                    return (
                      <tr key={drug.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-[#0f3b5c]">{drug.drugName}</td>
                        <td className="px-4 py-3 text-slate-500">{drug.genericName || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${isLow ? 'text-red-600' : 'text-green-600'}`}>{drug.quantity}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{drug.unit}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {drug.expiryDate ? new Date(drug.expiryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isExpired ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">Expired</span>
                          ) : isLow ? (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Low Stock</span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">In Stock</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}