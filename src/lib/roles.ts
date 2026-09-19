// src/lib/roles.ts
// Single source of truth for "which dashboard does each role land on?".
//
// Before this file existed, the login page, the root page and the useAuth
// hook each kept their OWN copy of this map, and none of them had an entry
// for PHARMACIST. That is why a pharmacist was sent to the patient dashboard
// (the fallback value) right after logging in.

import type { Role } from '@/src/types'

export const ROLE_DASHBOARDS: Record<Role, string> = {
  PATIENT: '/dashboard/patient',
  RECEPTIONIST: '/dashboard/receptionist',
  DOCTOR: '/dashboard/doctor',
  ADMIN: '/dashboard/admin',
  NEXT_OF_KIN: '/dashboard/next-of-kin',
  PHARMACIST: '/dashboard/pharmacy',
}

// Returns the dashboard path for a role, or '/login' if the role is unknown.
export function getDashboardPath(role: string): string {
  return ROLE_DASHBOARDS[role as Role] || '/login'
}
