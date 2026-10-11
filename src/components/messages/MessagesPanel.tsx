// src/components/messages/MessagesPanel.tsx
// Private messaging, used on BOTH the patient and the doctor dashboards.
//   left side  : your conversations (a patient sees their care-team doctors)
//   right side : the open thread and a box to reply
//
// The server decides who may talk to whom (see src/app/api/messages/route.ts);
// this component only shows what the server allows.
//
// New messages are picked up by checking every 15 seconds while the panel is open.

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import type { ChatMessage, ConversationSummary } from '@/src/types'
import { formatDateTime, formatDoctorName } from '@/src/lib/format'
import { MessageIcon, SendIcon } from '@/src/components/icons'

const POLL_EVERY_MS = 15_000

interface MessagesPanelProps {
  // Who is looking at the panel. A patient talks to doctors; a doctor talks to patients.
  viewerRole: 'PATIENT' | 'DOCTOR'
  viewerId: string
  // Optionally also list this person even if you have never written to each other
  // (the doctor dashboard passes the patient they have selected). The server still
  // refuses the message unless they really are on each other's care team.
  startWith?: { id: string; fullName: string }
}

export default function MessagesPanel({ viewerRole, viewerId, startWith }: MessagesPanelProps) {
  const [loadedConversations, setConversations] = useState<ConversationSummary[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [openPartnerId, setOpenPartnerId] = useState<string | null>(null)
  const [thread, setThread] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // The list from the server, plus the "start with" person if they are not in it yet
  const conversations =
    startWith && !loadedConversations.some((c) => c.partner.id === startWith.id)
      ? [{ partner: startWith, lastMessage: null, lastMessageAt: null, unreadCount: 0 }, ...loadedConversations]
      : loadedConversations

  // How to show the other person's name: doctors get a "Dr." in front
  const displayName = (fullName: string) => (viewerRole === 'PATIENT' ? formatDoctorName(fullName) : fullName)

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/messages')
      const data = await response.json()
      if (data.success) setConversations(data.data)
    } catch {
      // Ignore: the next check will try again
    } finally {
      setListLoading(false)
    }
  }, [])

  // Opening a thread also marks the other person's messages as read on the server
  const loadThread = useCallback(async (partnerId: string) => {
    try {
      const response = await fetch(`/api/messages?with=${encodeURIComponent(partnerId)}`)
      const data = await response.json()
      if (data.success) setThread(data.data)
      else toast.error(data.error || 'Could not open this conversation')
    } catch {
      toast.error('Could not open this conversation')
    }
  }, [])

  // Load the list now, and keep it (and the open thread) fresh
  useEffect(() => {
    loadConversations()
    const timer = setInterval(() => {
      loadConversations()
      if (openPartnerId) loadThread(openPartnerId)
    }, POLL_EVERY_MS)
    return () => clearInterval(timer)
  }, [loadConversations, loadThread, openPartnerId])

  // Scroll to the newest message whenever the thread changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const openConversation = async (partnerId: string) => {
    setOpenPartnerId(partnerId)
    setThread([])
    await loadThread(partnerId)
    loadConversations() // the unread badge for this thread should now clear
  }

  const handleSend = async () => {
    if (!openPartnerId || draft.trim().length === 0) return
    setSending(true)
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: openPartnerId, body: draft }),
      })
      const data = await response.json()
      if (data.success) {
        setDraft('')
        await loadThread(openPartnerId)
        loadConversations()
      } else {
        toast.error(data.error || 'Message not sent')
      }
    } finally {
      setSending(false)
    }
  }

  const openPartner = conversations.find((c) => c.partner.id === openPartnerId)?.partner

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden grid md:grid-cols-[280px_1fr] min-h-[420px]">
      {/* Conversation list */}
      <div className="border-b md:border-b-0 md:border-r border-slate-100">
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-[#0f3b5c] flex items-center gap-2">
            <MessageIcon size={16} /> {viewerRole === 'PATIENT' ? 'My Care Team' : 'Patient Messages'}
          </h2>
        </div>
        {listLoading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            {viewerRole === 'PATIENT'
              ? 'You can message a doctor once they have treated you.'
              : 'No messages from patients yet.'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((conversation) => (
              <button
                key={conversation.partner.id}
                onClick={() => openConversation(conversation.partner.id)}
                className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                  openPartnerId === conversation.partner.id ? 'bg-slate-50' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">{displayName(conversation.partner.fullName)}</p>
                  {conversation.unreadCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{conversation.lastMessage || 'No messages yet'}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Open thread */}
      <div className="flex flex-col">
        {!openPartnerId || !openPartner ? (
          <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-8 text-center">
            Choose a conversation to read it or write a message.
          </div>
        ) : (
          <>
            <div className="p-4 border-b border-slate-100">
              <p className="font-semibold text-slate-800">{displayName(openPartner.fullName)}</p>
              <p className="text-xs text-slate-400">
                Private. Please don&apos;t use messages for emergencies; go to the clinic or call for help.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[340px]">
              {thread.length === 0 ? (
                <p className="text-sm text-slate-400 text-center mt-8">No messages yet. Say hello.</p>
              ) : (
                thread.map((message) => {
                  const isMine = message.senderId === viewerId
                  return (
                    <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-[#0f3b5c] text-white' : 'bg-slate-100 text-slate-800'}`}>
                        <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>
                        <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>
                          {formatDateTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  // Enter sends; Shift+Enter makes a new line
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    handleSend()
                  }
                }}
                maxLength={2000}
                rows={2}
                placeholder="Write a message..."
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0f3b5c]"
              />
              <button
                onClick={handleSend}
                disabled={sending || draft.trim().length === 0}
                className="bg-[#0f3b5c] text-white px-4 rounded-xl text-sm font-semibold hover:bg-[#0a2c45] transition-all disabled:opacity-50 inline-flex items-center gap-2"
              >
                <SendIcon size={15} /> Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
