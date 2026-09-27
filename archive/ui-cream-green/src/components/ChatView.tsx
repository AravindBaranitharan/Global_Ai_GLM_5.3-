import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Agent, AskResponse, Check, Domain, Source } from '../api'
import { flagLabel, formatMs } from '../lib/answer'
import { SUGGESTIONS } from '../lib/suggestions'
import { RedTeamView, type RedTeamState } from './RedTeamView'
import { RichText } from './RichText'
import { AgentIcon, DocIcon, Lock } from './ui'
import { LANGUAGES, langOf, nativeName } from '../lib/lang'

export type Turn = {
  id: string
  question: string
  status: 'pending' | 'done' | 'error'
  attempt: number
  response?: AskResponse
  error?: string
  image?: string              // data URL of an attached diagram
  redteam?: RedTeamState      // set for Red Team exercises
}

export type SampleLoad = { domain: string; running: boolean; indexed: string[]; errors: string[] }

type Props = {
  agent: Agent
  turns: Turn[]
  docCount: number
  busy: boolean
  domains: Domain[]
  domain: Domain | null
  onPickDomain: (id: string) => void
  onLoadSamples: (id: string) => void
  sampleLoad: SampleLoad | null
  language: string
  onLanguage: (code: string) => void
  onAsk: (q: string, image?: string) => void
  onRetry: (t: Turn) => void
  onOpenDocuments: () => void
}

const EASE = [0.25, 0.46, 0.45, 0.94] as const

export function ChatView({ agent, turns, docCount, busy, onAsk, onRetry, onOpenDocuments, domains, domain, onPickDomain, onLoadSamples, sampleLoad, language, onLanguage }: Props) {
  const lang = { language, onLanguage }
  const scroller = useRef<HTMLDivElement>(null)
  const last = turns[turns.length - 1]
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turns.length, last?.status])

  if (turns.length === 0) {
    if (agent.id === 'expert') {
      return domain
        ? <DomainHero agent={agent} domain={domain} busy={busy} onAsk={onAsk} onLoadSamples={onLoadSamples} sampleLoad={sampleLoad} onOpenDocuments={onOpenDocuments} lang={lang} />
        : <DomainPicker domains={domains} onPick={onPickDomain} />
    }
    return <Hero agent={agent} docCount={docCount} busy={busy} onAsk={onAsk} onOpenDocuments={onOpenDocuments} lang={lang} />
  }
  return (
    <section aria-label="Conversation" className="flex h-full min-h-0 flex-col">
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 md:px-10">
        <ol className="mx-auto max-w-[820px] space-y-10 pb-10 pt-8">
          {turns.map((t) => <TurnView key={t.id} turn={t} agent={agent} onRetry={onRetry} />)}
        </ol>
      </div>
      <div className="bg-canvas px-5 pb-5 pt-2 md:px-10">
        <div className="mx-auto max-w-[820px]">
          <Composer agent={agent} busy={busy} onAsk={onAsk} {...lang} />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------------- hero */

const HEADLINES: Record<string, string> = {
  expert: 'Ask your documents anything.',
  code_review: 'Paste code. Get a review against your standards.',
  security: 'Find the vulnerability before an attacker does.',
  threat_model: 'Drop in a diagram. Get a threat model.',
  compliance: 'Check a design against every rule.',
  red_team: 'Attack your own assistant before someone else does.',
}

const ART_CHIPS: Record<string, string[]> = {
  expert: ['[S1] page 4', 'bge-m3 hybrid', 'GLM-5.3-Flash'],
  code_review: ['SEC-10', 'line 42', 'standards'],
  security: ['shell=True', 'High', 'static scan'],
  threat_model: ['Spoofing', 'Tampering', 'STRIDE'],
  compliance: ['Pass', 'Fail', 'DP-04'],
  red_team: ['injection', 'blocked', 'defence on'],
}

type LangProps = { language: string; onLanguage: (code: string) => void }

/** Display headline that rises in word by word. */
function Headline({ text, className = '' }: { text: string; className?: string }) {
  return (
    <h1 className={`t-display-lg text-brand ${className}`}>
      {text.split(' ').map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span className="inline-block" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 0.65, delay: 0.05 + i * 0.05, ease: EASE }}>{w}</motion.span>
          </span>{' '}
        </Fragment>
      ))}
    </h1>
  )
}

/** A stack of source pages with citation chips drifting around it. */
function HeroArt({ agentId }: { agentId: string }) {
  const chips = ART_CHIPS[agentId] ?? ART_CHIPS.expert
  const pages = [
    { r: -9, x: -46, y: 18, d: 0.15 },
    { r: 6, x: 40, y: 8, d: 0.25 },
    { r: -1.5, x: 0, y: 0, d: 0.35 },
  ]
  const chipPos = ['left-[2%] top-[14%]', 'right-[0%] top-[40%]', 'left-[10%] bottom-[10%]']
  return (
    <div className="relative mx-auto hidden h-[420px] w-full max-w-[440px] lg:block" aria-hidden>
      <motion.div className="absolute left-1/2 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint"
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.9, ease: EASE }} />
      <svg className="animate-spin-slow absolute left-1/2 top-1/2 h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 text-primary/30" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="98" fill="none" stroke="currentColor" strokeWidth="0.6" strokeDasharray="1.5 5" />
      </svg>
      <motion.div className="absolute right-[12%] top-[8%] h-16 w-16 rounded-full bg-house" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.6 }}>
        <span className="grid h-full w-full place-items-center text-white"><AgentIcon id={agentId as Agent['id']} size={26} /></span>
      </motion.div>
      {pages.map((p, i) => (
        <motion.div key={i} className="absolute left-1/2 top-1/2" style={{ marginLeft: -100 + p.x, marginTop: -128 + p.y }}
          initial={{ opacity: 0, y: 40, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: p.r }} transition={{ duration: 0.8, delay: p.d, ease: EASE }}>
          <div className="animate-float card h-[256px] w-[200px] p-5" style={{ animationDelay: `${i * -2}s` }}>
            <div className="h-2.5 w-24 rounded-full bg-brand/80" />
            <div className="mt-2 h-1.5 w-16 rounded-full bg-black/10" />
            <div className="mt-5 space-y-2">
              {[92, 78, 88, 60].map((w, j) => <div key={j} className="h-1.5 rounded-full bg-black/8" style={{ width: `${w}%` }} />)}
            </div>
            {i === 2 && (
              <motion.div className="mt-3 flex items-center gap-1.5 rounded-md bg-mint/70 p-1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
                <div className="h-1.5 flex-1 rounded-full bg-primary/40" />
                <span className="rounded-full bg-primary px-1.5 font-mono text-[9px] font-semibold text-white">S1</span>
              </motion.div>
            )}
            <div className="mt-3 space-y-2">
              {[84, 70, 90].map((w, j) => <div key={j} className="h-1.5 rounded-full bg-black/8" style={{ width: `${w}%` }} />)}
            </div>
          </div>
        </motion.div>
      ))}
      {chips.map((c, i) => (
        <motion.span key={c} className={`absolute ${chipPos[i]} animate-float rounded-full bg-white px-3.5 py-1.5 font-mono text-[12px] font-semibold text-primary shadow-[var(--shadow-lift)]`}
          style={{ animationDelay: `${-1.3 * i}s`, animationDuration: `${5 + i}s` }}
          initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.9 + i * 0.12 }}>
          {c}
        </motion.span>
      ))}
    </div>
  )
}

function AgentChip({ id, name, sub }: { id: Agent['id']; name: string; sub: string }) {
  return (
    <motion.div className="inline-flex max-w-full items-center gap-3 rounded-full bg-white py-1.5 pl-1.5 pr-5 shadow-[var(--shadow-card)]"
      initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: EASE }}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white"><AgentIcon id={id} size={18} /></span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-ink">{name}</span>
        <span className="block truncate text-[12px] text-muted">{sub}</span>
      </span>
    </motion.div>
  )
}

/** Deep-green band that holds the suggested prompts. */
function Band({ title, children }: { title: string; children: ReactNode }) {
  return (
    <motion.section className="relative overflow-hidden bg-house px-5 py-14 text-white md:px-12"
      initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease: EASE }}>
      <svg className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 text-uplift" viewBox="0 0 200 200" aria-hidden>
        <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <div className="relative mx-auto max-w-[1120px]">
        <p className="t-label text-mint">Start here</p>
        <h2 className="t-title-lg mt-1 text-white">{title}</h2>
        {children}
      </div>
    </motion.section>
  )
}

function SuggestionCard({ i, label, text, badge, onClick, disabled }: { i: number; label?: string; text: string; badge?: string; onClick: () => void; disabled: boolean }) {
  return (
    <motion.li initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.06, duration: 0.45, ease: EASE }}>
      <motion.button onClick={onClick} disabled={disabled} whileHover={disabled ? undefined : { y: -3 }} whileTap={disabled ? undefined : { scale: 0.97 }}
        className="group flex h-full w-full items-start justify-between gap-4 rounded-[12px] bg-white/[0.07] p-5 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.12] disabled:opacity-40">
        <span className="min-w-0">
          {(label || badge) && (
            <span className="mb-2 flex items-center gap-2">
              {label && <span className="t-label !text-[10.5px] text-mint">{label}</span>}
              {badge && <span className="font-mono text-[11px] text-white/50">{badge}</span>}
            </span>
          )}
          <span lang={langOf(text)} className="block text-[15px] font-medium leading-snug text-white">{text}</span>
        </span>
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-primary transition-transform group-hover:translate-x-1">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M1 6h9M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
        </span>
      </motion.button>
    </motion.li>
  )
}

function Frap({ onClick }: { onClick: () => void }) {
  return (
    <motion.button className="frap fixed bottom-6 right-6 z-30" onClick={onClick} aria-label="Upload documents" title="Upload documents"
      initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.8 }}
      whileHover={{ scale: 1.06 }} data-testid="frap">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 16V4M7 9l5-5 5 5M4 20h16" /></svg>
    </motion.button>
  )
}

function Hero({ agent, docCount, busy, onAsk, onOpenDocuments, lang }: { agent: Agent; docCount: number; busy: boolean; onAsk: (q: string, image?: string) => void; onOpenDocuments: () => void; lang: LangProps }) {
  return (
    <div className="h-full overflow-y-auto" data-testid="hero">
      <section className="px-5 pb-14 pt-10 md:px-12 md:pt-14">
        <div key={agent.id} className="mx-auto grid max-w-[1120px] items-center gap-10 lg:grid-cols-[7fr_5fr]">
          <div className="min-w-0">
            <AgentChip id={agent.id} name={agent.name} sub={agent.tagline} />
            <Headline text={HEADLINES[agent.id]} className="mt-8 max-w-[14em]" />

            {docCount === 0 ? (
              <motion.div className="card mt-8 flex flex-wrap items-center gap-5 p-6" data-testid="no-documents" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease: EASE }}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-mint text-primary"><DocIcon size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="t-title-sm text-ink">Upload a domain document to begin</p>
                  <p className="t-body-sm text-muted">Standards, API specs, runbooks or policies as PDF, scan or image. Answers come only from what you upload.</p>
                </div>
                <button className="btn btn-primary" onClick={onOpenDocuments}>Upload documents</button>
              </motion.div>
            ) : (
              <motion.p className="t-body-lg mt-5 max-w-[34em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                Grounded in <button className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary" onClick={onOpenDocuments}>{docCount} document{docCount === 1 ? '' : 's'}</button>. Every claim links to its source, and nothing leaves the documents you uploaded.
              </motion.p>
            )}

            <motion.div className="mt-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease: EASE }}>
              <Composer agent={agent} busy={busy} onAsk={onAsk} big {...lang} />
            </motion.div>
          </div>
          <HeroArt agentId={agent.id} />
        </div>
      </section>

      <Band title="Try one of these">
        <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Suggested prompts">
          {SUGGESTIONS[agent.id].map((s, i) => (
            <SuggestionCard key={s.label} i={i} label={s.label} badge={/```/.test(s.prompt) ? 'python' : undefined}
              text={s.prompt.split('\n')[0]} onClick={() => onAsk(s.prompt)} disabled={busy || docCount === 0} />
          ))}
        </ul>
      </Band>
      <Frap onClick={onOpenDocuments} />
    </div>
  )
}

/* ------------------------------------------------------------- domain expert */

function DomainPicker({ domains, onPick }: { domains: Domain[]; onPick: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto" data-testid="domain-picker">
      <section className="px-5 pb-12 pt-10 md:px-12 md:pt-14">
        <div className="mx-auto max-w-[1120px]">
          <AgentChip id="expert" name="Domain Expert" sub="Pick a domain. Each expert answers from its own knowledge base plus GLM's expertise." />
          <Headline text="Which expert do you need?" className="mt-8" />
          <motion.p className="t-body-lg mt-4 max-w-[36em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            Every domain has its own shelf of foundation documents. Pick one, load its library, and ask anything from basics to deep design questions.
          </motion.p>
        </div>
      </section>
      <section className="px-5 pb-16 md:px-12">
        <ul className="mx-auto grid max-w-[1120px] gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((d, i) => (
            <motion.li key={d.id} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + 0.07 * i, duration: 0.5, ease: EASE }}>
              <motion.button onClick={() => onPick(d.id)} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
                className="card group relative flex h-full w-full flex-col items-start overflow-hidden p-6 text-left transition-shadow hover:shadow-[var(--shadow-lift)]" data-testid={`pick-${d.id}`}>
                <span className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-mint transition-transform duration-500 group-hover:scale-[1.6]" aria-hidden />
                <span className="relative grid h-11 w-11 place-items-center rounded-full bg-house font-serif text-[18px] text-white">{d.name[0]}</span>
                <span className="relative mt-5 text-[19px] font-semibold tracking-[-0.16px] text-brand">{d.name}</span>
                <span className="relative mt-1.5 flex-1 text-[14px] text-muted">{d.tagline}</span>
                <span className="relative mt-5 flex w-full items-center justify-between">
                  <span className={`badge ${d.documents.length ? '!bg-mint !text-house' : '!bg-canvas !text-muted'}`}>{d.documents.length ? `${d.documents.length} docs` : 'no docs yet'}</span>
                  <span className="text-[14px] font-semibold text-primary transition-transform group-hover:translate-x-1">Open →</span>
                </span>
              </motion.button>
            </motion.li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function DomainHero({ agent, domain, busy, onAsk, onLoadSamples, sampleLoad, onOpenDocuments, lang }: {
  agent: Agent; domain: Domain; busy: boolean; onAsk: (q: string, image?: string) => void
  onLoadSamples: (id: string) => void; sampleLoad: SampleLoad | null; onOpenDocuments: () => void; lang: LangProps
}) {
  const loading = sampleLoad?.domain === domain.id && sampleLoad.running
  const missing = domain.samples.length > 0 && domain.documents.length < domain.samples.length
  return (
    <div className="h-full overflow-y-auto" data-testid="domain-hero">
      <section className="px-5 pb-14 pt-10 md:px-12 md:pt-14">
        <div key={domain.id} className="mx-auto grid max-w-[1120px] items-start gap-10 lg:grid-cols-[7fr_5fr]">
          <div className="min-w-0">
            <AgentChip id="expert" name={`${domain.name} expert`} sub={domain.tagline} />
            <Headline text={`Ask the ${domain.name} expert.`} className="mt-8 max-w-[14em]" />
            <motion.p className="t-body-lg mt-4 max-w-[34em] text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              Answers draw on this domain's documents, with citations, and on GLM-5.3-Flash's own expertise where the documents stop. It never refuses just because a topic is not in the documents.
            </motion.p>
            <motion.div className="mt-8" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5, ease: EASE }}>
              <Composer agent={agent} busy={busy} onAsk={onAsk} big {...lang} />
            </motion.div>
          </div>

          <motion.div className="overflow-hidden rounded-[12px] bg-white shadow-[var(--shadow-card)]" data-testid="domain-docs"
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.6, ease: EASE }}>
            <div className="bg-house px-6 py-5 text-white">
              <p className="t-label text-mint">Knowledge base</p>
              <p className="mt-1 font-serif text-[40px] leading-none">{domain.documents.length}<span className="ml-2 font-sans text-[15px] text-white/70">document{domain.documents.length === 1 ? '' : 's'}</span></p>
              <div className="mt-4 flex flex-wrap gap-2">
                {missing && (
                  <button className="btn btn-inverse btn-sm" onClick={() => onLoadSamples(domain.id)} disabled={loading} data-testid="load-samples">
                    {loading ? 'Indexing…' : `Load sample documents (${domain.samples.length})`}
                  </button>
                )}
                <button className="btn btn-ghost-light btn-sm" onClick={onOpenDocuments}>Upload your own</button>
              </div>
            </div>
            <div className="px-6 py-5">
              {domain.documents.length > 0 ? (
                <ul className="space-y-2.5">
                  {domain.documents.map((t, i) => (
                    <motion.li key={t} className="flex items-center gap-3 text-[14px] text-ink" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint text-primary"><DocIcon size={14} /></span>
                      <span className="min-w-0 truncate">{t}</span>
                    </motion.li>
                  ))}
                </ul>
              ) : (
                <p className="t-body-sm text-muted">No documents yet. Load the samples or upload your own; the expert still answers from GLM's knowledge meanwhile.</p>
              )}
              {sampleLoad?.domain === domain.id && (sampleLoad.indexed.length > 0 || sampleLoad.errors.length > 0) && (
                <p className="mt-4 font-mono text-[12px]" data-testid="sample-progress">
                  <span className="text-primary">{sampleLoad.indexed.length} indexed</span>
                  {sampleLoad.running && <span className="text-muted"> · working<span className="animate-blink">▌</span></span>}
                  {sampleLoad.errors.map((e) => <span key={e} className="block text-rose">{e}</span>)}
                </p>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <Band title={`Questions for the ${domain.name} expert`}>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-label="Suggested prompts">
          {domain.suggestions.map((q, i) => <SuggestionCard key={q} i={i} text={q} onClick={() => onAsk(q)} disabled={busy} />)}
        </ul>
      </Band>
      <Frap onClick={onOpenDocuments} />
    </div>
  )
}

/* ------------------------------------------------------------------- composer */

const PLACEHOLDER: Record<string, string> = {
  expert: 'Ask anything in this domain, from basics to deep design questions',
  code_review: 'Paste code to review, or ask about the standards',
  security: 'Paste code, config or text to check for vulnerabilities',
  threat_model: 'Attach an architecture diagram, or describe the system',
  compliance: 'Paste a design doc, config or process description to check',
  red_team: 'Optional: what should the attacks focus on?',
}

const MAX_IMAGE = 8 * 1024 * 1024

function Composer({ agent, busy, onAsk, big = false, language, onLanguage }: { agent: Agent; busy: boolean; onAsk: (q: string, image?: string) => void; big?: boolean } & LangProps) {
  const [q, setQ] = useState('')
  const [image, setImage] = useState<{ url: string; name: string } | null>(null)
  const [imgError, setImgError] = useState<string | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLTextAreaElement>(null)
  const exercise = agent.id === 'red_team'
  const attach = (f: File | undefined) => {
    setImgError(null)
    if (!f) return
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { setImgError('Use a PNG, JPG or WEBP image.'); return }
    if (f.size > MAX_IMAGE) { setImgError('Images must be under 8 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => setImage({ url: String(reader.result), name: f.name })
    reader.readAsDataURL(f)
  }
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [q])

  const send = () => {
    const v = q.trim() || (image ? 'Threat model this system.' : exercise ? 'Run a full red-team exercise against the assistant.' : '')
    if (!v || busy) return
    onAsk(v, image?.url)
    setQ('')
    setImage(null)
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() }
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); send() }} className="card flex flex-col gap-2 p-2.5 transition-shadow duration-300 focus-within:shadow-[0_0_0_2px_var(--color-primary),var(--shadow-lift)]" data-testid="composer"
      onDragOver={(e) => agent.reads_diagram && e.preventDefault()}
      onDrop={(e) => { if (agent.reads_diagram) { e.preventDefault(); attach(e.dataTransfer.files[0]) } }}>
      {image && (
        <div className="flex items-center gap-3 rounded-md bg-surface-elevated p-2" data-testid="attached-image">
          <img src={image.url} alt="" className="h-14 w-20 rounded-xs bg-white object-contain ring-1 ring-hairline" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-body">{image.name}</span>
          <button type="button" className="btn btn-secondary btn-sm !h-7 !px-2.5 !text-[12px]" onClick={() => setImage(null)}>Remove</button>
        </div>
      )}
      <label className="block">
        <span className="sr-only">Message {agent.name}</span>
        <textarea
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          rows={big ? 3 : 1}
          placeholder={PLACEHOLDER[agent.id] + (language === 'auto' ? '' : ` · answer in ${nativeName(language)}`)}
          lang={langOf(q)}
          spellCheck={agent.id === 'expert'}
          className={`block w-full resize-none bg-transparent px-3 py-2.5 text-ink outline-none placeholder:text-muted ${/\n/.test(q) ? 'font-mono text-[13.5px] leading-relaxed' : 'text-[16px]'}`}
          data-testid="question-input"
        />
      </label>
      <div className="flex items-center justify-between gap-3 px-1">
        <span className="flex items-center gap-2 text-[12px] text-muted">
          <span className="badge !h-6 !gap-1.5 !bg-mint !text-house"><AgentIcon id={agent.id} size={13} />{agent.name}</span>
          <label className="relative">
            <span className="sr-only">Answer language</span>
            <select value={language} onChange={(e) => onLanguage(e.target.value)} disabled={busy}
              className="h-6 cursor-pointer appearance-none rounded-full bg-canvas pl-2.5 pr-6 text-[12px] font-semibold text-ink ring-1 ring-hairline-strong outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="language-select" aria-label="Answer language">
              <option value="auto">Auto language</option>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}{l.native !== l.name ? ` · ${l.name}` : ''}</option>)}
            </select>
            <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden className="pointer-events-none absolute right-2 top-[9px] text-muted"><path d="M2 4l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.6" /></svg>
          </label>
          {agent.reads_diagram && (
            <>
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" data-testid="diagram-input" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" className="btn btn-secondary btn-sm !h-7 !gap-1.5 !px-2.5 !text-[12px]" onClick={() => file.current?.click()} disabled={busy}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M21 11.5l-8.5 8.5a5.5 5.5 0 01-7.8-7.8l9-9a3.7 3.7 0 015.2 5.2l-9 9a1.8 1.8 0 01-2.6-2.6l8.3-8.3" /></svg>
                Attach diagram
              </button>
            </>
          )}
          {imgError && <span className="text-rose">{imgError}</span>}
          <span className="hidden whitespace-nowrap 2xl:inline">Enter to send · Shift+Enter for a new line</span>
        </span>
        <button type="submit" className="btn btn-primary btn-sm !h-10 !px-5" disabled={busy || (!q.trim() && !image && !exercise)}>
          {exercise ? 'Run exercise' : 'Send'}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M1 6h9M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" /></svg>
        </button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------------------- turns */

function UserMessage({ text, image }: { text: string; image?: string }) {
  const hasCode = /```/.test(text) || text.split('\n').length > 6
  return (
    <div className="flex justify-end">
      <div className={`rounded-[20px] rounded-tr-[6px] px-5 py-3.5 ${hasCode || image ? 'w-full max-w-[92%] bg-white text-ink shadow-[var(--shadow-card)]' : 'max-w-[80%] bg-house text-white'}`}>
        {image && <img src={image} alt="Attached diagram" className="mb-3 max-h-80 w-full rounded-md bg-white object-contain" data-testid="message-image" />}
        {hasCode ? (
          <div className="t-body-md space-y-2"><RichText text={text} /></div>
        ) : (
          <p lang={langOf(text)} className="t-body-md whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </div>
  )
}

function TurnView({ turn, agent, onRetry }: { turn: Turn; agent: Agent; onRetry: (t: Turn) => void }) {
  const r = turn.response
  const shown = r ? agentOf(r.agent, agent) : agent
  return (
    <motion.li initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} data-testid="turn">
      <UserMessage text={turn.question} image={turn.image} />
      <div className="mt-5 flex gap-3">
        <motion.span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-white shadow-[var(--shadow-card)]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}><AgentIcon id={shown.id} size={16} /></motion.span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px]">
            <span className="font-semibold text-brand">{shown.name}</span>
            <span className="text-muted">GLM-5.3-Flash{r && !r.error ? ` · ${r.endpoint_label}` : ''}</span>
            {r && !r.error && r.lang !== 'en' && <span className="badge !h-5 !bg-mint !px-2 !text-[11px] !text-house" data-testid="answer-language">{nativeName(r.lang)}</span>}
          </p>
          {turn.redteam ? (
            <>
              <RedTeamView state={turn.redteam} />
              {turn.status === 'error' && <div className="card mt-3 ring-1 ring-rose/30 p-4"><p className="t-body-md text-body">The exercise stopped: {turn.error}</p></div>}
            </>
          ) : (
          <AnimatePresence initial={false}>
            {turn.status === 'pending' && <Pipeline key={`p-${turn.attempt}`} agent={shown} />}
            {turn.status === 'error' && (
              <motion.div key={`e-${turn.attempt}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="card mt-3 overflow-hidden ring-1 ring-rose/30 p-4">
                <p className="t-body-md text-body">The server did not respond: {turn.error}</p>
                <button className="btn btn-secondary btn-sm mt-3" onClick={() => onRetry(turn)}>Ask again</button>
              </motion.div>
            )}
            {turn.status === 'done' && r && (
              <motion.div key={`a-${turn.attempt}`} className="mt-2" initial="hidden" animate="shown" exit={{ opacity: 0, height: 0 }} variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
                <Answer turn={turn} onRetry={onRetry} />
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </div>
      </div>
    </motion.li>
  )
}

const AGENT_FALLBACK: Record<string, Agent> = {
  expert: { id: 'expert', name: 'Domain Expert', tagline: '' },
  code_review: { id: 'code_review', name: 'Code Reviewer', tagline: '' },
  security: { id: 'security', name: 'Security Agent', tagline: '' },
  threat_model: { id: 'threat_model', name: 'Threat Modeler', tagline: '' },
  compliance: { id: 'compliance', name: 'Compliance Checker', tagline: '' },
  red_team: { id: 'red_team', name: 'Red Team', tagline: '' },
}
const agentOf = (id: string, current: Agent) => (id === current.id ? current : AGENT_FALLBACK[id] ?? current)

function Reveal({ children }: { children: ReactNode }) {
  return <motion.div variants={{ hidden: { opacity: 0, y: 6 }, shown: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } } }}>{children}</motion.div>
}

function Answer({ turn, onRetry }: { turn: Turn; onRetry: (t: Turn) => void }) {
  const r = turn.response!
  const [open, setOpen] = useState<string | null>(null)
  const byLabel = new Map(r.citations.map((c) => [c.label, c]))

  if (r.error) {
    return (
      <Reveal>
        <div className="card ring-1 ring-rose/30 p-4">
          <p className="t-body-md text-body">The model endpoint did not answer. Nothing was shown from the documents.</p>
          <button className="btn btn-secondary btn-sm mt-3" onClick={() => onRetry(turn)}>Ask again</button>
        </div>
      </Reveal>
    )
  }

  const cite = (label: string, key: number) => {
    const src = byLabel.get(label)
    if (!src) return null
    const on = open === label
    return (
      <button
        key={key}
        onClick={() => setOpen(on ? null : label)}
        aria-label={`Source ${label}: ${src.title}, page ${src.page}`}
        aria-pressed={on}
        className={`mx-0.5 inline-flex h-[20px] -translate-y-[1px] items-center rounded-full px-1.5 align-middle font-mono text-[10.5px] font-semibold transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-mint text-house hover:bg-primary hover:text-white'}`}
      >
        {label}
      </button>
    )
  }

  return (
    <>
      {r.checks.length > 0 && <Reveal><ScanCard checks={r.checks} /></Reveal>}
      {r.diagram && <Reveal><DiagramCard text={r.diagram} /></Reveal>}
      {r.refused ? (
        <Reveal>
          <div className="card mt-2 flex items-start gap-3 p-4" data-testid="refusal">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-elevated text-muted"><Lock size={15} /></span>
            <div>
              <p lang={r.lang} className="t-body-md text-ink">{r.answer}</p>
              <p className="t-caption mt-1 text-muted">No uploaded passage supports an answer, so the model was not allowed to guess.</p>
            </div>
          </div>
        </Reveal>
      ) : (
        <div lang={r.lang} className="t-body-md space-y-3 text-ink" data-testid="answer">
          <RichText text={r.answer} cite={cite} wrap={(b, i) => <Reveal key={i}>{b}</Reveal>} />
        </div>
      )}

      {r.citations.length > 0 && (
        <Reveal><Sources sources={r.citations} open={open} onToggle={(l) => setOpen(open === l ? null : l)} /></Reveal>
      )}

      {r.flags.length > 0 && (
        <Reveal>
          <ul className="mt-4 space-y-2" data-testid="flags">
            {r.flags.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                <span className="text-[13px] font-semibold text-warning">{flagLabel(f.type)}</span>
                <span className="break-all font-mono text-[12px] text-muted">{f.value}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      <Reveal><RunLog r={r} /></Reveal>
    </>
  )
}

function Sources({ sources, open, onToggle }: { sources: Source[]; open: string | null; onToggle: (label: string) => void }) {
  return (
    <div className="mt-5" data-testid="sources">
      <p className="t-label !text-[11px] text-muted">Sources</p>
      <ul className="mt-2 space-y-2">
        {sources.map((s) => {
          const on = open === s.label
          return (
            <li key={s.chunk_id} className={`card overflow-hidden transition-colors ${on ? 'ring-2 ring-primary' : ''}`}>
              <button onClick={() => onToggle(s.label!)} aria-expanded={on} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                <span className={`rounded-full px-1.5 font-mono text-[10.5px] font-semibold ${on ? 'bg-primary text-white' : 'bg-mint text-house'}`}>{s.label}</span>
                <span className="text-muted"><DocIcon size={14} /></span>
                <span lang={langOf(s.title)} className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{s.title}</span>
                <span className="shrink-0 text-[12px] text-muted">page {s.page}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`shrink-0 text-muted transition-transform ${on ? 'rotate-180' : ''}`}><path d="M2 4l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div lang={langOf(s.text)} className="t-body-sm space-y-2 border-t border-hairline px-4 py-3 text-body" data-testid="source-text">
                      <RichText text={s.text.replace(/([^|\n])\n(?=[^|\n])/g, '$1\n\n')} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function DiagramCard({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card mb-4 mt-2 overflow-hidden" data-testid="diagram-reading">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-[12px] text-muted hover:text-ink">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}><path d="M3.5 2l3 3-3 3" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
        vision · what GLM-5.3-Flash read from the diagram
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.pre initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="t-code overflow-hidden whitespace-pre-wrap border-t border-hairline px-4 py-3 text-body">{text}</motion.pre>
        )}
      </AnimatePresence>
    </div>
  )
}

const SEV: Record<string, string> = { High: 'bg-rose/15 text-rose', Medium: 'bg-warning/15 text-warning', Low: 'bg-blue/15 text-blue' }

function ScanCard({ checks }: { checks: Check[] }) {
  const counts = ['High', 'Medium', 'Low'].map((s) => [s, checks.filter((c) => c.severity === s).length] as const).filter(([, n]) => n)
  return (
    <div className="card mb-4 mt-2 overflow-hidden" data-testid="scan">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
        <span className="font-mono text-[12px] text-muted">static-scan · {checks.length} finding{checks.length === 1 ? '' : 's'}</span>
        <span className="flex gap-1.5">{counts.map(([s, n]) => <span key={s} className={`badge !h-5 !px-2 !text-[11px] ${SEV[s]}`}>{n} {s}</span>)}</span>
      </div>
      <ul className="divide-y divide-hairline">
        {checks.map((c, i) => (
          <li key={i} className="grid grid-cols-[4.5rem_1fr] gap-3 px-4 py-2.5">
            <span className={`badge !h-5 justify-center !px-2 !text-[11px] ${SEV[c.severity]}`}>{c.severity}</span>
            <div className="min-w-0">
              <p className="text-[13px] text-ink"><span className="font-mono text-primary">{c.rule}</span>{c.line > 0 && <span className="text-muted"> · line {c.line}</span>}</p>
              <p className="text-[13px] text-body">{c.message}</p>
              {c.snippet && <pre className="mt-1 overflow-x-auto font-mono text-[12px] text-muted">{c.snippet}</pre>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

const Ok = () => <span className="text-emerald">ok</span>

function RunLog({ r }: { r: AskResponse }) {
  const [open, setOpen] = useState(false)
  const top = r.retrieved.reduce((m, s) => Math.max(m, s.score), 0)
  const lines: [string, ReactNode, ReactNode][] = [
    ['search', <>hybrid dense+sparse, reranked · <span className="text-ink">{r.retrieved.length}</span> passages</>, r.retrieved.length ? <span className="text-ink">top {top.toFixed(2)}</span> : <span className="text-muted">none</span>],
    ...(r.search_query ? [['translate', <>weak match in {nativeName(r.lang)}, searched again in English: <span className="text-ink">{r.search_query}</span></>, <Ok />] as [string, ReactNode, ReactNode]] : []),
    ...(r.agent === 'security' ? [['scan', <>static rules · <span className="text-ink">{r.checks.length}</span> findings</>, <Ok />] as [string, ReactNode, ReactNode]] : []),
    ['defence', <>spotlight + quarantine filter</>, r.injection_defence ? <span className="text-emerald">on</span> : <span className="text-warning">Defence off</span>],
    ['model', r.llm_latency_ms != null ? <>{r.model} <span className="text-muted">@ {r.endpoint_label}</span></> : <span className="text-muted">not called</span>, <span className="text-ink">{formatMs(r.llm_latency_ms)}</span>],
    ['verify', <>Cited {r.citations.length}, invalid {r.invalid_citations.length}</>, r.refused ? <span className="text-muted">refused</span> : r.invalid_citations.length ? <span className="text-warning">removed</span> : <Ok />],
  ]
  return (
    <div className="mt-4" data-testid="trace">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex items-center gap-2 font-mono text-[12px] text-muted hover:text-ink">
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}><path d="M3.5 2l3 3-3 3" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
        pipeline · {formatMs(r.latency_ms)} · {r.retrieved.length} passages · {r.injection_defence ? 'defence on' : <span className="text-warning">Defence off</span>}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="card t-code mt-2 overflow-x-auto px-4 py-3">
              {lines.map(([k, v, s]) => (
                <div key={k} className="grid grid-cols-[4.5rem_1fr_auto] gap-3 whitespace-nowrap">
                  <span className="text-primary">{k}</span><span className="text-body">{v}</span><span>{s}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const STEPS: Record<string, [string, string][]> = {
  expert: [['search', 'hybrid search over your documents'], ['rerank', 'bge-reranker-v2-m3'], ['model', 'GLM-5.3-Flash is answering'], ['verify', 'checking every citation']],
  code_review: [['search', 'finding the relevant standards'], ['rerank', 'bge-reranker-v2-m3'], ['model', 'GLM-5.3-Flash is reviewing'], ['verify', 'checking citations']],
  security: [['scan', 'static security rules'], ['search', 'finding the relevant policies'], ['model', 'GLM-5.3-Flash is analysing'], ['verify', 'checking citations']],
}

function Pipeline({ agent }: { agent: Agent }) {
  const steps = STEPS[agent.id] ?? STEPS.expert
  const [step, setStep] = useState(0)
  useEffect(() => {
    const ids = [350, 900, 1400].map((t, i) => setTimeout(() => setStep(i + 1), t))
    return () => ids.forEach(clearTimeout)
  }, [])
  return (
    <motion.div className="card mt-3 overflow-hidden" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} aria-live="polite" data-testid="pipeline">
      <ol className="relative px-5 py-4">
        <span className="absolute bottom-6 left-[31px] top-6 w-px bg-hairline" aria-hidden />
        {steps.slice(0, step + 1).map(([k, v], i) => (
          <motion.li key={k} className="relative flex items-center gap-3 py-1.5" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <span className={`relative grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-colors duration-300 ${i < step ? 'bg-primary text-white' : 'bg-mint text-primary'}`}>
              {i < step ? (
                <motion.svg width="11" height="11" viewBox="0 0 12 12" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} aria-hidden><path d="M2.5 6.2l2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></motion.svg>
              ) : (
                <>
                  <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                  <span className="h-2 w-2 rounded-full bg-primary" />
                </>
              )}
            </span>
            <span className="w-16 shrink-0 font-mono text-[12px] font-semibold text-primary">{k}</span>
            <span className={`text-[14px] ${i === step ? 'text-ink' : 'text-muted'}`}>{v}</span>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  )
}
