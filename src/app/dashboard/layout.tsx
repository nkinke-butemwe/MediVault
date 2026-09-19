// src/app/dashboard/layout.tsx
'use client'

import { useState, useEffect } from 'react'
import type { ComponentType } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import type { AuthUser, Role } from '@/src/types'
import DashboardSkeleton from '@/src/components/DashboardSkeleton'
import {
  HASH_CHANGE_EVENT,
  setUrlHash,
  useCurrentHash,
} from '@/src/hooks/useHashSection'
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
  PHARMACIST: [
    { label: 'Dashboard', href: '/dashboard/pharmacy', icon: HomeIcon },
    { label: 'Prescriptions', href: '/dashboard/pharmacy#prescriptions', icon: ClipboardIcon },
    { label: 'Drug Inventory', href: '/dashboard/pharmacy#inventory', icon: ClipboardListIcon },
  ],
}

const ROLE_LABELS: Record<Role, string> = {
  PATIENT: 'Patient',
  RECEPTIONIST: 'Receptionist',
  DOCTOR: 'Doctor',
  ADMIN: 'Administrator',
  NEXT_OF_KIN: 'Next of Kin',
  PHARMACIST: 'Pharmacist',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  // True from the moment Logout is clicked, so we can show the skeleton at once
  const [loggingOut, setLoggingOut] = useState(false)

  // The "#section" part of the URL, used to highlight the right sidebar link
  const currentHash = useCurrentHash(pathname)

  // When we arrive on a new page through the sidebar (for example from the
  // admin Users page to /dashboard/patient#records), the page has just
  // mounted. Tell it to re-read the URL hash now that the URL is final.
  useEffect(() => {
    window.dispatchEvent(new Event(HASH_CHANGE_EVENT))
  }, [pathname])

  // Sidebar link click.
  // If the link points at the page we are ALREADY on, Next.js does not
  // re-render anything for a hash-only change, so we handle it ourselves:
  // update the URL hash and let the page switch its section.
  const handleNavClick = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    const [linkPath, linkHash = ''] = href.split('#')

    // Different page: let the normal Link navigation happen
    if (linkPath !== pathname) return

    event.preventDefault()
    setUrlHash(linkHash, 'push')

    // Links like "#patients" point at a spot on the page rather than a tab,
    // so scroll that element into view if it exists.
    if (linkHash) {
      document.getElementById(linkHash)?.scrollIntoView({ behavior: 'smooth' })
    }
  }

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

  // Load the login page in the background while the user is still on the
  // dashboard, so it appears faster after logging out
  useEffect(() => {
    router.prefetch('/login')
  }, [router])

  const handleLogout = async () => {
    // Show the skeleton IMMEDIATELY, before waiting for the server, so the
    // screen reacts the instant the button is pressed
    setLoggingOut(true)

    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      toast.success('Logged out successfully')
      // Keep the skeleton up; it disappears when the login page replaces this layout
      router.push('/login')
    } catch {
      // Logout failed, so bring the dashboard back
      setLoggingOut(false)
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

  // Logout in progress: show the skeleton instead of the dashboard
  if (loggingOut) return <DashboardSkeleton />

  if (!user) return null

  const navItems = NAV_ITEMS[user.role] || []

  return (
    <div className="min-h-screen bg-[#f4f7fc] flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-16'
        } transition-all duration-300 bg-[#0f3b5c] flex flex-col shadow-xl flex-shrink-0`}
      >
        {/* Logo */}
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

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2">
          {navItems.map((item) => {
            // A link is active when the page AND the #section both match.
            // A link with no #section is active when the URL has no hash.
            const [itemPath, itemHash = ''] = item.href.split('#')
            const isActive = pathname === itemPath && currentHash === itemHash
            const ItemIcon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleNavClick(event, item.href)}
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

        {/* Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-200 hover:bg-red-500/20 hover:text-red-100 transition-all text-sm"
          >
            <LogOutIcon size={18} className="flex-shrink-0" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-[#0f3b5c] transition-colors p-1 rounded-lg hover:bg-slate-100"
          >
            {sidebarOpen ? <ChevronLeftIcon size={18} /> : <ChevronRightIcon size={18} />}
          </button>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">
              {new Date().toLocaleDateString('en-ZM', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#0f3b5c] flex items-center justify-center text-white text-sm font-bold">
              {user.fullName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  )
}