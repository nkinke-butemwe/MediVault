// src/app/layout.tsx
// Root layout — wraps every page with base HTML structure and global styles

import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: 'MediVault | UNZA Clinic Patient Portal',
  description: 'Secure role-based patient portal for the University of Zambia Clinic',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen">
        {children}
        {/* Toast notifications rendered at the app root level */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              background: '#0f3b5c',
              color: '#fff',
              fontSize: '0.9rem',
            },
            success: {
              style: { background: '#1f7b4d' },
              iconTheme: { primary: '#fff', secondary: '#1f7b4d' },
            },
            error: {
              style: { background: '#b91c1c' },
              iconTheme: { primary: '#fff', secondary: '#b91c1c' },
            },
          }}
        />
      </body>
    </html>
  )
}
