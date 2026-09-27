import { motion } from 'motion/react'
import type { Agent, AgentId, Domain, User } from '../api'
import { AgentIcon, Avatar, Mark } from './ui'

export type View = 'chat' | 'audit' | 'model'
export type ChatSummary = { id: string; agent: AgentId; title: string; pending: boolean }

type Props = {
  agents: Agent[]
  agent: AgentId
  onAgent: (a: AgentId) => void
  domains: Domain[]
  domain: string | null
  onDomain: (id: string) => void
  chats: ChatSummary[]
  activeChat: string | null
  onChat: (id: string) => void
  view: View
  onView: (v: View) => void
  user: User | null
  onClose?: () => void
}

const row = (on: boolean) =>
  `relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] transition-colors ${on ? 'bg-surface-soft text-ink' : 'text-body hover:bg-surface-soft/60 hover:text-ink'}`

const PanelIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></svg>
)

/** Active rows carry a thin white indicator that glides between items. */
const Indicator = () => (
  <motion.span layoutId="nav-indicator" className="absolute inset-y-2 left-0 w-[2px] rounded-full bg-white" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />
)

export function Sidebar(p: Props) {
  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-hairline bg-canvas" aria-label="Sidebar">
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Mark size={22} />
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[15px] tracking-[-0.2px] text-ink">Global AI Community</span>
        {p.onClose && (
          <button onClick={p.onClose} className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-ink"
            aria-label="Hide sidebar" title="Hide sidebar (Ctrl+Shift+S)" data-testid="hide-sidebar">
            <PanelIcon />
          </button>
        )}
      </div>


      <nav className="mt-3 min-h-0 flex-1 overflow-y-auto px-3" aria-label="Agents and chats">
        <p className="t-label px-3 text-muted">Agents</p>
        <ul className="mt-2 space-y-0.5">
          {p.agents.map((a) => {
            const on = p.view === 'chat' && a.id === p.agent
            const self = on && !(a.id === 'expert' && p.domain)
            return (
              <li key={a.id}>
                <button onClick={() => p.onAgent(a.id)} aria-pressed={on} className={row(self)} data-testid={`agent-${a.id}`} title={a.tagline}>
                  {self && <Indicator />}
                  <span className={on ? 'text-ink' : 'text-muted'}><AgentIcon id={a.id} size={16} /></span>
                  <span className="truncate">{a.name}</span>
                </button>
                {a.id === 'expert' && p.domains.length > 0 && (
                  <ul className="mb-1 ml-[21px] mt-0.5 space-y-0.5 border-l border-hairline pl-2" aria-label="Domains" data-testid="domain-list">
                    {p.domains.map((d) => {
                      const dOn = on && d.id === p.domain
                      return (
                        <li key={d.id}>
                          <button onClick={() => p.onDomain(d.id)} aria-pressed={dOn} className={`${row(dOn)} !py-1.5 !text-[13px]`} data-testid={`domain-${d.id}`}>
                            {dOn && <Indicator />}
                            <span className="min-w-0 flex-1 truncate">{d.name}</span>
                            <span className="font-mono text-[11px] text-muted-soft">{d.documents.length}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        {p.chats.length > 0 && (
          <>
            <p className="t-label mt-7 px-3 text-muted">Recent</p>
            <ul className="mt-2 space-y-0.5" data-testid="chat-list">
              {p.chats.map((c) => {
                const on = c.id === p.activeChat && p.view === 'chat'
                return (
                  <motion.li key={c.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                    <button onClick={() => p.onChat(c.id)} className={row(on)}>
                      <span className="text-muted"><AgentIcon id={c.agent} size={14} /></span>
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      {c.pending && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white animate-pulse-dot" />}
                    </button>
                  </motion.li>
                )
              })}
            </ul>
          </>
        )}

        <p className="t-label mt-7 px-3 text-muted">Workspace</p>
        <ul className="mt-2 space-y-0.5 pb-4">
          {([['audit', 'Audit trail'], ['model', 'Model']] as const).map(([v, label]) => (
            <li key={v}>
              <button onClick={() => p.onView(v)} aria-current={p.view === v ? 'page' : undefined} className={row(p.view === v)}>
                {p.view === v && <Indicator />}
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-hairline px-4 py-3" data-testid="user-card">
        <Avatar name={p.user?.name ?? '?'} size={32} />
        <div className="min-w-0">
          <p className="truncate text-[14px] text-ink">{p.user?.name ?? '…'}</p>
          <p className="truncate text-[12px] text-muted">{p.user?.title}</p>
        </div>
      </div>
    </aside>
  )
}
