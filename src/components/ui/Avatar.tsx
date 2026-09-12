'use client'

interface AvatarProps {
  name: string
  avatarUrl?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

// A small, deterministic color palette for the initials fallback.
const PALETTE = [
  { bg: '#1E3A5F', text: '#F5C842' }, // navy / brand
  { bg: '#2563EB', text: '#FFFFFF' }, // blue
  { bg: '#059669', text: '#FFFFFF' }, // green
  { bg: '#D97706', text: '#FFFFFF' }, // amber
  { bg: '#7C3AED', text: '#FFFFFF' }, // violet
  { bg: '#DB2777', text: '#FFFFFF' }, // pink
  { bg: '#0891B2', text: '#FFFFFF' }, // cyan
  { bg: '#DC2626', text: '#FFFFFF' }, // red
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0
  }
  return h
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?'
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase()
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'w-6 h-6 text-[10px]',
  md: 'w-8 h-8 text-xs',
  lg: 'w-10 h-10 text-sm',
  xl: 'w-14 h-14 text-lg',
}

export function Avatar({ name, avatarUrl, size = 'md' }: AvatarProps) {
  const sizeClass = SIZE_CLASSES[size]

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    )
  }

  const color = PALETTE[hashName(name) % PALETTE.length]
  const initials = getInitials(name)

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none`}
      style={{ backgroundColor: color.bg, color: color.text }}
      aria-label={name}
    >
      {initials}
    </div>
  )
}
