// src/components/NotificationBell.tsx
// The bell in the dashboard header. Shows how many notifications are unread
// and, when clicked, a list of the latest ones. Every role uses the same bell.
//
// It checks for new notifications every 30 seconds. (Simple polling keeps this
// easy to follow; a real-time version could use WebSockets later.)

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { AppNotification } from '@/src/types'
import { formatDateTime } from '@/src/lib/format'
import { setUrlHash } from '@/src/hooks/useHashSection'
import { BellIcon, CheckCircleIcon } from '@/src/components/icons'

const POLL_EVERY_MS = 30_000

export default function NotificationBell() {
  const router = useRouter()
  const pathname = usePathname()
  const [items, setItems] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Ask the server for the latest notifications
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications')
      const data = await response.json()
      if (data.success) {
        setItems(data.data.items)
        setUnreadCount(data.data.unreadCount)
      }
    } catch {
      // A failed check is not worth bothering the user about; we try again in 30 seconds
    }
  }, [])

  // Load once, then keep checking
  useEffect(() => {
    load()
    const timer = setInterval(load, POLL_EVERY_MS)
    return () => clearInterval(timer)
  }, [load])

  // Close the menu when the user clicks anywhere outside it
  useEffect(() => {
    if (!open) return
    const closeIfOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', closeIfOutside)
    return () => document.removeEventListener('mousedown', closeIfOutside)
  }, [open])

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } catch {
      // If this fails the notification simply stays unread; nothing else breaks
    }
  }

  const handleMarkAllRead = async () => {
    await markRead({ all: true })
    load()
  }

  // Clicking a notification marks it read and takes you to the page it is about
  const handleOpenNotification = async (notification: AppNotification) => {
    setOpen(false)
    if (!notification.readAt) {
      await markRead({ ids: [notification.id] })
      load()
    }
    if (!notification.link) return

    const [linkPath, linkHash = ''] = notification.link.split('#')
    if (linkPath === pathname) {
      // Same page: just switch the section (a hash-only change does not re-render by itself)
      setUrlHash(linkHash, 'push')
    } else {
      router.push(notification.link)
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative text-slate-500 hover:text-[#0f3b5c] transition-colors p-2 rounded-lg hover:bg-slate-100"
      >
        <BellIcon size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-[#0f3b5c] text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                <CheckCircleIcon size={12} /> Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">You&apos;re all caught up.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
              {items.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleOpenNotification(notification)}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${notification.readAt ? '' : 'bg-blue-50/50'}`}
                >
                  <div className="flex items-start gap-2">
                    {!notification.readAt && <span className="mt-1.5 w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{notification.title}</p>
                      {notification.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notification.body}</p>}
                      <p className="text-[11px] text-slate-400 mt-1">{formatDateTime(notification.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
