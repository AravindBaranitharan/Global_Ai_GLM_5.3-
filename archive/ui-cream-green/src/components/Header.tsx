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
    <header className="relative z-10 flex h-[72px] shrink-0 items-center gap-3 bg-white px-4 shadow-[var(--shadow-nav)] md:px-8">
      <button className="btn btn-dark btn-icon lg:hidden" aria-label="Open menu" onClick={p.onMenu}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.6" /></svg>
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold tracking-[-0.16px] text-brand">{p.title}</p>
        {p.subtitle && <p className="hidden truncate text-[13px] text-muted sm:block">{p.subtitle}</p>}
      </div>

      <span className="badge hidden !h-8 !bg-canvas !px-3 !font-medium md:inline-flex" data-testid="endpoint-badge" title={p.health ? `${p.health.model}, ${p.health.chunks} passages indexed` : undefined}>
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-primary animate-pulse-dot' : 'bg-rose'}`} aria-hidden />
        <span className={ok ? 'text-body' : 'text-rose'}>{p.healthError ? 'Server offline' : p.health?.endpoint_label ?? 'Connecting'}</span>
      </span>

      <button
        role="switch"
        aria-checked={p.defence}
        aria-label="Injection defence"
        disabled={p.defenceBusy}
        onClick={() => p.onDefence(!p.defence)}
        className={`btn btn-dark btn-sm gap-2.5 ${p.defence ? '' : '!border-rose !text-rose'}`}
        data-testid="defence-toggle"
      >
        <span className={`relative inline-block h-[18px] w-[32px] rounded-full transition-colors ${p.defence ? 'bg-primary' : 'bg-rose'}`} aria-hidden>
          <motion.span className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-sm" animate={{ left: p.defence ? 16 : 2 }} transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
        </span>
        <span className="hidden sm:inline">Defence {p.defence ? 'On' : 'Off'}</span>
      </button>

      <button className="btn btn-primary btn-sm gap-2" onClick={p.onDocuments} data-testid="documents-button">
        <DocIcon size={15} />
        <span className="hidden sm:inline">Documents</span>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-primary">{p.docCount}</span>
      </button>
    </header>
  )
}
