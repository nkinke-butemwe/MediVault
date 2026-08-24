// src/app/dashboard/admin/users/page.tsx
// Admin user management — create, edit, deactivate/reactivate, reset passwords

'use client'

import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import type { AuthUser, Role } from '@/src/types'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from '@/src/components/icons'
import Modal from '@/src/components/Modal'

const ROLE_COLORS: Record<string, string> = {
  PATIENT: 'bg-teal-100 text-teal-800',
  DOCTOR: 'bg-blue-100 text-blue-800',
  RECEPTIONIST: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-orange-100 text-orange-800',
  NEXT_OF_KIN: 'bg-pink-100 text-pink-800',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 15

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newUser, setNewUser] = useState({
    fullName: '', email: '', password: 'password123', role: 'PATIENT' as Role,
    studentNumber: '', phone: '',
  })
  const [creating, setCreating] = useState(false)

  // Reset password modal state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('password123')
  const [resettingPassword, setResettingPassword] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter }),
      })
      const res = await fetch(`/api/admin/users?${params}`)
      const data = await res.json()
      if (data.success) {
        setUsers(data.data.items)
        setTotal(data.data.total)
      }
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchUsers()
    }, 400)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, roleFilter])

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`User ${newUser.fullName} created!`)
        setShowCreateModal(false)
        setNewUser({ fullName: '', email: '', password: 'password123', role: 'PATIENT', studentNumber: '', phone: '' })
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to create user')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (user: AuthUser) => {
    const confirmed = window.confirm(
      `${user.isActive ? 'Deactivate' : 'Reactivate'} account for ${user.fullName}?`
    )
    if (!confirmed) return

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Account ${user.isActive ? 'deactivated' : 'reactivated'}`)
        fetchUsers()
      } else {
        toast.error(data.error || 'Failed to update account')
      }
    } catch {
      toast.error('Network error')
    }
  }

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !newPassword) return
    setResettingPassword(true)
    try {
      const res = await fetch(`/api/admin/users/${resetPasswordUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Password reset successfully')
        setResetPasswordUserId(null)
        setNewPassword('password123')
      } else {
        toast.error(data.error || 'Failed to reset password')
      }
    } finally {
      setResettingPassword(false)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[#0f3b5c]">User Management</h1>
          <p className="text-slate-500 text-sm">{total} total accounts</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#0f3b5c] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all"
        >
          + Create User
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, email, student number..."
          className="flex-1 min-w-[200px] px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] bg-white"
        >
          <option value="">All Roles</option>
          <option value="PATIENT">Patient</option>
          <option value="DOCTOR">Doctor</option>
          <option value="RECEPTIONIST">Receptionist</option>
          <option value="ADMIN">Admin</option>
          <option value="NEXT_OF_KIN">Next of Kin</option>
        </select>
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-4 border-[#0f3b5c] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Student No</th>
                  <th className="px-5 py-3 text-left">Role</th>
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Created</th>
                  <th className="px-5 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className={`hover:bg-slate-50 ${!user.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3 font-medium text-slate-800">{user.fullName}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{user.email}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{user.studentNumber || '—'}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${ROLE_COLORS[user.role] || 'bg-gray-100'}`}>
                        {user.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setResetPasswordUserId(user.id); setNewPassword('password123') }}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200"
                        >
                          Reset PW
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`text-xs px-2 py-1 rounded-lg ${
                            user.isActive
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {user.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
            <span className="text-slate-500">Page {page} of {totalPages} ({total} total)</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 inline-flex items-center gap-1"
              >
                <ChevronLeftIcon size={15} />
                Prev
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 inline-flex items-center gap-1"
              >
                Next
                <ChevronRightIcon size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Create User Modal ───────────────────────────────────────────────── */}
      {showCreateModal && (
        <Modal onClose={() => setShowCreateModal(false)} maxWidthClassName="max-w-md">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-lg font-bold text-[#0f3b5c]">Create New User</h3>
            <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600" title="Close">
              <CloseIcon size={20} />
            </button>
          </div>
          <form onSubmit={handleCreateUser} className="space-y-3">
              <input
                required
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                placeholder="Full Name *"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <input
                required
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Email Address *"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] bg-white"
              >
                <option value="PATIENT">Patient</option>
                <option value="RECEPTIONIST">Receptionist</option>
                <option value="DOCTOR">Doctor</option>
                <option value="ADMIN">Administrator</option>
                <option value="NEXT_OF_KIN">Next of Kin</option>
              </select>
              {newUser.role === 'PATIENT' && (
                <input
                  value={newUser.studentNumber}
                  onChange={(e) => setNewUser({ ...newUser, studentNumber: e.target.value })}
                  placeholder="Student Number (for patients)"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
                />
              )}
              <input
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                placeholder="Phone Number"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <input
                required
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Initial Password *"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-[#0f3b5c] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-60"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200"
                >
                  Cancel
                </button>
              </div>
            </form>
        </Modal>
      )}

      {/* ── Reset Password Modal ─────────────────────────────────────────────── */}
      {resetPasswordUserId && (
        <Modal onClose={() => setResetPasswordUserId(null)} maxWidthClassName="max-w-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#0f3b5c]">Reset Password</h3>
            <button onClick={() => setResetPasswordUserId(null)} className="text-slate-400 hover:text-slate-600" title="Close">
              <CloseIcon size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500 mb-4">Set a new temporary password for this user.</p>
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 8 chars)"
            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0f3b5c] mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={handleResetPassword}
              disabled={resettingPassword}
              className="flex-1 bg-[#0f3b5c] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] disabled:opacity-60"
            >
              {resettingPassword ? 'Resetting...' : 'Reset Password'}
            </button>
            <button
              onClick={() => setResetPasswordUserId(null)}
              className="px-4 bg-slate-100 text-slate-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
