// src/hooks/useHashSection.ts
// Keeps a dashboard page's "active section" in sync with the URL hash.
//
// Why this exists:
//   Each dashboard page (patient, doctor, receptionist, pharmacy) is ONE page
//   that shows different sections depending on a piece of React state.
//   The sidebar links look like "/dashboard/patient#records", but nothing on
//   the page ever read the "#records" part, so clicking them did nothing.
//
// How it works:
//   - The URL hash is the source of truth for which section is showing.
//   - When the hash changes (sidebar click, back button, tab click) the hook
//     updates the section.
//   - The sidebar and the pages talk to each other through one custom event,
//     because pushState/replaceState do NOT fire the browser's own
//     "hashchange" event.

'use client'

import { useState, useEffect, useCallback } from 'react'

// Name of the custom event we dispatch after changing the URL hash ourselves
export const HASH_CHANGE_EVENT = 'medivault:hashchange'

// Reads the current URL hash without the leading "#" ("" if there is none)
export function readCurrentHash(): string {
  if (typeof window === 'undefined') return ''
  return window.location.hash.replace('#', '')
}

// Changes the URL hash and tells everyone listening (pages + sidebar)
export function setUrlHash(hash: string, mode: 'push' | 'replace' = 'replace'): void {
  const newUrl = hash ? `${window.location.pathname}#${hash}` : window.location.pathname

  if (mode === 'push') {
    window.history.pushState(null, '', newUrl)
  } else {
    window.history.replaceState(null, '', newUrl)
  }

  window.dispatchEvent(new Event(HASH_CHANGE_EVENT))
}

// Just returns the current hash and re-renders whenever it changes.
// The sidebar uses this to know which link to highlight.
export function useCurrentHash(refreshKey?: string): string {
  const [hash, setHash] = useState('')

  useEffect(() => {
    const syncHash = () => setHash(readCurrentHash())

    syncHash() // read it once right away

    window.addEventListener('hashchange', syncHash)
    window.addEventListener('popstate', syncHash)
    window.addEventListener(HASH_CHANGE_EVENT, syncHash)

    return () => {
      window.removeEventListener('hashchange', syncHash)
      window.removeEventListener('popstate', syncHash)
      window.removeEventListener(HASH_CHANGE_EVENT, syncHash)
    }
  }, [refreshKey])

  return hash
}

// Used by the pages.
//   validSections  - the hash values this page understands (define OUTSIDE the component)
//   defaultSection - what to show when there is no hash in the URL
// Returns [activeSection, setActiveSection], just like useState.
export function useHashSection<T extends string>(
  validSections: readonly T[],
  defaultSection: T
): [T, (section: T) => void] {
  const [activeSection, setActiveSectionState] = useState<T>(defaultSection)

  useEffect(() => {
    const syncSectionFromUrl = () => {
      const hash = readCurrentHash()

      if (hash === '') {
        // No hash means "show the default section"
        setActiveSectionState(defaultSection)
      } else if (validSections.includes(hash as T)) {
        setActiveSectionState(hash as T)
      }
      // A hash we don't recognise (for example "#patients") is ignored
    }

    syncSectionFromUrl() // handle a hash that is already in the URL on first load

    window.addEventListener('hashchange', syncSectionFromUrl)
    window.addEventListener('popstate', syncSectionFromUrl)
    window.addEventListener(HASH_CHANGE_EVENT, syncSectionFromUrl)

    return () => {
      window.removeEventListener('hashchange', syncSectionFromUrl)
      window.removeEventListener('popstate', syncSectionFromUrl)
      window.removeEventListener(HASH_CHANGE_EVENT, syncSectionFromUrl)
    }
  }, [validSections, defaultSection])

  // Called by the tab buttons inside the pages
  const setActiveSection = useCallback(
    (section: T) => {
      setActiveSectionState(section)
      // The default section is shown with a clean URL (no hash)
      setUrlHash(section === defaultSection ? '' : section)
    },
    [defaultSection]
  )

  return [activeSection, setActiveSection]
}
