// src/app/dashboard/admin/page.tsx
// Admin main dashboard — summary stats and quick navigation

'use client'

import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import Link from 'next/link'
import { useAuth } from '@/src/hooks/useAuth'
import toast from 'react-hot-toast'
import {
  UsersIcon,
  UserIcon,
  StethoscopeIcon,
  UserCheckIcon,
  HeartIcon,
  ClipboardListIcon,
  DownloadIcon,
  CheckCircleIcon,
  DatabaseIcon,
  type IconProps,
} from '@/src/components/icons'

interface Stats {
  totalUsers: number
  totalPatients: number
  totalDoctors: number
  totalReceptionists: number
  totalNextOfKin: number
  recentLogs: number
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0, totalPatients: 0, totalDoctors: 0,
    totalReceptionists: 0, totalNextOfKin: 0, recentLogs: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch user counts for each role
        const [usersRes, logsRes] = await Promise.all([
          fetch('/api/admin/users?pageSize=1'),
          fetch('/api/access-logs?pageSize=1'),
        ])
        const [usersData, logsData] = await Promise.all([usersRes.json(), logsRes.json()])

        // Also get individual role counts
        const [patRes, docRes, recRes, kinRes] = await Promise.all([
          fetch('/api/admin/users?role=PATIENT&pageSize=1'),
          fetch('/api/admin/users?role=DOCTOR&pageSize=1'),
          fetch('/api/admin/users?role=RECEPTIONIST&pageSize=1'),
          fetch('/api/admin/users?role=NEXT_OF_KIN&pageSize=1'),
        ])
        const [patData, docData, recData, kinData] = await Promise.all([
          patRes.json(), docRes.json(), recRes.json(), kinRes.json(),
        ])

        setStats({
          totalUsers: usersData.success ? usersData.data.total : 0,
          totalPatients: patData.success ? patData.data.total : 0,
          totalDoctors: docData.success ? docData.data.total : 0,
          totalReceptionists: recData.success ? recData.data.total : 0,
          totalNextOfKin: kinData.success ? kinData.data.total : 0,
          recentLogs: logsData.success ? logsData.data.total : 0,
        })
      } catch {
        toast.error('Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  // "icon" holds a reference to one of our SVG icon components. We render
  // it below with <CardIcon size={26} />. "accentColor" is a Tailwind
  // background-color class (e.g. "bg-blue-500") used for the square-cornered
  // strip on the left of each card — see the comment further down for why
  // this is a background color on its own element rather than a border.
  const statCards: {
    label: string
    value: number
    icon: ComponentType<IconProps>
    accentColor: string
    href: string
  }[] = [
    { label: 'Total Users', value: stats.totalUsers, icon: UsersIcon, accentColor: 'bg-blue-500', href: '/dashboard/admin/users' },
    { label: 'Patients', value: stats.totalPatients, icon: UserIcon, accentColor: 'bg-teal-500', href: '/dashboard/admin/users?role=PATIENT' },
    { label: 'Doctors', value: stats.totalDoctors, icon: StethoscopeIcon, accentColor: 'bg-indigo-500', href: '/dashboard/admin/users?role=DOCTOR' },
    { label: 'Receptionists', value: stats.totalReceptionists, icon: UserCheckIcon, accentColor: 'bg-purple-500', href: '/dashboard/admin/users?role=RECEPTIONIST' },
    { label: 'Next of Kin', value: stats.totalNextOfKin, icon: HeartIcon, accentColor: 'bg-green-500', href: '/dashboard/admin/users?role=NEXT_OF_KIN' },
    { label: 'Access Log Entries', value: stats.recentLogs, icon: ClipboardListIcon, accentColor: 'bg-orange-500', href: '/dashboard/admin/logs' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#0f3b5c]">Administrator Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome, {user?.fullName} · Full system access</p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 shadow-sm animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {statCards.map((card) => {
            // Pull the icon component out of the card data so it can be
            // rendered as a JSX element, e.g. <CardIcon size={26} />
            const CardIcon = card.icon
            return (
              <Link
                key={card.label}
                href={card.href}
                className="relative block bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {/*
                  Square-cornered accent strip, drawn as its own element.
                  Putting `border-l-4` directly on this rounded-2xl card
                  would make the browser round the corners of the border
                  too, so the strip would look "trimmed" — curved little
                  stubs at the top and bottom instead of a clean full-height
                  bar. This separate absolutely-positioned div always stays
                  a straight rectangle no matter how the card is rounded.
                */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${card.accentColor}`} />
                <div className="flex items-center justify-between pl-2">
                  <div>
                    <p className="text-sm text-slate-500">{card.label}</p>
                    <p className="text-3xl font-bold text-[#0f3b5c] mt-1">{card.value}</p>
                  </div>
                  <CardIcon size={28} className="text-slate-300" />
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-[#0f3b5c] mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Link
              href="/dashboard/admin/users"
              className="flex items-center gap-3 px-4 py-3 bg-[#e6f0f9] text-[#0f3b5c] rounded-xl hover:bg-[#dbeaf8] transition-all text-sm font-medium"
            >
              <UsersIcon size={18} />
              Manage User Accounts
            </Link>
            <Link
              href="/dashboard/admin/logs"
              className="flex items-center gap-3 px-4 py-3 bg-[#e6f0f9] text-[#0f3b5c] rounded-xl hover:bg-[#dbeaf8] transition-all text-sm font-medium"
            >
              <ClipboardListIcon size={18} />
              View Access Audit Logs
            </Link>
            <a
              href="/api/access-logs/export"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 bg-[#e0f2e9] text-[#1f7b4d] rounded-xl hover:bg-[#d0eddf] transition-all text-sm font-medium"
            >
              <DownloadIcon size={18} />
              Export Access Logs (CSV)
            </a>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-[#0f3b5c] mb-3">System Info</h3>
          <div className="space-y-2 text-sm text-slate-600">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">System</span>
              <span className="font-medium">MediVault v1.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Institution</span>
              <span className="font-medium">University of Zambia Clinic</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Database</span>
              <span className="font-medium text-green-600 inline-flex items-center gap-1.5">
                <CheckCircleIcon size={14} />
                Connected (PostgreSQL)
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Session</span>
              <span className="font-medium">httpOnly JWT · 8hr timeout</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
