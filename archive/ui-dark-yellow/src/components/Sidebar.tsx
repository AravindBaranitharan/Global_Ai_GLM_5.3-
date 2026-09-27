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
  onNewChat: () => void
  view: View
  onView: (v: View) => void
  user: User | null
  onClose?: () => void
}

export function Sidebar(p: Props) {
  return (
    <aside className="flex h-full w-[272px] shrink-0 flex-col border-r border-hairline bg-surface-soft" aria-label="Sidebar">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <Mark />
        <span className="whitespace-nowrap text-[16px] font-bold tracking-[-0.4px] text-ink">Global AI Community</span>
      </div>

      <div className="px-3">
        <button onClick={p.onNewChat} className="btn btn-secondary w-full justify-start gap-2.5 !px-3" data-testid="new-chat">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" /></svg>
          New chat
        </button>
      </div>

      <nav className="mt-6 min-h-0 flex-1 overflow-y-auto px-3" aria-label="Agents and chats">
        <p className="t-label px-2 !text-[11px] text-muted-soft">Agents</p>
        <ul className="mt-2 space-y-0.5">
          {p.agents.map((a) => {
            const on = p.view === 'chat' && a.id === p.agent
            return (
              <li key={a.id}>
                <button
                  onClick={() => p.onAgent(a.id)}
                  aria-pressed={on}
                  className={`relative flex w-full items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition-colors ${on ? 'bg-surface-elevated' : 'hover:bg-surface-card'}`}
                  data-testid={`agent-${a.id}`}
                >
                  {on && <motion.span layoutId="agent-marker" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" />}
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ${on ? 'bg-primary text-on-primary' : 'bg-surface-card text-body'}`}>
                    <AgentIcon id={a.id} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className={`t-title-sm block !text-[14px] ${on ? 'text-ink' : 'text-body'}`}>{a.name}</span>
                    <span className="block text-[12px] leading-snug text-muted">{a.tagline}</span>
                  </span>
                </button>
                {a.id === 'expert' && p.domains.length > 0 && (
                  <ul className="mb-1 ml-[22px] mt-1 space-y-0.5 border-l border-hairline pl-2.5" aria-label="Domains" data-testid="domain-list">
                    {p.domains.map((d) => {
                      const dOn = on && d.id === p.domain
                      return (
                        <li key={d.id}>
                          <button
                            onClick={() => p.onDomain(d.id)}
                            aria-pressed={dOn}
                            className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${dOn ? 'bg-surface-elevated text-ink' : 'text-body hover:bg-surface-card'}`}
                            data-testid={`domain-${d.id}`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dOn ? 'bg-primary' : 'bg-hairline-strong'}`} />
                              <span className="truncate">{d.name}</span>
                            </span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-soft">{d.documents.length}</span>
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
            <p className="t-label mt-7 px-2 !text-[11px] text-muted-soft">Chats</p>
            <ul className="mt-2 space-y-0.5" data-testid="chat-list">
              {p.chats.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => p.onChat(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors ${c.id === p.activeChat && p.view === 'chat' ? 'bg-surface-elevated text-ink' : 'text-body hover:bg-surface-card'}`}
                  >
                    <span className="text-muted"><AgentIcon id={c.agent} size={14} /></span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.pending && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary animate-pulse-dot" />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="t-label mt-7 px-2 !text-[11px] text-muted-soft">Workspace</p>
        <ul className="mt-2 space-y-0.5">
          {([['audit', 'Audit trail'], ['model', 'Model']] as const).map(([v, label]) => (
            <li key={v}>
              <button
                onClick={() => p.onView(v)}
                aria-current={p.view === v ? 'page' : undefined}
                className={`w-full rounded-md px-2.5 py-2 text-left text-[13.5px] transition-colors ${p.view === v ? 'bg-surface-elevated text-ink' : 'text-body hover:bg-surface-card'}`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-hairline px-4 py-3.5" data-testid="user-card">
        <Avatar name={p.user?.name ?? '?'} size={34} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{p.user?.name ?? '…'}</p>
          <p className="truncate text-[12px] text-muted">{p.user?.title}</p>
        </div>
      </div>
    </aside>
  )
}
