import { AnimatePresence, motion } from 'motion/react'
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
  sidebarHidden?: boolean
  onShowSidebar?: () => void
}

export function Header(p: Props) {
  const ok = !!p.health?.ok && !p.healthError
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 px-4 md:px-5">
      <button className="btn btn-icon lg:hidden" aria-label="Open menu" onClick={p.onMenu}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.4" /></svg>
      </button>
      <AnimatePresence initial={false}>
        {p.sidebarHidden && (
          <motion.span className="hidden items-center gap-3 lg:flex" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.2 }}>
            <button onClick={p.onShowSidebar} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-ink"
              aria-label="Show sidebar" title="Show sidebar (Ctrl+Shift+S)" data-testid="show-sidebar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>
            </button>
            <span className="h-4 w-px bg-hairline-strong" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
      <div className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={p.title} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="flex min-w-0 items-baseline gap-3">
            <p className="max-w-[70%] shrink-0 truncate text-[15px] text-ink">{p.title}</p>
            {p.subtitle && <p className="hidden min-w-0 flex-1 truncate text-[13px] text-muted xl:block">{p.subtitle}</p>}
          </motion.div>
        </AnimatePresence>
      </div>

      <span className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[1.2px] md:inline-flex" data-testid="endpoint-badge" title={p.health ? `${p.health.model}, ${p.health.chunks} passages indexed` : undefined}>
        <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald animate-pulse-dot' : 'bg-rose'}`} aria-hidden />
        <span className={ok ? 'text-muted' : 'text-rose'}>{p.healthError ? 'Server offline' : p.health?.endpoint_label ?? 'Connecting'}</span>
      </span>

      <button
        role="switch"
        aria-checked={p.defence}
        aria-label="Injection defence"
        disabled={p.defenceBusy}
        onClick={() => p.onDefence(!p.defence)}
        className={`btn btn-sm gap-2.5 ${p.defence ? '' : '!border-sunset/60 !text-sunset'}`}
        data-testid="defence-toggle"
      >
        <span className={`relative inline-block h-[16px] w-[28px] rounded-full border transition-colors ${p.defence ? 'border-white bg-white' : 'border-sunset/70 bg-transparent'}`} aria-hidden>
          <motion.span className={`absolute top-[2px] h-[10px] w-[10px] rounded-full ${p.defence ? 'bg-canvas' : 'bg-sunset'}`} animate={{ left: p.defence ? 14 : 2 }} transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
        </span>
        <span className="hidden sm:inline">Defence {p.defence ? 'on' : 'off'}</span>
      </button>

      <button className="btn btn-primary btn-sm gap-2" onClick={p.onDocuments} data-testid="documents-button">
        <DocIcon size={14} />
        <span className="hidden sm:inline">Documents</span>
        <span className="font-mono text-[11px] text-on-primary/60">{p.docCount}</span>
      </button>
    </header>
  )
}
