// src/app/dashboard/admin/logs/page.tsx
// Admin access log viewer — who viewed or changed which patient record, and when.
//
// This page did not exist before, so the "Access Logs" sidebar link and the
// "View Access Audit Logs" quick action on the admin dashboard both led to a
// 404 page. It reads from the existing GET /api/access-logs endpoint.

'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { AccessLog } from '@/src/types'
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from '@/src/components/icons'
import { formatDateTime } from '@/src/lib/format'

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Loads one page of logs from the API, applying the search text if there is any
  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (searchQuery) params.set('search', searchQuery)

      const res = await fetch(`/api/access-logs?${params}`)
      const data = await res.json()

      if (data.success) {
        setLogs(data.data.items)
        setTotal(data.data.total)
        setTotalPages(data.data.totalPages)
      } else {
        toast.error(data.error || 'Failed to load access logs')
      }
    } catch {
      toast.error('Network error while loading access logs')
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#0f3b5c]">Access Logs</h1>
          <p className="text-slate-500 text-sm mt-1">{total} recorded action{total !== 1 ? 's' : ''}</p>
        </div>
        <a
          href="/api/access-logs/export"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#e0f2e9] text-[#1f7b4d] px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#d0eddf] transition-all"
        >
          <DownloadIcon size={16} />
          Export CSV
        </a>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value)
          setPage(1) // a new search always starts from the first page
        }}
        placeholder="Search by user or patient name / email"
        className="w-full md:w-96 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
      />

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="font-medium">No access logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#f4f7fc] text-[#0f3b5c] font-semibold">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">User</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Resource</th>
                  <th className="px-4 py-3 text-left">Patient</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0f3b5c]">{log.accessedBy.fullName}</div>
                      <div className="text-xs text-slate-400">{log.accessedBy.role}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.action}</td>
                    <td className="px-4 py-3 text-slate-500">{log.resourceType}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {log.targetPatient ? log.targetPatient.fullName : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Previous page"
            >
              <ChevronLeftIcon size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              aria-label="Next page"
            >
              <ChevronRightIcon size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
