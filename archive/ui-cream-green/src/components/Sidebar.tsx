import { AnimatePresence, motion } from 'motion/react'
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
    <aside className="relative flex h-full w-[280px] shrink-0 flex-col overflow-hidden bg-house text-white" aria-label="Sidebar">
      <svg className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 text-uplift/60 animate-spin-slow" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 8" />
        <circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="relative flex h-[72px] items-center gap-3 px-5">
        <Mark size={30} className="text-primary" />
        <span className="leading-tight">
          <span className="block whitespace-nowrap text-[16px] font-semibold tracking-[-0.16px] text-white">Global AI Community</span>
          <span className="block text-[11.5px] text-white/60">Domain-specialist RAG</span>
        </span>
      </div>

      <div className="relative px-4">
        <button onClick={p.onNewChat} className="btn btn-inverse w-full gap-2.5" data-testid="new-chat">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" /></svg>
          New chat
        </button>
      </div>

      <nav className="relative mt-6 min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-color:rgba(255,255,255,0.2)_transparent]" aria-label="Agents and chats">
        <p className="t-label px-2 !text-[11px] text-white/50">Agents</p>
        <ul className="mt-2 space-y-0.5">
          {p.agents.map((a) => {
            const on = p.view === 'chat' && a.id === p.agent
            return (
              <li key={a.id}>
                <button
                  onClick={() => p.onAgent(a.id)}
                  aria-pressed={on}
                  className={`relative flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-left transition-colors active:scale-[0.98] ${on ? 'bg-white/10' : 'hover:bg-white/5'}`}
                  data-testid={`agent-${a.id}`}
                >
                  {on && <motion.span layoutId="agent-marker" className="absolute inset-0 rounded-[12px] ring-1 ring-white/15" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors ${on ? 'bg-primary text-white' : 'bg-white/8 text-white/80'}`}>
                    <AgentIcon id={a.id} size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className={`t-title-sm block !text-[14px] ${on ? 'text-white' : 'text-white/85'}`}>{a.name}</span>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.span className="block overflow-hidden text-[12px] leading-snug text-white/60" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                          <span className="block pt-0.5">{a.tagline}</span>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
                {a.id === 'expert' && p.domains.length > 0 && (
                  <ul className="mb-1 ml-[22px] mt-1 space-y-0.5 border-l border-white/15 pl-2.5" aria-label="Domains" data-testid="domain-list">
                    {p.domains.map((d) => {
                      const dOn = on && d.id === p.domain
                      return (
                        <li key={d.id}>
                          <button
                            onClick={() => p.onDomain(d.id)}
                            aria-pressed={dOn}
                            className={`flex w-full items-center justify-between gap-2 rounded-full px-3 py-1.5 text-left text-[13px] transition-colors ${dOn ? 'bg-white text-house font-semibold' : 'text-white/75 hover:bg-white/5 hover:text-white'}`}
                            data-testid={`domain-${d.id}`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dOn ? 'bg-primary' : 'bg-white/25'}`} />
                              <span className="truncate">{d.name}</span>
                            </span>
                            <span className={`shrink-0 font-mono text-[11px] ${dOn ? 'text-house/60' : 'text-white/40'}`}>{d.documents.length}</span>
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
            <p className="t-label mt-7 px-2 !text-[11px] text-white/50">Chats</p>
            <ul className="mt-2 space-y-0.5" data-testid="chat-list">
              {p.chats.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => p.onChat(c.id)}
                    className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13.5px] transition-colors ${c.id === p.activeChat && p.view === 'chat' ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/5'}`}
                  >
                    <span className="text-mint/80"><AgentIcon id={c.agent} size={14} /></span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.pending && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint animate-pulse-dot" />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="t-label mt-7 px-2 !text-[11px] text-white/50">Workspace</p>
        <ul className="mt-2 space-y-0.5">
          {([['audit', 'Audit trail'], ['model', 'Model']] as const).map(([v, label]) => (
            <li key={v}>
              <button
                onClick={() => p.onView(v)}
                aria-current={p.view === v ? 'page' : undefined}
                className={`w-full rounded-full px-3 py-2 text-left text-[13.5px] transition-colors ${p.view === v ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/5'}`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="relative m-3 flex items-center gap-3 rounded-[12px] bg-white/8 px-3 py-3" data-testid="user-card">
        <Avatar name={p.user?.name ?? '?'} size={34} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-white">{p.user?.name ?? '…'}</p>
          <p className="truncate text-[12px] text-white/60">{p.user?.title}</p>
        </div>
      </div>
    </aside>
  )
}
