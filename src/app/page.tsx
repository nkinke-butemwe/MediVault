// src/app/page.tsx
// Root page — shows the landing page (which is already built in landing-page.html)
// We inline the landing page content here using Next.js

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/src/lib/auth'

// Role-to-dashboard mapping
const ROLE_DASHBOARDS: Record<string, string> = {
  PATIENT: '/dashboard/patient',
  RECEPTIONIST: '/dashboard/receptionist',
  DOCTOR: '/dashboard/doctor',
  ADMIN: '/dashboard/admin',
  NEXT_OF_KIN: '/dashboard/next-of-kin',
}

export default async function HomePage() {
  // Check if the user is already logged in
  const user = await getCurrentUser()

  // If they are, redirect them straight to their dashboard
  if (user) {
    redirect(ROLE_DASHBOARDS[user.role] || '/login')
  }

  // Otherwise redirect to login (the landing page is static HTML,
  // served separately or we use the login page as the entry point)
  redirect('/login')
}
