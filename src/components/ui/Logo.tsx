import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'icon' | 'wordmark'
  /** Wordmark text color treatment for dark backgrounds (sidebar, navy pages) vs. light cards/emails */
  onDark?: boolean
  tagline?: boolean
  iconSize?: number
  className?: string
}

export function Logo({ variant = 'wordmark', onDark = false, tagline = false, iconSize = 36, className }: LogoProps) {
  if (variant === 'icon') {
    return (
      <img
        src="/brand/icon.png"
        alt="OKUN Workforce"
        width={iconSize}
        height={iconSize}
        style={{ width: iconSize, height: iconSize }}
        className={cn('object-contain', className)}
      />
    )
  }

  if (!onDark) {
    return (
      <img
        src={tagline ? '/brand/logo-full-tagline.png' : '/brand/logo-horizontal.png'}
        alt="OKUN Workforce"
        style={{ height: iconSize * 1.05 }}
        className={cn('object-contain', className)}
      />
    )
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <img
        src="/brand/icon.png"
        alt=""
        width={iconSize}
        height={iconSize}
        style={{ width: iconSize, height: iconSize }}
        className="object-contain flex-shrink-0"
      />
      <div>
        <p className="font-extrabold uppercase tracking-wide text-white leading-tight" style={{ fontSize: iconSize * 0.42 }}>
          OKUN <span className="text-brand">Workforce</span>
        </p>
        {tagline && (
          <p className="text-gold text-[10px] uppercase tracking-wide font-semibold leading-tight mt-0.5">
            Das intelligente Betriebssystem für Ihr Personal
          </p>
        )}
      </div>
    </div>
  )
}
