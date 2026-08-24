// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import type { Role } from '@/src/types'
import {
  ShieldIcon,
  ShieldCheckIcon,
  UsersIcon,
  FileTextIcon,
  HeartIcon,
  ClipboardListIcon,
  HospitalIcon,
  LockIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
} from '@/src/components/icons'

const ROLE_DASHBOARDS: Record<string, string> = {
  PATIENT: '/dashboard/patient',
  RECEPTIONIST: '/dashboard/receptionist',
  DOCTOR: '/dashboard/doctor',
  ADMIN: '/dashboard/admin',
  NEXT_OF_KIN: '/dashboard/next-of-kin',
}

const features = [
  { icon: ShieldCheckIcon, color: '#eeedfe', iconColor: '#534AB7', label: 'Student number verification — no physical ID required' },
  { icon: UsersIcon, color: '#deeaf8', iconColor: '#185FA5', label: 'Role-based access: Patients, Doctors, Receptionists, Admin & Next of Kin' },
  { icon: FileTextIcon, color: '#e1f5ee', iconColor: '#0F6E56', label: 'Electronic medical profiles: diagnoses, allergies, visit history' },
  { icon: HeartIcon, color: '#fde8e8', iconColor: '#a32d2d', label: 'Next of kin consent for emergency situations' },
  { icon: ClipboardListIcon, color: '#faeeda', iconColor: '#854F0B', label: 'Audit logging for accountability & transparency' },
]

export default function LoginPage() {
  const router = useRouter()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [showLanding, setShowLanding] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          router.push(ROLE_DASHBOARDS[data.data.role] || '/dashboard/patient')
        }
      })
      .catch(() => {})
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!identifier || !password || !role) {
      toast.error('Please fill in all fields and select a role.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, role }),
      })

      const data = await response.json()

      if (data.success) {
        toast.success(`Welcome back, ${data.data.fullName}!`)
        router.push(ROLE_DASHBOARDS[data.data.role] || '/dashboard/patient')
      } else {
        toast.error(data.error || 'Login failed. Please try again.')
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7fc] font-sans">
      {/* ── Landing View ─────────────────────────────────────────────────── */}
      {showLanding ? (
        <div className="flex flex-col min-h-screen">
          {/* Navbar */}
          <nav className="flex justify-between items-center px-8 py-5 bg-white border-b border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#0f3b5c] flex items-center justify-center text-white text-lg font-bold">
                M
              </div>
              <div>
                <h1 className="text-[1.5rem] font-bold text-[#0f3b5c] leading-none">MediVault</h1>
                <span className="text-xs text-slate-500">UNZA Clinic · Secure Portal</span>
              </div>
            </div>
            <button
              onClick={() => setShowLanding(false)}
              className="border-2 border-[#0f3b5c] text-[#0f3b5c] rounded-full px-6 py-2 font-semibold hover:bg-[#0f3b5c] hover:text-white transition-all text-sm inline-flex items-center gap-1.5"
            >
              Login
              <ArrowRightIcon size={15} />
            </button>
          </nav>

          {/* Hero */}
          <section className="flex-1 flex items-center px-8 py-12">
            <div className="max-w-6xl mx-auto w-full flex flex-wrap gap-12 items-center justify-between">
              {/* Content */}
              <div className="flex-1 min-w-[280px]">
                <span className="inline-flex items-center gap-1.5 bg-[#e6f0f9] text-[#0f3b5c] rounded-full px-4 py-1 text-sm font-semibold mb-5">
                  <ShieldIcon size={15} />
                  HIPAA-inspired · Role-based access
                </span>
                <h2 className="text-5xl font-bold text-[#0a2a3f] leading-tight mb-4">
                  Digital health records,<br />right when you need them.
                </h2>
                <p className="text-lg text-[#2c475e] mb-6 max-w-lg">
                  MediVault replaces physical ID checks, centralises medical histories, and introduces
                  delegated consent — designed specifically for The University of Zambia Clinic.
                </p>

                {/* Pill Feature List */}
                <div className="flex flex-col gap-[10px] mb-8 max-w-lg">
                  {features.map((f) => {
                    // Each feature stores its icon as a component reference
                    // (e.g. ShieldCheckIcon) rather than a rendered element,
                    // so we pull it out here and render it with <FeatureIcon />.
                    const FeatureIcon = f.icon
                    return (
                      <div
                        key={f.label}
                        className="flex items-center gap-3 w-full cursor-default transition-all duration-200 hover:bg-[#dfeaf3] hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.01]"
                        style={{
                          background: '#eef4fa',
                          borderRadius: '999px',
                          padding: '10px 20px',
                          minHeight: '52px',
                        }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                          style={{ background: f.color, color: f.iconColor }}
                        >
                          <FeatureIcon size={17} />
                        </div>
                        <span
                          className="text-[15px] font-medium"
                          style={{ color: '#3a3d42' }}
                        >
                          {f.label}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Stats */}
                <div className="flex gap-8">
                  {[
                    { num: '5', label: 'User roles' },
                    { num: '24/7', label: 'Secure access' },
                    { num: '100%', label: 'Paperless' },
                  ].map((s) => (
                    <div key={s.label}>
                      <div className="text-3xl font-black text-[#0f3b5c]">{s.num}</div>
                      <div className="text-sm text-slate-500">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visual card */}
              <div className="flex-1 min-w-[260px] bg-gradient-to-br from-[#eef4fa] to-[#dfeaf3] rounded-[2.5rem] p-8 text-center shadow-xl">
                <div className="flex justify-center mb-4 text-[#0f3b5c]">
                  <HospitalIcon size={72} strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-[#0a2a3f]">MediVault Portal</h3>
                <p className="text-[#3a5e7a] text-sm mt-2">
                  Seamless, secure & instant patient data for UNZA medical staff.
                </p>
                <button
                  onClick={() => setShowLanding(false)}
                  className="mt-6 bg-[#0f3b5c] text-white rounded-full px-8 py-3 font-semibold text-sm hover:bg-[#0a2c45] transition-all shadow-lg inline-flex items-center gap-2"
                >
                  Access Portal
                  <ArrowRightIcon size={16} />
                </button>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="text-center py-4 border-t border-slate-200 bg-white text-xs text-slate-500">
            © 2026 MediVault — A role-based patient portal for The University of Zambia Clinic.
            Supervisor: Mrs Monde Kabemba
          </footer>
        </div>
      ) : (
        /* ── Login Card View ─────────────────────────────────────────────── */
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md animate-fade-in">
            {/* Logo */}
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl bg-[#0f3b5c] flex items-center justify-center text-white shadow-lg">
                <LockIcon size={24} />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-[#0a2a3f] text-center mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm text-center mb-6">Sign in to access MediVault</p>

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Identifier */}
              <div>
                <label className="block text-sm font-medium text-[#1e3a5f] mb-1">
                  Email / Student Number
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="student@unza.zm or 2022XXXXXX"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] focus:border-transparent"
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-[#1e3a5f] mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] focus:border-transparent"
                  required
                />
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-[#1e3a5f] mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] focus:border-transparent bg-white"
                  required
                >
                  <option value="">— Select your role —</option>
                  <option value="PATIENT">Patient</option>
                  <option value="RECEPTIONIST">Receptionist</option>
                  <option value="DOCTOR">Doctor</option>
                  <option value="ADMIN">Administrator</option>
                  <option value="NEXT_OF_KIN">Next of Kin</option>
                </select>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0f3b5c] text-white rounded-full py-3 font-semibold text-sm hover:bg-[#0a2c45] transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Logging in...
                  </>
                ) : (
                  <>
                    Login to Portal
                    <ArrowRightIcon size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Back link */}
            <button
              onClick={() => setShowLanding(true)}
              className="mt-5 text-[#0f3b5c] text-sm font-medium w-full text-center hover:underline inline-flex items-center justify-center gap-1.5"
            >
              <ArrowLeftIcon size={14} />
              Back to MediVault home
            </button>

            {/* Demo credentials hint */}
            <p className="mt-3 text-xs text-slate-400 text-center">
              Demo password: <code className="font-mono">password123</code>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}