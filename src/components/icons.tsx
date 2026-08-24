// src/components/icons.tsx
//
// A small, self-contained set of SVG icons used throughout MediVault.
//
// Why this file exists:
// The app previously used emoji characters (like 🔒 or ✅) as icons.
// Emoji render differently across operating systems and fonts, so two
// people could see two different pictures for the same icon. SVG icons
// always look the same everywhere, so we replaced every emoji with one
// of the icons below.
//
// How each icon works:
// Every icon is a small React component that renders an <svg> element.
// They all accept the same two optional props:
//   - className: any Tailwind classes you want to add (e.g. text color, size)
//   - size: the width and height of the icon in pixels (defaults to 20)
//
// All icons use "currentColor" for their stroke, which means the icon
// automatically takes on whatever text color is set on it (or inherited
// from a parent element) via Tailwind classes like "text-red-600".

import type { ReactNode, SVGProps } from 'react'

// Props shared by every icon in this file
export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

// A tiny wrapper that applies the common <svg> attributes so we don't
// have to repeat them on every single icon below.
function IconBase({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

// ── Navigation & actions ──────────────────────────────────────────────────

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </IconBase>
  )
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </IconBase>
  )
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="15 18 9 12 15 6" />
    </IconBase>
  )
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="9 18 15 12 9 6" />
    </IconBase>
  )
}

export function ChevronUpIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="18 15 12 9 6 15" />
    </IconBase>
  )
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="6 9 12 15 18 9" />
    </IconBase>
  )
}

export function RefreshIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </IconBase>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </IconBase>
  )
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </IconBase>
  )
}

export function LogOutIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </IconBase>
  )
}

export function DownloadIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </IconBase>
  )
}

export function SaveIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </IconBase>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </IconBase>
  )
}

// ── Status & feedback ─────────────────────────────────────────────────────

export function CheckCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </IconBase>
  )
}

export function XCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </IconBase>
  )
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </IconBase>
  )
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="7.5" x2="12.01" y2="7.5" />
    </IconBase>
  )
}

export function ClockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 14" />
    </IconBase>
  )
}

// ── Domain icons (medical / clinic) ───────────────────────────────────────

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
    </IconBase>
  )
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5l-8-3Z" />
      <polyline points="9 12 11 14 15.5 9.5" />
    </IconBase>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </IconBase>
  )
}

export function HospitalIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="8" width="18" height="13" rx="1" />
      <path d="M9 21V13h6v8" />
      <line x1="12" y1="3" x2="12" y2="8" />
      <line x1="9.5" y1="5.5" x2="14.5" y2="5.5" />
      <line x1="9" y1="16" x2="9.01" y2="16" />
      <line x1="15" y1="16" x2="15.01" y2="16" />
    </IconBase>
  )
}

export function PillIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="9.5" width="18" height="9" rx="4.5" transform="rotate(-45 12 12)" />
      <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
    </IconBase>
  )
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </IconBase>
  )
}

export function FileTextIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </IconBase>
  )
}

export function ClipboardIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </IconBase>
  )
}

export function ClipboardListIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <rect x="9" y="2.5" width="6" height="3" rx="1" />
      <line x1="9" y1="11" x2="12.5" y2="11" />
      <line x1="9" y1="15" x2="12.5" y2="15" />
      <line x1="14.5" y1="11" x2="14.5" y2="11.01" />
      <line x1="14.5" y1="15" x2="14.5" y2="15.01" />
    </IconBase>
  )
}

export function HeartIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 20.5s-7.5-4.6-9.6-9.4C1 7.7 2.6 4.5 6 4c2-.3 3.7.7 6 3.1C14.3 4.7 16 3.7 18 4c3.4.5 5 3.7 3.6 7.1C19.5 15.9 12 20.5 12 20.5Z" />
    </IconBase>
  )
}

export function UsersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5S15.5 16.4 15.5 20" />
      <path d="M16 8.5A3 3 0 1 1 16.6 14.5" />
      <path d="M17.5 13.7c2.6.5 4.5 2.9 4.5 5.8" />
    </IconBase>
  )
}

export function UserIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </IconBase>
  )
}

export function UserPlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </IconBase>
  )
}

export function UserCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="10" cy="8" r="4" />
      <path d="M2 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
      <polyline points="16 11 18 13 22 9" />
    </IconBase>
  )
}

export function StethoscopeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <path d="M9 13v2a6 6 0 0 0 12 0v-2.5" />
      <circle cx="21" cy="10.5" r="1.7" />
      <circle cx="5" cy="3" r="0.01" />
    </IconBase>
  )
}

export function HomeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </IconBase>
  )
}

export function DatabaseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <ellipse cx="12" cy="5.5" rx="8" ry="2.5" />
      <path d="M4 5.5V12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5.5" />
      <path d="M4 12v6.5c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V12" />
    </IconBase>
  )
}
