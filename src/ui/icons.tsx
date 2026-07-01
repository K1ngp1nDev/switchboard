import type { NodeKind } from '../engine/types'

interface IconProps {
  className?: string
}

const S = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const BoltIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
  </svg>
)

export const SparkIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    <circle cx="12" cy="12" r="3.2" />
  </svg>
)

export const WrenchIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M14.7 6.3a4.5 4.5 0 0 0-6 6L3 18l3 3 5.7-5.7a4.5 4.5 0 0 0 6-6L14 13l-3-3 3.7-3.7Z" />
  </svg>
)

export const SplitIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M4 12h5m0 0 4-6h7M9 12l4 6h7" />
    <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </svg>
)

export const ShieldIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </svg>
)

export const UserCheckIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <circle cx="9" cy="8" r="3.4" />
    <path d="M3.5 20c.8-3.2 3-5 5.5-5s4.7 1.8 5.5 5M15.5 10.5l2 2 3.5-4" />
  </svg>
)

export const FlagIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M5 21V4m0 1h11.5l-2 4 2 4H5" />
  </svg>
)

export const NODE_ICONS: Record<NodeKind, (p: IconProps) => React.ReactNode> = {
  trigger: BoltIcon,
  llm: SparkIcon,
  tool: WrenchIcon,
  router: SplitIcon,
  guardrail: ShieldIcon,
  approval: UserCheckIcon,
  output: FlagIcon,
}

export const PlayIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M8 5.14v13.72c0 .8.87 1.3 1.56.88l10.54-6.86a1.05 1.05 0 0 0 0-1.76L9.56 4.26A1.04 1.04 0 0 0 8 5.14Z" />
  </svg>
)

export const PauseIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
)

export const RestartIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M4 5v6h6" />
    <path d="M4.5 11a8 8 0 1 1 2 6" />
  </svg>
)

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="m5 12.5 5 5L19 7" />
  </svg>
)

export const XIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const SpinnerIcon = ({ className }: IconProps) => (
  <svg {...S} className={`spin ${className ?? ''}`} aria-hidden>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
)

export const ClockIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
)

export const PanelRightIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M14.5 4.5v15" />
  </svg>
)

export const RowsIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <path d="M3.5 14.5h17M8 9h8" />
  </svg>
)

export const SunIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
  </svg>
)

export const MoonIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" />
  </svg>
)

export const CameraIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="m15 9 5-3v12l-5-3" />
    <rect x="3.5" y="6.5" width="11.5" height="11" rx="2.5" />
  </svg>
)

export const ListIcon = ({ className }: IconProps) => (
  <svg {...S} className={className} aria-hidden>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)
