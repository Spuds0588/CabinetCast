import type { ReactNode } from 'react'
import type { InputKind } from '../core/protocol'

export type IconKind = InputKind | 'guest' | 'empty'

/** Small stroked line icons, sized to sit inside a slot row or a tag. */
const ICONS: Record<IconKind, ReactNode> = {
  keyboard: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6 9.5h2M10 9.5h2M14 9.5h2M18 9.5h.5M6 12.5h2M10 12.5h2M14 12.5h2M18 12.5h.5M8 15.5h8" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.4l-.8 3.4a2.2 2.2 0 0 1-3.9 1L14.5 15h-5l-1.7 2.8a2.2 2.2 0 0 1-3.9-1l-.8-3.4A4.5 4.5 0 0 1 7.5 8Z" />
      <path d="M8 11v3.2M6.4 12.6h3.2" />
      <circle cx="16" cy="11.8" r=".9" />
      <circle cx="18" cy="14" r=".9" />
    </>
  ),
  arcade: (
    <>
      <path d="M3.5 20h17l-1.2-8.4a2 2 0 0 0-2-1.7H6.7a2 2 0 0 0-2 1.7Z" />
      <path d="M9 9.6V5.6" />
      <circle cx="9" cy="4.4" r="1.7" />
      <circle cx="15" cy="13" r="1" />
      <circle cx="17.4" cy="16.2" r="1" />
      <circle cx="12.6" cy="16.2" r="1" />
    </>
  ),
  touch: (
    <>
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
      <circle cx="12" cy="9.5" r="2.2" />
      <path d="M12 6.5v-.6M15 9.5h.6M8.4 9.5H9M12 12.5v.6" />
    </>
  ),
  guest: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </>
  ),
  empty: (
    <>
      <circle cx="12" cy="12" r="8.5" strokeDasharray="3 4" />
      <path d="M9 12h6" />
    </>
  ),
}

export function InputIcon({ kind, size = 16 }: { kind: IconKind; size?: number }) {
  return (
    <svg
      className={`input-icon ${kind}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {ICONS[kind]}
    </svg>
  )
}
