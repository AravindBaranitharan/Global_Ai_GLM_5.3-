import { motion } from 'motion/react'
import type { Health } from '../api'
import { DocIcon } from './ui'

type Props = {
  title: string
  subtitle?: string
  defence: boolean
  defenceBusy: boolean
  onDefence: (on: boolean) => void
  health: Health | null
  healthError: boolean
  docCount: number
  onDocuments: () => void
  onMenu: () => void
}

export function Header(p: Props) {
  const ok = !!p.health?.ok && !p.healthError
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-hairline px-4 md:px-6">
      <button className="btn btn-secondary btn-icon lg:hidden" aria-label="Open menu" onClick={p.onMenu}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{p.title}</p>
        {p.subtitle && <p className="hidden truncate text-[12.5px] text-muted sm:block">{p.subtitle}</p>}
      </div>

      <span className="badge hidden !bg-transparent md:inline-flex" data-testid="endpoint-badge" title={p.health ? `${p.health.model}, ${p.health.chunks} passages indexed` : undefined}>
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald animate-pulse-dot' : 'bg-rose'}`} aria-hidden />
        <span className={ok ? 'text-body' : 'text-rose'}>{p.healthError ? 'Server offline' : p.health?.endpoint_label ?? 'Connecting'}</span>
      </span>

      <button
        role="switch"
        aria-checked={p.defence}
        aria-label="Injection defence"
        disabled={p.defenceBusy}
        onClick={() => p.onDefence(!p.defence)}
        className={`btn btn-secondary btn-sm gap-2.5 ${p.defence ? '' : '!border-warning/60 !text-warning'}`}
        data-testid="defence-toggle"
      >
        <span className={`relative inline-block h-[18px] w-[32px] rounded-full transition-colors ${p.defence ? 'bg-emerald' : 'bg-warning'}`} aria-hidden>
          <motion.span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-canvas" animate={{ left: p.defence ? 16 : 2 }} transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
        </span>
        <span className="hidden sm:inline">Defence {p.defence ? 'On' : 'Off'}</span>
      </button>

      <button className="btn btn-primary btn-sm gap-2" onClick={p.onDocuments} data-testid="documents-button">
        <DocIcon size={15} />
        Documents
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-on-primary px-1.5 text-[11px] font-bold text-primary">{p.docCount}</span>
      </button>
    </header>
  )
}
