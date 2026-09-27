import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type Agent, type AgentId, type Document, type Domain, type Health, type User } from './api'
import { AuditView } from './components/AuditView'
import { ChatView, type SampleLoad, type Turn } from './components/ChatView'
import { DocumentsDrawer } from './components/DocumentsDrawer'
import { Header } from './components/Header'
import { Intro } from './components/Intro'
import { ModelView } from './components/ModelView'
import { emptyRedTeam, type RedTeamState } from './components/RedTeamView'
import { Sidebar, type View } from './components/Sidebar'

const EASE = [0.25, 0.46, 0.45, 0.94] as const

type Conversation = { id: string; agent: AgentId; domain: string | null; language: string; turns: Turn[] }

const FALLBACK_AGENTS: Agent[] = [
  { id: 'expert', name: 'Domain Expert', tagline: 'Answers from your documents, with a citation for every claim.' },
  { id: 'code_review', name: 'Code Reviewer', tagline: 'Reviews pasted code against the standards you uploaded.' },
  { id: 'security', name: 'Security Agent', tagline: 'Runs a static scan, then reviews code or text for vulnerabilities and injection.' },
  { id: 'threat_model', name: 'Threat Modeler', tagline: 'Reads an architecture diagram and builds a STRIDE threat model.', reads_diagram: true },
  { id: 'compliance', name: 'Compliance Checker', tagline: 'Checks a design doc or config rule by rule against your policies.' },
  { id: 'red_team', name: 'Red Team', tagline: 'Attacks your own assistant with prompt injections and scores the defences.', kind: 'exercise' },
]

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return match
}

function seenIntro(): boolean {
  try { return sessionStorage.getItem('intro') === '1' } catch { return false }
}

export default function App() {
  const reduce = useReducedMotion()
  const wide = useMedia('(min-width: 1024px)')
  const [intro, setIntro] = useState(() => !seenIntro() && !navigator.webdriver)
  const [agents, setAgents] = useState<Agent[]>(FALLBACK_AGENTS)
  const [user, setUser] = useState<User | null>(null)
  const [defence, setDefence] = useState(true)
  const [defenceBusy, setDefenceBusy] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [documents, setDocuments] = useState<Document[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null)
  const [sampleLoad, setSampleLoad] = useState<SampleLoad | null>(null)
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => { try { return localStorage.getItem('answer-language') ?? 'auto' } catch { return 'auto' } })
  const [convos, setConvos] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selected, setSelected] = useState<AgentId>('expert')
  const [view, setView] = useState<View>('chat')
  const [docsOpen, setDocsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)

  const endIntro = useCallback(() => {
    setIntro(false)
    try { sessionStorage.setItem('intro', '1') } catch { /* private mode */ }
  }, [])

  useEffect(() => {
    Promise.all([api.users(), api.settings()])
      .then(([us, s]) => { setUser(us[0] ?? null); setDefence(s.injection_defence) })
      .catch((e) => setBootError(String(e.message ?? e)))
    api.agents().then(setAgents).catch(() => {})
  }, [])

  useEffect(() => {
    const poll = () => api.health().then((h) => { setHealth(h); setHealthError(false) }).catch(() => setHealthError(true))
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [])

  const loadDocuments = useCallback(() => {
    api.documents().then(setDocuments).catch(() => {})
    api.domains().then(setDomains).catch(() => {})
  }, [])
  useEffect(loadDocuments, [loadDocuments])

  const active = convos.find((c) => c.id === activeId) ?? null
  const agentId = active?.agent ?? selected
  const agent = agents.find((a) => a.id === agentId) ?? FALLBACK_AGENTS[0]
  const domainId = active ? active.domain : selectedDomain
  const domain = domains.find((d) => d.id === domainId) ?? null

  const patchTurn = (convoId: string, turnId: string, patch: Partial<Turn>) =>
    setConvos((cs) => cs.map((c) => (c.id !== convoId ? c : { ...c, turns: c.turns.map((t) => (t.id === turnId ? { ...t, ...patch } : t)) })))

  const patchRedTeam = (convoId: string, turnId: string, fn: (s: RedTeamState) => RedTeamState) =>
    setConvos((cs) => cs.map((c) => (c.id !== convoId ? c : { ...c, turns: c.turns.map((t) => (t.id === turnId && t.redteam ? { ...t, redteam: fn(t.redteam) } : t)) })))

  const runRedTeam = async (convoId: string, turn: Turn) => {
    if (!user) return
    try {
      await api.redTeam(user.id, turn.question, (e) => {
        if (e.step === 'plan') patchRedTeam(convoId, turn.id, (s) => ({ ...s, planning: false, attacks: e.attacks }))
        else if (e.step === 'attack') patchRedTeam(convoId, turn.id, (s) => ({ ...s, current: e.index }))
        else if (e.step === 'result') patchRedTeam(convoId, turn.id, (s) => ({ ...s, results: [...s.results, e] }))
        else if (e.step === 'summary') {
          patchRedTeam(convoId, turn.id, (s) => ({ ...s, summary: e, current: null }))
          patchTurn(convoId, turn.id, { status: 'done' })
        } else if (e.step === 'error') patchTurn(convoId, turn.id, { status: 'error', error: e.message })
      })
    } catch (e) {
      patchTurn(convoId, turn.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }

  const run = useCallback(async (convoId: string, agentOfConvo: AgentId, turn: Turn, convoDomain: string | null = null, convoLanguage = 'auto') => {
    if (!user) {
      patchTurn(convoId, turn.id, { status: 'error', error: 'still connecting to the server' })
      return
    }
    if (agentOfConvo === 'red_team') { await runRedTeam(convoId, turn); return }
    try {
      const response = await api.ask(user.id, turn.question, agentOfConvo, turn.image, agentOfConvo === 'expert' ? convoDomain ?? undefined : undefined, convoLanguage)
      patchTurn(convoId, turn.id, { status: 'done', response })
    } catch (e) {
      patchTurn(convoId, turn.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = (question: string, image?: string) => {
    const agentForTurn = active?.agent ?? selected
    const turn: Turn = {
      id: crypto.randomUUID(), question, status: 'pending', attempt: 0, image,
      ...(agentForTurn === 'red_team' ? { redteam: emptyRedTeam() } : {}),
    }
    if (active) {
      setConvos((cs) => cs.map((c) => (c.id === active.id ? { ...c, turns: [...c.turns, turn] } : c)))
      void run(active.id, active.agent, turn, active.domain, active.language)
    } else {
      const convo: Conversation = { id: crypto.randomUUID(), agent: selected, domain: selected === 'expert' ? selectedDomain : null, language: selectedLanguage, turns: [turn] }
      setConvos((cs) => [convo, ...cs])
      setActiveId(convo.id)
      void run(convo.id, convo.agent, turn, convo.domain, convo.language)
    }
  }

  const retry = (turn: Turn) => {
    if (!active) return
    const next = { ...turn, attempt: turn.attempt + 1, ...(turn.redteam ? { redteam: emptyRedTeam() } : {}) }
    patchTurn(active.id, turn.id, { status: 'pending', attempt: next.attempt, error: undefined, response: undefined, redteam: next.redteam })
    void run(active.id, active.agent, next, active.domain, active.language)
  }

  const pickAgent = (a: AgentId) => { setSelected(a); setActiveId(null); setView('chat'); setMenuOpen(false); if (a !== 'expert') setSelectedDomain(null) }
  const language = active ? active.language : selectedLanguage
  const changeLanguage = (code: string) => {
    if (active) setConvos((cs) => cs.map((c) => (c.id === active.id ? { ...c, language: code } : c)))
    else setSelectedLanguage(code)
    try { localStorage.setItem('answer-language', code) } catch { /* private mode */ }
  }
  const pickDomain = (id: string) => { setSelected('expert'); setSelectedDomain(id); setActiveId(null); setView('chat'); setMenuOpen(false) }
  const loadSamples = async (id: string) => {
    setSampleLoad({ domain: id, running: true, indexed: [], errors: [] })
    try {
      await api.loadSamples(id, (e) => {
        if (e.step === 'indexed') setSampleLoad((s) => s && { ...s, indexed: [...s.indexed, String(e.doc_id)] })
        if (e.step === 'error') setSampleLoad((s) => s && { ...s, errors: [...s.errors, `${e.file ?? ''}: ${e.message}`] })
        if (e.step === 'indexed') loadDocuments()
      })
    } catch (err) {
      setSampleLoad((s) => s && { ...s, errors: [...s.errors, err instanceof Error ? err.message : String(err)] })
    }
    setSampleLoad((s) => s && { ...s, running: false })
    loadDocuments()
  }
  const newChat = () => { setActiveId(null); setView('chat'); setMenuOpen(false) }
  const openChat = (id: string) => { setActiveId(id); setView('chat'); setMenuOpen(false) }

  const toggleDefence = async (on: boolean) => {
    setDefenceBusy(true)
    try { setDefence((await api.setDefence(on)).injection_defence) } catch { /* keep state */ } finally { setDefenceBusy(false) }
  }

  const chats = useMemo(() => convos.map((c) => ({
    id: c.id, agent: c.agent, title: c.turns[0]?.question.split('\n')[0].slice(0, 60) ?? 'New chat', pending: c.turns.some((t) => t.status === 'pending'),
  })), [convos])
  // Nothing can be sent until the signed-in user is known, or the request would have no identity.
  const busy = !user || !!active?.turns.some((t) => t.status === 'pending')

  if (bootError) {
    return (
      <main className="grid h-full place-items-center px-6">
        <div className="card max-w-md p-8">
          <p className="t-title-lg text-ink">The server is not reachable</p>
          <p className="t-body-md mt-3 text-body">Start the API on port 8010, then reload this page.</p>
          <p className="t-code mt-5 !text-[12px] text-rose">{bootError}</p>
        </div>
      </main>
    )
  }

  const sidebar = (
    <Sidebar
      agents={agents} agent={agentId} onAgent={pickAgent}
      domains={domains} domain={agentId === 'expert' ? domainId : null} onDomain={pickDomain}
      chats={chats} activeChat={activeId} onChat={openChat} onNewChat={newChat}
      view={view} onView={(v) => { setView(v); setMenuOpen(false) }}
      user={user}
    />
  )

  const titles: Record<View, [string, string]> = {
    chat: [
      active ? chats.find((c) => c.id === active.id)?.title ?? agent.name : agentId === 'expert' && domain ? `${domain.name} expert` : agent.name,
      agentId === 'expert' && domain ? `Domain Expert · ${domain.tagline}` : agent.tagline,
    ],
    audit: ['Audit trail', 'Every question, what was retrieved and cited, and which model answered'],
    model: ['Model', 'GLM-5.3-Flash, open weights'],
  }

  return (
    <div className="flex h-full">
      <AnimatePresence>{intro && !reduce && <Intro onDone={endIntro} />}</AnimatePresence>

      {wide && sidebar}
      <AnimatePresence>
        {!wide && menuOpen && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.div className="fixed inset-y-0 left-0 z-50 lg:hidden" initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.3, ease: EASE }}>{sidebar}</motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          title={titles[view][0]} subtitle={titles[view][1]}
          defence={defence} defenceBusy={defenceBusy} onDefence={toggleDefence}
          health={health} healthError={healthError}
          docCount={documents.length} onDocuments={() => setDocsOpen(true)}
          onMenu={() => setMenuOpen(true)}
        />
        <main className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view === 'chat' ? `chat-${activeId ?? `new-${agentId}-${domainId ?? ''}`}` : view}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: 0.3, ease: EASE } }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
            >
              {view === 'chat' && (
                <ChatView agent={agent} turns={active?.turns ?? []} docCount={documents.length} busy={busy}
                  onAsk={ask} onRetry={retry} onOpenDocuments={() => setDocsOpen(true)}
                  domains={domains} domain={domain} onPickDomain={pickDomain} onLoadSamples={loadSamples} sampleLoad={sampleLoad}
                  language={language} onLanguage={changeLanguage} />
              )}
              {view === 'audit' && <AuditView />}
              {view === 'model' && <ModelView />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <DocumentsDrawer open={docsOpen} onClose={() => setDocsOpen(false)} documents={documents} onChanged={loadDocuments}
        domains={domains} defaultDomain={agentId === 'expert' ? domainId : null} />
    </div>
  )
}
