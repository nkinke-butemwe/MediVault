// src/hooks/useAuth.ts
// Custom hook for authentication state management.
// Fetches the current user on mount and provides logout functionality.

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AuthUser, Role } from '@/src/types'

// Returns the correct dashboard path for each role
function getDashboardPath(role: Role): string {
  const dashboards: Record<Role, string> = {
    PATIENT: '/dashboard/patient',
    RECEPTIONIST: '/dashboard/receptionist',
    DOCTOR: '/dashboard/doctor',
    ADMIN: '/dashboard/admin',
    NEXT_OF_KIN: '/dashboard/next-of-kin',
  }
  return dashboards[role] || '/login'
}

export function useAuth() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch the current user from the /api/auth/me endpoint
  // This runs once when the component mounts
  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/me')
      const data = await response.json()

      if (data.success) {
        setUser(data.data)
      } else {
        setUser(null)
        // If unauthorized, redirect to login
        if (response.status === 401) {
          router.push('/login')
        }
      }
    } catch {
      setError('Failed to fetch user data')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Calls the logout API and clears user state
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)
      router.push('/login')
    }
  }, [router])

  // Redirect to the user's dashboard based on their role
  const redirectToDashboard = useCallback(() => {
    if (user) {
      router.push(getDashboardPath(user.role))
    }
  }, [user, router])

  return {
    user,
    loading,
    error,
    logout,
    redirectToDashboard,
    isAuthenticated: !!user,
    refetch: fetchUser,
  }
}
