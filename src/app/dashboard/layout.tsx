// src/app/dashboard/layout.tsx
// Shared layout for all dashboard pages.
// Contains the sidebar navigation and top header bar.

'use client'

import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { AuthUser, Role } from '@/src/types'
import {
  HomeIcon,
  FileTextIcon,
  CalendarIcon,
  HeartIcon,
  ClipboardListIcon,
  SearchIcon,
  UserPlusIcon,
  ClipboardIcon,
  UsersIcon,
  LogOutIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  type IconProps,
} from '@/src/components/icons'

// Navigation items for each role.
// "icon" stores a reference to one of our SVG icon components (not text),
// so it can be rendered directly as <item.icon /> further down.
const NAV_ITEMS: Record<Role, { label: string; href: string; icon: ComponentType<IconProps> }[]> = {
  PATIENT: [
    { label: 'My Dashboard', href: '/dashboard/patient', icon: HomeIcon },
    { label: 'Medical Records', href: '/dashboard/patient#records', icon: FileTextIcon },
    { label: 'My Visits', href: '/dashboard/patient#visits', icon: CalendarIcon },
    { label: 'Next of Kin', href: '/dashboard/patient#kin', icon: HeartIcon },
    { label: 'Access Logs', href: '/dashboard/patient#logs', icon: ClipboardListIcon },
  ],
  RECEPTIONIST: [
    { label: 'Dashboard', href: '/dashboard/receptionist', icon: HomeIcon },
    { label: 'Verify Student', href: '/dashboard/receptionist#verify', icon: SearchIcon },
    { label: "Today's Visits", href: '/dashboard/receptionist#visits', icon: CalendarIcon },
    { label: 'Register Patient', href: '/dashboard/receptionist#register', icon: UserPlusIcon },
  ],
  DOCTOR: [
    { label: 'Dashboard', href: '/dashboard/doctor', icon: HomeIcon },
    { label: 'Patient Search', href: '/dashboard/doctor#search', icon: SearchIcon },
    { label: 'Add Record', href: '/dashboard/doctor#add-record', icon: ClipboardIcon },
  ],
  ADMIN: [
    { label: 'Dashboard', href: '/dashboard/admin', icon: HomeIcon },
    { label: 'User Management', href: '/dashboard/admin/users', icon: UsersIcon },
    { label: 'Access Logs', href: '/dashboard/admin/logs', icon: ClipboardListIcon },
  ],
  NEXT_OF_KIN: [
    { label: 'Dashboard', href: '/dashboard/next-of-kin', icon: HomeIcon },
    { label: 'My Patients', href: '/dashboard/next-of-kin#patients', icon: UsersIcon },
  ],
}

// Human-readable role labels
const ROLE_LABELS: Record<Role, string> = {
  PATIENT: 'Patient',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
  ADMIN: 'Administrator',
  NEXT_OF_KIN: 'Next of Kin',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)

  // Fetch the current user on mount to populate the sidebar
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setUser(data.data)
        } else {
          router.push('/login')
        }
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Logged out successfully')
      router.push('/login')
    } catch {
      toast.error('Logout failed')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f7fc] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[#0f3b5c] font-medium">Loading MediVault...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  const navItems = NAV_ITEMS[user.role] || []

  return (
    <div className="min-h-screen bg-[#f4f7fc] flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } transition-all duration-300 bg-[#0f3b5c] flex flex-col shadow-xl flex-shrink-0`}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold flex-shrink-0">
            M
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="text-white font-bold text-lg leading-none">MediVault</div>
              <div className="text-blue-200 text-xs mt-0.5">UNZA Clinic</div>
            </div>
          )}
        </div>

        {/* Role badge */}
        {sidebarOpen && (
          <div className="px-4 py-3 border-b border-white/10">
            <div className="bg-white/10 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#1f7b4d] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="text-white text-sm font-semibold truncate">{user.fullName}</div>
                <div className="text-blue-200 text-xs">{ROLE_LABELS[user.role]}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation items */}
        <nav className="flex-1 py-4 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href.split('#')[0]
            // Pull the icon component out of the item so we can render it
            // as a JSX element below, e.g. <ItemIcon size={18} />
            const ItemIcon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 transition-all text-sm ${
                  isActive
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ItemIcon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span className="truncate">{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Logout button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all text-sm`}
          >
            <LogOutIcon size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-[#0f3b5c] transition-colors p-1 rounded-lg hover:bg-slate-100"
            title="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeftIcon size={18} /> : <ChevronRightIcon size={18} />}
          </button>

          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-ZM', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#0f3b5c] flex items-center justify-center text-white text-sm font-bold">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}
