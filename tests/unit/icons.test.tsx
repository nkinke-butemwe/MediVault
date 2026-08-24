// tests/unit/icons.test.tsx
//
// Tests for src/components/icons.tsx — the SVG icon library that
// replaced the emoji characters used throughout the app.
//
// We render each icon to a plain HTML string using React's server
// renderer (renderToStaticMarkup). This does not need a browser or a
// simulated browser (jsdom) — it just turns the component into markup
// text we can inspect, which is all we need to confirm the icons are
// valid SVGs that accept the props we expect.

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  ShieldIcon,
  LockIcon,
  HospitalIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  PillIcon,
  CalendarIcon,
  CloseIcon,
  SaveIcon,
  DownloadIcon,
  RefreshIcon,
  HeartIcon,
  PlusIcon,
  ClockIcon,
  InfoIcon,
  FileTextIcon,
  ClipboardIcon,
  ClipboardListIcon,
  UsersIcon,
  UserIcon,
  UserPlusIcon,
  UserCheckIcon,
  StethoscopeIcon,
  HomeIcon,
  DatabaseIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  LogOutIcon,
  ShieldCheckIcon,
} from '@/src/components/icons'

// Every icon component used somewhere in the app. If someone adds a new
// icon to icons.tsx, adding it to this list gives it the same basic
// safety checks as all the others.
const allIcons = {
  ShieldIcon,
  LockIcon,
  HospitalIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  AlertTriangleIcon,
  PillIcon,
  CalendarIcon,
  CloseIcon,
  SaveIcon,
  DownloadIcon,
  RefreshIcon,
  HeartIcon,
  PlusIcon,
  ClockIcon,
  InfoIcon,
  FileTextIcon,
  ClipboardIcon,
  ClipboardListIcon,
  UsersIcon,
  UserIcon,
  UserPlusIcon,
  UserCheckIcon,
  StethoscopeIcon,
  HomeIcon,
  DatabaseIcon,
  SearchIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  LogOutIcon,
  ShieldCheckIcon,
}

describe('icon library', () => {
  for (const [iconName, IconComponent] of Object.entries(allIcons)) {
    it(`${iconName} renders as a valid SVG element`, () => {
      const markup = renderToStaticMarkup(<IconComponent />)
      expect(markup).toContain('<svg')
      expect(markup).toContain('viewBox="0 0 24 24"')
    })
  }

  it('respects a custom size prop', () => {
    const markup = renderToStaticMarkup(<HeartIcon size={40} />)
    expect(markup).toContain('width="40"')
    expect(markup).toContain('height="40"')
  })

  it('defaults to a size of 20 when no size prop is given', () => {
    const markup = renderToStaticMarkup(<HeartIcon />)
    expect(markup).toContain('width="20"')
    expect(markup).toContain('height="20"')
  })

  it('accepts an additional className for Tailwind color/spacing utilities', () => {
    const markup = renderToStaticMarkup(<CheckCircleIcon className="text-green-600" />)
    expect(markup).toContain('class="text-green-600"')
  })
})
