import { AnimatePresence, motion } from 'motion/react'
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import type { Agent, AskResponse, Check, Domain, Source } from '../api'
import { flagLabel, formatMs } from '../lib/answer'
import { SUGGESTIONS } from '../lib/suggestions'
import { RedTeamView, type RedTeamState } from './RedTeamView'
import { RichText } from './RichText'
import { AgentIcon, DocIcon, Lock } from './ui'
import { LANGUAGES, langOf, nativeName } from '../lib/lang'
import { typingAllowed, useTyping } from '../lib/typing'

export type Turn = {
  id: string
  question: string
  status: 'pending' | 'done' | 'error'
  attempt: number
  response?: AskResponse
  error?: string
  image?: string              // data URL of an attached diagram
  redteam?: RedTeamState      // set for Red Team exercises
  fresh?: boolean             // answer just arrived: type it out once
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
  onTyped?: (t: Turn) => void
  onOpenDocuments: () => void
}

const EASE = [0.22, 1, 0.36, 1] as const

export function ChatView({ agent, turns, docCount, busy, onAsk, onRetry, onTyped, onOpenDocuments, domains, domain, onPickDomain, onLoadSamples, sampleLoad, language, onLanguage }: Props) {
  const lang = { language, onLanguage }
  const scroller = useRef<HTMLDivElement>(null)
  const last = turns[turns.length - 1]
  // While an answer types out, keep the newest line in view unless the reader has scrolled up.
  const follow = () => {
    const el = scroller.current
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 260) el.scrollTop = el.scrollHeight
  }
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
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 md:px-8">
        <ol className="mx-auto max-w-[768px] space-y-12 pb-12 pt-6">
          {turns.map((t) => <TurnView key={t.id} turn={t} agent={agent} onRetry={onRetry} onTyped={onTyped} onTick={follow} />)}
        </ol>
      </div>
      <div className="relative bg-canvas px-5 pb-4 md:px-8">
        <div className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-canvas to-transparent" aria-hidden />
        <div className="mx-auto max-w-[768px]">
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

type LangProps = { language: string; onLanguage: (code: string) => void }

/** Deterministic star positions so the field does not reshuffle on every render. */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return { x: r(1) * 100, y: r(2) * 100, s: r(3) > 0.85 ? 2 : 1, d: r(4) * 4 }
})

/** Faint twinkling stars and a sunset-to-dusk horizon behind the empty state. */
function Cosmos() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {STARS.map((s, i) => (
        <span key={i} className="animate-twinkle absolute rounded-full bg-white" style={{ left: `${s.x}%`, top: `${s.y * 0.8}%`, width: s.s, height: s.s, animationDelay: `${-s.d}s` }} />
      ))}
      <motion.div className="absolute inset-x-0 bottom-0 h-[55%]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 2 }}
        style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 115%, rgba(255,122,23,0.13), rgba(124,58,237,0.07) 45%, transparent 75%)' }} />
      <motion.svg className="absolute bottom-0 left-1/2 h-[240px] w-[1400px] -translate-x-1/2" viewBox="0 0 1400 240" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.6, ease: EASE }}>
        <defs>
          <linearGradient id="horizon" x1="0" x2="1">
            <stop offset="0" stopColor="#7c3aed" stopOpacity="0" />
            <stop offset="0.35" stopColor="#c4b5fd" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#ffc285" stopOpacity="0.6" />
            <stop offset="0.65" stopColor="#ff7a17" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff7a17" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="700" cy="520" rx="760" ry="420" fill="none" stroke="url(#horizon)" strokeWidth="1" />
      </motion.svg>
    </div>
  )
}

/** Display headline that resolves out of a blur, word by word. */
function Headline({ text, className = '' }: { text: string; className?: string }) {
  return (
    <h1 className={`t-display-md text-ink ${className}`}>
      {text.split(' ').map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <motion.span className="inline-block" initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.7, delay: 0.05 + i * 0.06, ease: EASE }}>{w}</motion.span>{' '}
        </Fragment>
      ))}
    </h1>
  )
}

const rise = (delay: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.6, delay, ease: EASE } })

function Suggestions({ items, onAsk, disabled }: { items: { label?: string; text: string; prompt: string; badge?: string }[]; onAsk: (q: string) => void; disabled: boolean }) {
  return (
    <ul className="mt-5 grid gap-2.5 sm:grid-cols-2" aria-label="Suggested prompts">
      {items.map((s, i) => (
        <motion.li key={s.prompt} {...rise(0.45 + i * 0.06)}>
          <button onClick={() => onAsk(s.prompt)} disabled={disabled}
            className="card card-hover group relative flex h-full w-full flex-col items-start gap-1.5 !bg-transparent px-4 py-3.5 text-left disabled:opacity-40">
            {(s.label || s.badge) && (
              <span className="flex items-center gap-2">
                {s.label && <span className="t-label !text-[11px] text-muted">{s.label}</span>}
                {s.badge && <span className="font-mono text-[11px] text-muted-soft">{s.badge}</span>}
              </span>
            )}
            <span lang={langOf(s.text)} className="line-clamp-2 pr-6 text-[14px] text-body group-hover:text-ink">{s.text}</span>
            <svg className="absolute right-4 top-1/2 -translate-y-1/2 -translate-x-1 text-muted opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M1 6h9M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
          </button>
        </motion.li>
      ))}
    </ul>
  )
}

function EmptyShell({ testId, children }: { testId: string; children: ReactNode }) {
  return (
    <div className="relative h-full overflow-y-auto" data-testid={testId}>
      <Cosmos />
      <div className="relative mx-auto flex min-h-full max-w-[780px] flex-col justify-center px-5 pb-24 pt-10">{children}</div>
    </div>
  )
}

function Hero({ agent, docCount, busy, onAsk, onOpenDocuments, lang }: { agent: Agent; docCount: number; busy: boolean; onAsk: (q: string, image?: string) => void; onOpenDocuments: () => void; lang: LangProps }) {
  return (
    <EmptyShell testId="hero">
      <div key={agent.id} className="text-center">
        <motion.p className="t-eyebrow text-muted" {...rise(0)}>{agent.name} · GLM-5.3-Flash</motion.p>
        <Headline text={HEADLINES[agent.id]} className="mx-auto mt-5 max-w-[16em]" />
        {docCount === 0 ? (
          <motion.div className="card mx-auto mt-8 flex max-w-[560px] flex-wrap items-center gap-4 p-5 text-left" data-testid="no-documents" {...rise(0.3)}>
            <span className="grid h-10 w-10 place-items-center rounded-full border border-hairline-strong text-ink"><DocIcon size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] text-ink">Upload a domain document to begin</p>
              <p className="t-body-sm text-muted">Standards, API specs, runbooks or policies as PDF, scan or image. Answers come only from what you upload.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={onOpenDocuments}>Upload documents</button>
          </motion.div>
        ) : (
          <motion.p className="t-body-lg mx-auto mt-5 max-w-[32em] text-muted" {...rise(0.3)}>
            Grounded in <button className="text-ink underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white" onClick={onOpenDocuments}>{docCount} document{docCount === 1 ? '' : 's'}</button>. Every claim links to its source.
          </motion.p>
        )}
      </div>
      <motion.div className="mt-9" {...rise(0.38)}><Composer agent={agent} busy={busy} onAsk={onAsk} big {...lang} /></motion.div>
      <Suggestions onAsk={(q) => onAsk(q)} disabled={busy || docCount === 0}
        items={SUGGESTIONS[agent.id].map((s) => ({ label: s.label, text: s.prompt.split('\n')[0], prompt: s.prompt, badge: /```/.test(s.prompt) ? 'python' : undefined }))} />
    </EmptyShell>
  )
}

/* ------------------------------------------------------------- domain expert */

function DomainPicker({ domains, onPick }: { domains: Domain[]; onPick: (id: string) => void }) {
  return (
    <div className="relative h-full overflow-y-auto" data-testid="domain-picker">
      <Cosmos />
      <div className="relative mx-auto flex min-h-full max-w-[1080px] flex-col justify-center px-5 pb-24 pt-10">
        <div className="text-center">
          <motion.p className="t-eyebrow text-muted" {...rise(0)}>Domain Expert · GLM-5.3-Flash</motion.p>
          <Headline text="Which expert do you need?" className="mt-5" />
          <motion.p className="t-body-lg mx-auto mt-4 max-w-[34em] text-muted" {...rise(0.3)}>
            Each domain has its own library of foundation documents. The expert answers from it, and from GLM's own knowledge where it stops.
          </motion.p>
        </div>
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {domains.map((d, i) => (
            <motion.li key={d.id} {...rise(0.35 + 0.06 * i)}>
              <SpotlightButton onClick={() => onPick(d.id)} testId={`pick-${d.id}`}>
                <span className="flex w-full items-center justify-between">
                  <span className="font-mono text-[12px] tracking-[1.2px] text-muted-soft">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-muted">{d.documents.length ? `${d.documents.length} docs` : 'no docs yet'}</span>
                </span>
                <span className="mt-8 text-[22px] tracking-[-0.4px] text-ink">{d.name}</span>
                <span className="mt-1.5 flex-1 text-[14px] text-muted">{d.tagline}</span>
                <span className="mt-6 inline-flex items-center gap-2 text-[13px] text-body transition-colors group-hover:text-ink">
                  Open
                  <svg className="transition-transform duration-300 group-hover:translate-x-1" width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M1 6h9M6.5 2.5L10 6l-3.5 3.5" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
                </span>
              </SpotlightButton>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** A card whose border and a soft light follow the pointer. */
function SpotlightButton({ onClick, testId, children }: { onClick: () => void; testId: string; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  const move = (e: MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    ref.current!.style.setProperty('--x', `${e.clientX - r.left}px`)
    ref.current!.style.setProperty('--y', `${e.clientY - r.top}px`)
  }
  return (
    <button ref={ref} onClick={onClick} onMouseMove={move} data-testid={testId}
      className="card card-hover group relative flex h-full w-full flex-col items-start overflow-hidden p-6 text-left active:scale-[0.99]">
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: 'radial-gradient(320px circle at var(--x) var(--y), rgba(255,255,255,0.07), transparent 60%)' }} aria-hidden />
      <span className="relative flex h-full w-full flex-col items-start">{children}</span>
    </button>
  )
}

function DomainHero({ agent, domain, busy, onAsk, onLoadSamples, sampleLoad, onOpenDocuments, lang }: {
  agent: Agent; domain: Domain; busy: boolean; onAsk: (q: string, image?: string) => void
  onLoadSamples: (id: string) => void; sampleLoad: SampleLoad | null; onOpenDocuments: () => void; lang: LangProps
}) {
  const loading = sampleLoad?.domain === domain.id && sampleLoad.running
  const missing = domain.samples.length > 0 && domain.documents.length < domain.samples.length
  return (
    <EmptyShell testId="domain-hero">
      <div key={domain.id} className="text-center">
        <motion.p className="t-eyebrow text-muted" {...rise(0)}>{domain.name} · Domain Expert</motion.p>
        <Headline text={`Ask the ${domain.name} expert.`} className="mx-auto mt-5 max-w-[16em]" />
        <motion.p className="t-body-lg mx-auto mt-4 max-w-[34em] text-muted" {...rise(0.3)}>
          Cited answers from this domain's documents, and GLM-5.3-Flash's own expertise where the documents stop.
        </motion.p>
      </div>

      <motion.div className="mt-8" {...rise(0.34)}><Composer agent={agent} busy={busy} onAsk={onAsk} big {...lang} /></motion.div>

      <motion.div className="mt-4 flex flex-wrap items-center justify-center gap-2" data-testid="domain-docs" {...rise(0.42)}>
        <span className="t-label mr-1 text-muted">Library · {domain.documents.length}</span>
        {domain.documents.map((t) => <span key={t} className="badge max-w-[260px]" title={t}><DocIcon size={12} /><span className="truncate">{t}</span></span>)}
        {domain.documents.length === 0 && <span className="text-[13px] text-muted-soft">empty, the expert still answers from GLM's knowledge</span>}
        {missing && (
          <button className="btn btn-primary btn-sm !h-7" onClick={() => onLoadSamples(domain.id)} disabled={loading} data-testid="load-samples">
            {loading ? 'Indexing…' : `Load sample documents (${domain.samples.length})`}
          </button>
        )}
        <button className="btn btn-sm !h-7" onClick={onOpenDocuments}>Upload your own</button>
      </motion.div>
      {sampleLoad?.domain === domain.id && (sampleLoad.indexed.length > 0 || sampleLoad.errors.length > 0) && (
        <p className="mt-3 text-center font-mono text-[12px]" data-testid="sample-progress">
          <span className="text-emerald">{sampleLoad.indexed.length} indexed</span>
          {sampleLoad.running && <span className="text-muted"> · working<span className="animate-blink">▌</span></span>}
          {sampleLoad.errors.map((e) => <span key={e} className="block text-rose">{e}</span>)}
        </p>
      )}

      <Suggestions onAsk={(q) => onAsk(q)} disabled={busy} items={domain.suggestions.map((q) => ({ text: q, prompt: q }))} />
    </EmptyShell>
  )
}

/* ------------------------------------------------------------------- composer */

const PLACEHOLDER: Record<string, string> = {
  expert: 'Ask anything in this domain',
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
  const ready = !busy && (!!q.trim() || !!image || exercise)
  return (
    <form onSubmit={(e) => { e.preventDefault(); send() }}
      className="flex flex-col gap-1 rounded-[26px] border border-hairline-strong bg-surface-soft/80 p-2 backdrop-blur transition-colors duration-300 focus-within:border-white/30"
      data-testid="composer"
      onDragOver={(e) => agent.reads_diagram && e.preventDefault()}
      onDrop={(e) => { if (agent.reads_diagram) { e.preventDefault(); attach(e.dataTransfer.files[0]) } }}>
      {image && (
        <div className="mx-1 mt-1 flex items-center gap-3 rounded-[18px] border border-hairline bg-canvas p-2" data-testid="attached-image">
          <img src={image.url} alt="" className="h-12 w-16 rounded-md bg-white object-contain" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-body">{image.name}</span>
          <button type="button" className="btn btn-sm !h-7" onClick={() => setImage(null)}>Remove</button>
        </div>
      )}
      <label className="block">
        <span className="sr-only">Message {agent.name}</span>
        <textarea
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          rows={big ? 2 : 1}
          placeholder={PLACEHOLDER[agent.id] + (language === 'auto' ? '' : ` · answer in ${nativeName(language)}`)}
          lang={langOf(q)}
          spellCheck={agent.id === 'expert'}
          className={`block w-full resize-none bg-transparent px-3.5 pt-2.5 pb-1 text-ink outline-none placeholder:text-muted ${/\n/.test(q) ? 'font-mono text-[13px] leading-relaxed' : 'text-[16px]'}`}
          data-testid="question-input"
        />
      </label>
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12px] text-muted">
          {agent.reads_diagram && (
            <>
              <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" data-testid="diagram-input" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" className="btn btn-icon !h-8 !w-8" onClick={() => file.current?.click()} disabled={busy} aria-label="Attach diagram" title="Attach diagram">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
              </button>
            </>
          )}
          <span className="badge !h-8 !gap-1.5 !px-3"><AgentIcon id={agent.id} size={13} />{agent.name}</span>
          <label className="relative">
            <span className="sr-only">Answer language</span>
            <select value={language} onChange={(e) => onLanguage(e.target.value)} disabled={busy}
              className="h-8 cursor-pointer appearance-none rounded-full border border-hairline-strong bg-transparent pl-3 pr-7 text-[12px] text-body outline-none transition-colors hover:border-white/40 focus-visible:border-white"
              data-testid="language-select" aria-label="Answer language">
              <option value="auto">Auto language</option>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native}{l.native !== l.name ? ` · ${l.name}` : ''}</option>)}
            </select>
            <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden className="pointer-events-none absolute right-3 top-[12px] text-muted"><path d="M2 4l3 3 3-3" stroke="currentColor" fill="none" strokeWidth="1.4" /></svg>
          </label>
          {imgError && <span className="text-rose">{imgError}</span>}
        </span>
        <motion.button type="submit" aria-label={exercise ? 'Run exercise' : 'Send'} disabled={!ready}
          className={`grid shrink-0 place-items-center rounded-full transition-colors duration-200 ${exercise ? 'h-9 px-4 text-[13px]' : 'h-9 w-9'} ${ready ? 'bg-white text-canvas' : 'bg-surface-mid text-muted'}`}
          whileTap={ready ? { scale: 0.9 } : undefined}>
          {exercise ? 'Run exercise' : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          )}
        </motion.button>
      </div>
    </form>
  )
}

/* ----------------------------------------------------------------------- turns */

function UserMessage({ text, image }: { text: string; image?: string }) {
  const hasCode = /```/.test(text) || text.split('\n').length > 6
  return (
    <div className="flex justify-end">
      <div className={`rounded-[22px] bg-surface-soft px-5 py-3 text-ink ${hasCode || image ? 'w-full max-w-[92%] border border-hairline' : 'max-w-[80%]'}`}>
        {image && <img src={image} alt="Attached diagram" className="mb-3 max-h-80 w-full rounded-lg bg-white object-contain" data-testid="message-image" />}
        {hasCode ? (
          <div className="t-body-md space-y-2"><RichText text={text} /></div>
        ) : (
          <p lang={langOf(text)} className="t-body-md whitespace-pre-wrap">{text}</p>
        )}
      </div>
    </div>
  )
}

function TurnView({ turn, agent, onRetry, onTyped, onTick }: { turn: Turn; agent: Agent; onRetry: (t: Turn) => void; onTyped?: (t: Turn) => void; onTick?: () => void }) {
  const r = turn.response
  const shown = r ? agentOf(r.agent, agent) : agent
  return (
    <motion.li initial={{ opacity: 0, y: 16, filter: 'blur(4px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.5, ease: EASE }} data-testid="turn">
      <UserMessage text={turn.question} image={turn.image} />
      <div className="mt-5 flex gap-3">
        <motion.span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-hairline-strong text-ink" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.1 }}><AgentIcon id={shown.id} size={15} /></motion.span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1.5 font-mono text-[11px] uppercase tracking-[1.2px]">
            <span className="text-ink">{shown.name}</span>
            <span className="text-muted">· GLM-5.3-Flash{r && !r.error ? ` · ${r.endpoint_label}` : ''}</span>
            {r && !r.error && r.lang !== 'en' && <span className="badge !h-5 !h-5 !px-2 !text-[11px] normal-case tracking-normal !text-ink" data-testid="answer-language">{nativeName(r.lang)}</span>}
          </p>
          {turn.redteam ? (
            <>
              <RedTeamView state={turn.redteam} />
              {turn.status === 'error' && <div className="card mt-3 !border-rose/40 p-4"><p className="t-body-md text-body">The exercise stopped: {turn.error}</p></div>}
            </>
          ) : (
          <AnimatePresence initial={false}>
            {turn.status === 'pending' && <Pipeline key={`p-${turn.attempt}`} agent={shown} />}
            {turn.status === 'error' && (
              <motion.div key={`e-${turn.attempt}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="card mt-3 overflow-hidden !border-rose/40 p-4">
                <p className="t-body-md text-body">The server did not respond: {turn.error}</p>
                <button className="btn btn-secondary btn-sm mt-3" onClick={() => onRetry(turn)}>Ask again</button>
              </motion.div>
            )}
            {turn.status === 'done' && r && (
              <motion.div key={`a-${turn.attempt}`} className="mt-2" initial="hidden" animate="shown" exit={{ opacity: 0, height: 0 }} variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
                <Answer turn={turn} onRetry={onRetry} onTyped={onTyped} onTick={onTick} />
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
  return <motion.div variants={{ hidden: { opacity: 0, y: 8, filter: 'blur(6px)' }, shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.45, ease: EASE } } }}>{children}</motion.div>
}

function Answer({ turn, onRetry, onTyped, onTick }: { turn: Turn; onRetry: (t: Turn) => void; onTyped?: (t: Turn) => void; onTick?: () => void }) {
  const r = turn.response!
  const [open, setOpen] = useState<string | null>(null)
  const [animate] = useState(() => !!turn.fresh && !r.error && !r.refused && typingAllowed())
  const typing = useTyping(r.answer, animate, () => onTyped?.(turn), onTick)
  const done = typing.done
  const byLabel = new Map(r.citations.map((c) => [c.label, c]))

  if (r.error) {
    return (
      <Reveal>
        <div className="card !border-rose/40 p-4">
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
        className={`mx-0.5 inline-flex h-[19px] -translate-y-[1px] items-center rounded-full px-1.5 align-middle font-mono text-[10.5px] transition-colors ${on ? 'bg-white text-canvas' : 'bg-surface-mid text-body hover:bg-white hover:text-canvas'}`}
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
        <div lang={r.lang} className={`t-body-md space-y-4 text-body-strong ${done ? '' : 'typing cursor-pointer'}`} data-testid="answer"
          onClick={done ? undefined : typing.skip} title={done ? undefined : 'Click to show the whole answer'} aria-busy={!done}>
          {animate
            ? <RichText text={typing.shown} cite={cite} />
            : <RichText text={r.answer} cite={cite} wrap={(b, i) => <Reveal key={i}>{b}</Reveal>} />}
        </div>
      )}

      {done && r.citations.length > 0 && (
        <Reveal><Sources sources={r.citations} open={open} onToggle={(l) => setOpen(open === l ? null : l)} /></Reveal>
      )}

      {done && r.flags.length > 0 && (
        <Reveal>
          <ul className="mt-4 space-y-2" data-testid="flags">
            {r.flags.map((f, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
                <span className="text-[13px] text-warning">{flagLabel(f.type)}</span>
                <span className="break-all font-mono text-[12px] text-muted">{f.value}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}

      {done && <Reveal><RunLog r={r} /></Reveal>}
    </>
  )
}

function Sources({ sources, open, onToggle }: { sources: Source[]; open: string | null; onToggle: (label: string) => void }) {
  return (
    <div className="mt-5" data-testid="sources">
      <p className="t-label text-muted">Sources</p>
      <ul className="mt-2 space-y-2">
        {sources.map((s) => {
          const on = open === s.label
          return (
            <li key={s.chunk_id} className={`card overflow-hidden transition-colors ${on ? '!border-white/40' : ''}`}>
              <button onClick={() => onToggle(s.label!)} aria-expanded={on} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${on ? 'bg-white text-canvas' : 'bg-surface-mid text-body'}`}>{s.label}</span>
                <span className="text-muted"><DocIcon size={14} /></span>
                <span lang={langOf(s.title)} className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{s.title}</span>
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
                  <span className="uppercase tracking-[1px] text-muted">{k}</span><span className="text-body">{v}</span><span>{s}</span>
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
  const [k, v] = steps[Math.min(step, steps.length - 1)]
  return (
    <motion.div className="mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} aria-live="polite" data-testid="pipeline">
      <div className="flex items-center gap-1.5">
        {steps.map(([key], i) => (
          <motion.span key={key} className="h-[3px] rounded-full" animate={{ width: i === step ? 28 : 12, backgroundColor: i <= step ? '#ffffff' : '#2e3136' }} transition={{ duration: 0.4, ease: EASE }} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={k} className="mt-3 flex items-baseline gap-3" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}>
          <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-muted">{k}</span>
          <span className="text-sweep text-[15px]">{v}</span>
        </motion.p>
      </AnimatePresence>
      <ul className="sr-only">{steps.slice(0, step + 1).map(([key, val]) => <li key={key}>{key}: {val}</li>)}</ul>
    </motion.div>
  )
}
