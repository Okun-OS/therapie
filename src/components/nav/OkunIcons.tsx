interface IconProps {
  size?: number
  className?: string
}

const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const })

export function IcoDashboard({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

export function IcoMitarbeiter({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 20c0-4 3.1-6.5 7-6.5" />
      <circle cx="17" cy="8" r="2.8" />
      <path d="M13.5 20.5c0-3.3 2.2-5.5 5.2-5.5H22" />
    </svg>
  )
}

export function IcoDienstplanung({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 2v4M16 2v4" />
      <circle cx="16" cy="15.5" r="3" />
      <path d="M16 14v1.5l1 1" />
    </svg>
  )
}

export function IcoZeitUrlaub({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
      <path d="M6.5 20c1-1.5 2.5-2.5 5.5-2.5" strokeDasharray="2 1.5" />
    </svg>
  )
}

export function IcoFinanzen({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  )
}

export function IcoKIAnalyse({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3c-4.5 0-7 2.8-7 5.5 0 2 1 3.5 2.5 4.5L7 17h10l-.5-4c1.5-1 2.5-2.5 2.5-4.5C19 5.8 16.5 3 12 3z" />
      <path d="M9 17v2a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-2" />
      <path d="M9 10h.01M12 8.5h.01M15 10h.01" strokeWidth={2.2} />
    </svg>
  )
}

export function IcoEinstellungen({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  )
}

export function IcoStandorte({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2C8.7 2 6 4.7 6 8c0 5 6 13 6 13s6-8 6-13c0-3.3-2.7-6-6-6z" />
      <circle cx="12" cy="8" r="2.2" />
    </svg>
  )
}

export function IcoSuche({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="10.5" cy="10.5" r="7" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  )
}

export function IcoHeute({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

export function IcoDienstplanErstellen({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4" width="14" height="16" rx="2" />
      <path d="M17 4h2a2 2 0 0 1 2 2v2" />
      <path d="M7 9h8M7 12h5" />
      <circle cx="18" cy="18" r="4" />
      <path d="M18 16v2h2" />
    </svg>
  )
}

export function IcoKalender({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M7 13h2v2H7z" fill="currentColor" stroke="none" />
      <path d="M11 13h2v2h-2z" fill="currentColor" stroke="none" />
      <path d="M15 13h2v2h-2z" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function IcoUrlaubsantraege({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13l2 2 4-4" />
    </svg>
  )
}

export function IcoAufgaben({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12l2 2 4-4M9 17h4" />
    </svg>
  )
}

export function IcoVertretungen({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M7 8c0-2.2 1.8-4 4-4s4 1.8 4 4" />
      <path d="M3 20c0-3.5 2.5-5.5 6-5.5" />
      <path d="M14.5 15c2.5 0 5 1.5 5.5 4.5" />
      <path d="M19 11l-4.5 3.5M14.5 11l4.5 3.5" />
    </svg>
  )
}

export function IcoBerichte({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 20H4a1 1 0 0 1-1-1V5" />
      <path d="M7 15l3-4 4 2 4-6" />
      <path d="M20 6l-2-3-2 3" />
    </svg>
  )
}

export function IcoWorkforceScore({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8l-6.2 3.2L7 14.2 2 9.3l6.9-1z" />
    </svg>
  )
}

export function IcoPersonalrisiko({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3L4 7v6c0 4.4 3.4 8.5 8 9.5 4.6-1 8-5.1 8-9.5V7z" />
      <path d="M12 8v4M12 15.5h.01" strokeWidth={2} />
    </svg>
  )
}

export function IcoSupport({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <path d="M4.2 4.2l3.7 3.7M16.1 16.1l3.7 3.7M19.8 4.2l-3.7 3.7M8 16l-3.8 3.8" />
    </svg>
  )
}

export function IcoMitarbeiterprofil({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.1-6 7-6s7 2 7 6" />
      <path d="M16 3.5a4 4 0 0 1 0 7" strokeDasharray="2 1.5" />
    </svg>
  )
}

export function IcoLohnabrechnung({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M12 7v10M9 9.5h4.5a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3H15" />
    </svg>
  )
}

export function IcoZuschlagsEngine({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M13 2L4.5 13H12l-1 9 8.5-11H12z" />
    </svg>
  )
}

export function IcoFairnessEngine({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3v18M5 7h14" />
      <path d="M5 7l-3 5c0 2.2 1.8 4 4 4a3.8 3.8 0 0 0 4-4z" />
      <path d="M19 7l-3 5c0 2.2 1.8 4 4 4a3.8 3.8 0 0 0 4-4z" />
    </svg>
  )
}

export function IcoKIOnboarding({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M9 16c1 1 5 1 6 0" />
    </svg>
  )
}

export function IcoOKUNAssistent({ size = 22, className }: IconProps) {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
      <path d="M5 15l.6 1.6L7 17l-1.4.4L5 19l-.6-1.6L3 17l1.4-.4z" />
    </svg>
  )
}
