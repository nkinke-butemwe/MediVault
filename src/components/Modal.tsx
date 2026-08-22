// src/components/Modal.tsx
//
// A reusable modal wrapper.
//
// WHY THIS EXISTS:
// The dashboard layout wraps page content in a div with the "animate-fade-in"
// class, which uses a CSS "transform" during its entry animation. In CSS,
// any ancestor with a "transform" (even one that finishes at translateY(0))
// creates a new "containing block" for descendants that use
// "position: fixed". That means a fixed-position modal that lives inside
// that animated div is no longer positioned relative to the browser window —
// it gets positioned relative to that inner div instead. That's why the
// "Create User" modal looked cut off / offset on the page instead of being
// centered on the screen.
//
// THE FIX: render the modal through a React Portal directly into
// document.body. document.body is outside the animated wrapper, so the
// modal's "position: fixed" is always relative to the real browser
// viewport, no matter what CSS the rest of the page is doing.
'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  children: React.ReactNode
  onClose: () => void
  maxWidthClassName?: string // e.g. "max-w-md" or "max-w-sm"
}

export default function Modal({ children, onClose, maxWidthClassName = 'max-w-md' }: ModalProps) {
  // We can only use createPortal once the component has mounted in the
  // browser, because document.body does not exist during server rendering.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close the modal when the user presses the Escape key.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Prevent the page behind the modal from scrolling while the modal is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (!mounted) {
    return null
  }

  const modalMarkup = (
    // Clicking the dark backdrop closes the modal. Clicking inside the
    // white card does not (we stop the click from "bubbling up" to the
    // backdrop using stopPropagation).
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl p-6 w-full ${maxWidthClassName} my-8 animate-fade-in-modal`}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )

  // Render the modal markup into document.body instead of in its normal
  // place in the component tree. This is what a "portal" does.
  return createPortal(modalMarkup, document.body)
}
