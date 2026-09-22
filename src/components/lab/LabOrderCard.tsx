// src/components/lab/LabOrderCard.tsx
// Shows one lab order: who ordered it, its status, and a results table with
// the normal range and a coloured flag for each test. Used by the doctor,
// the lab technician and the patient, so all three see results the same way.
//
// Anything role-specific (buttons, forms) is passed in as `children`.

import type { ReactNode } from 'react'
import type { LabFlag, LabOrder, LabOrderItem } from '@/src/types'
import { formatDateTime, formatDoctorName } from '@/src/lib/format'
import { formatReferenceRange } from '@/src/lib/lab'
import { AlertTriangleIcon } from '@/src/components/icons'

const FLAG_STYLES: Record<LabFlag, { label: string; className: string }> = {
  NORMAL:        { label: 'Normal',        className: 'bg-green-100 text-green-700' },
  LOW:           { label: 'Low',           className: 'bg-yellow-100 text-yellow-800' },
  HIGH:          { label: 'High',          className: 'bg-yellow-100 text-yellow-800' },
  CRITICAL_LOW:  { label: 'Critical low',  className: 'bg-red-100 text-red-700 ring-1 ring-red-300' },
  CRITICAL_HIGH: { label: 'Critical high', className: 'bg-red-100 text-red-700 ring-1 ring-red-300' },
  ABNORMAL:      { label: 'Abnormal',      className: 'bg-orange-100 text-orange-700' },
}

const STATUS_STYLES: Record<string, string> = {
  ORDERED:   'bg-blue-100 text-blue-700',
  COLLECTED: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
}

export function LabFlagBadge({ flag }: { flag: LabFlag | null }) {
  if (!flag) return <span className="text-slate-300">—</span>
  const style = FLAG_STYLES[flag]
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.className}`}>{style.label}</span>
}

export function formatLabValue(item: LabOrderItem): string {
  if (item.valueNumeric !== null) return `${item.valueNumeric}${item.unit ? ` ${item.unit}` : ''}`
  if (item.valueText) return item.valueText
  return 'Pending'
}

export function orderHasCritical(order: LabOrder): boolean {
  return order.items.some((i) => i.flag === 'CRITICAL_LOW' || i.flag === 'CRITICAL_HIGH')
}

interface LabOrderCardProps {
  order: LabOrder
  // Show the patient's name in the header (for staff views)
  showPatient?: boolean
  children?: ReactNode
}

export default function LabOrderCard({ order, showPatient = false, children }: LabOrderCardProps) {
  const critical = orderHasCritical(order)

  return (
    <div className={`bg-white rounded-2xl shadow-sm p-5 ${critical ? 'border-2 border-red-200' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {showPatient && <h3 className="font-bold text-[#0f3b5c] text-lg">{order.patient.fullName}</h3>}
            <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[order.status]}`}>{order.status}</span>
            {order.priority === 'URGENT' && (
              <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-red-600 text-white">URGENT</span>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            {showPatient && <>Student: {order.patient.studentNumber || 'N/A'} · </>}
            Ordered by {formatDoctorName(order.orderedBy.fullName)} · {formatDateTime(order.createdAt)}
          </p>
          {order.clinicalNotes && <p className="text-slate-500 text-sm mt-1">Reason: {order.clinicalNotes}</p>}
        </div>
      </div>

      {critical && (
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2">
          <AlertTriangleIcon size={16} /> This order contains a critical result that needs urgent attention.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f4f7fc] text-[#0f3b5c] font-semibold">
            <tr>
              <th className="px-3 py-2 text-left">Test</th>
              <th className="px-3 py-2 text-left">Result</th>
              <th className="px-3 py-2 text-left">Normal range</th>
              <th className="px-3 py-2 text-left">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 font-medium text-[#0f3b5c]">
                  {item.test.name}
                  <span className="block text-xs text-slate-400 font-normal">{item.test.category}</span>
                </td>
                <td className={`px-3 py-2 ${item.resultAt ? 'font-bold text-slate-800' : 'text-slate-400 italic'}`}>
                  {formatLabValue(item)}
                  {item.notes && <span className="block text-xs font-normal text-slate-500">{item.notes}</span>}
                </td>
                <td className="px-3 py-2 text-slate-500">{formatReferenceRange(item)}</td>
                <td className="px-3 py-2"><LabFlagBadge flag={item.flag} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.doctorComment && (
        <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-slate-700">
          <span className="font-semibold text-[#0f3b5c]">Doctor&apos;s comment: </span>
          {order.doctorComment}
          {order.reviewedBy && (
            <span className="block text-xs text-slate-400 mt-1">
              {formatDoctorName(order.reviewedBy.fullName)}
              {order.reviewedAt && ` · ${formatDateTime(order.reviewedAt)}`}
            </span>
          )}
        </div>
      )}

      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
