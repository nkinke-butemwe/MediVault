// src/components/admissions/DoctorAdmissionsPanel.tsx
// The "Admissions" section of the doctor dashboard:
//   - four headline numbers
//   - a searchable, filterable table of admissions (current patients by default)
//   - the Admit button (doctors only)
//   - opening one admission shows AdmissionDetail instead of the list

'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { Admission, AdmissionStats } from '@/src/types'
import { PlusIcon, SearchIcon } from '@/src/components/icons'
import AdmissionCard from './AdmissionCard'
import AdmissionDetail from './AdmissionDetail'
import AdmitPatientModal from './AdmitPatientModal'

interface DoctorAdmissionsPanelProps {
  // "DOCTOR" or "ADMIN". An admin can review admissions but the Admit button is for doctors.
  viewerRole: string
}

const PAGE_SIZE = 10

// One headline number
function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold text-[#0f3b5c] mt-1">{value}</p>
    </div>
  )
}

export default function DoctorAdmissionsPanel({ viewerRole }: DoctorAdmissionsPanelProps) {
  const [admissions, setAdmissions] = useState<Admission[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<AdmissionStats | null>(null)

  // Filters. "ADMITTED" is the default because the first thing a doctor wants is "who is in right now?"
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('ADMITTED')
  const [priorityFilter, setPriorityFilter] = useState('')

  const [openAdmissionId, setOpenAdmissionId] = useState<string | null>(null)
  const [showAdmitModal, setShowAdmitModal] = useState(false)

  const loadAdmissions = useCallback(async () => {
    setLoading(true)
    try {
      // Only send the filters that have a value
      const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
      if (searchText.trim()) params.set('q', searchText.trim())
      if (statusFilter) params.set('status', statusFilter)
      if (priorityFilter) params.set('priority', priorityFilter)

      const [listResponse, statsResponse] = await Promise.all([
        fetch(`/api/admissions?${params.toString()}`),
        fetch('/api/admissions/stats'),
      ])
      const listData = await listResponse.json()
      const statsData = await statsResponse.json()

      if (listData.success) {
        setAdmissions(listData.data.items)
        setTotal(listData.data.total)
      } else {
        toast.error(listData.error || 'Could not load admissions')
      }
      if (statsData.success) setStats(statsData.data)
    } catch {
      toast.error('Could not load admissions')
    } finally {
      setLoading(false)
    }
  }, [page, searchText, statusFilter, priorityFilter])

  useEffect(() => {
    loadAdmissions()
  }, [loadAdmissions])

  // Changing a filter always goes back to page 1
  function changeFilter(apply: () => void) {
    apply()
    setPage(1)
  }

  // A single admission is open: show its detail screen instead of the list
  if (openAdmissionId) {
    return (
      <AdmissionDetail
        admissionId={openAdmissionId}
        viewerRole={viewerRole}
        onBack={() => setOpenAdmissionId(null)}
        onChanged={loadAdmissions}
      />
    )
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      {/* Headline numbers */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Currently admitted" value={stats.currentAdmissions} />
          <StatBox label="Discharged today" value={stats.dischargesToday} />
          <StatBox label="Average stay (days)" value={stats.averageLengthOfStayDays} />
          <StatBox label={`Readmissions (${stats.windowDays} days)`} value={stats.readmissionCount} />
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#0f3b5c]">Admissions ({total})</h2>
          {viewerRole === 'DOCTOR' && (
            <button
              onClick={() => setShowAdmitModal(true)}
              className="bg-[#0f3b5c] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] inline-flex items-center gap-2"
            >
              <PlusIcon size={16} /> Admit patient
            </button>
          )}
        </div>

        {/* Search and filters */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => changeFilter(() => setSearchText(event.target.value))}
              placeholder="Patient name, student number or ADM number"
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => changeFilter(() => setStatusFilter(event.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="">All statuses</option>
            <option value="ADMITTED">Admitted</option>
            <option value="DISCHARGED">Discharged</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(event) => changeFilter(() => setPriorityFilter(event.target.value))}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="">All priorities</option>
            <option value="EMERGENCY">Emergency</option>
            <option value="URGENT">Urgent</option>
            <option value="ROUTINE">Routine</option>
          </select>
        </div>

        {/* The list */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading...</div>
        ) : admissions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No admissions match these filters.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {admissions.map((admission) => (
              <AdmissionCard key={admission.id} admission={admission} onOpen={setOpenAdmissionId} />
            ))}
          </div>
        )}

        {/* Paging */}
        {total > PAGE_SIZE && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {page} of {lastPage}</span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= lastPage}
              className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {showAdmitModal && (
        <AdmitPatientModal
          onClose={() => setShowAdmitModal(false)}
          onAdmitted={(admissionId) => {
            loadAdmissions()
            setOpenAdmissionId(admissionId)
          }}
        />
      )}
    </div>
  )
}
