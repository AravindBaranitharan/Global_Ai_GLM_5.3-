import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
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

const EASE = [0.2, 0.8, 0.2, 1] as const

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
      <div className="border-t border-hairline bg-canvas px-5 py-4 md:px-10">
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

type LangProps = { language: string; onLanguage: (code: string) => void }

function Hero({ agent, docCount, busy, onAsk, onOpenDocuments, lang }: { agent: Agent; docCount: number; busy: boolean; onAsk: (q: string, image?: string) => void; onOpenDocuments: () => void; lang: LangProps }) {
  return (
    <div className="h-full overflow-y-auto" data-testid="hero">
      <motion.div
        key={agent.id}
        className="mx-auto flex min-h-full max-w-[860px] flex-col justify-center px-5 py-12 md:px-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
      >
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-on-primary"><AgentIcon id={agent.id} size={22} /></span>
          <div>
            <p className="t-title-md text-ink">{agent.name}</p>
            <p className="t-caption text-muted">{agent.tagline}</p>
          </div>
        </div>
        <h1 className="t-display-lg mt-8 max-w-[15em] text-ink">{HEADLINES[agent.id]}</h1>

        {docCount === 0 ? (
          <div className="card mt-8 flex flex-wrap items-center gap-5 border-primary/40 p-6" data-testid="no-documents">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/15 text-primary"><DocIcon size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="t-title-md text-ink">Upload a domain document to begin</p>
              <p className="t-body-sm text-muted">Standards, API specs, runbooks or policies as PDF, scan or image. Answers come only from what you upload.</p>
            </div>
            <button className="btn btn-primary" onClick={onOpenDocuments}>Upload documents</button>
          </div>
        ) : (
          <p className="t-body-md mt-5 max-w-[40em] text-body">
            Grounded in <button className="font-semibold text-primary underline-offset-4 hover:underline" onClick={onOpenDocuments}>{docCount} document{docCount === 1 ? '' : 's'}</button>. Every claim links to its source, and nothing leaves the documents you uploaded.
          </p>
        )}

        <div className="mt-8"><Composer agent={agent} busy={busy} onAsk={onAsk} big {...lang} /></div>

        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2" aria-label="Suggested prompts">
          {SUGGESTIONS[agent.id].map((s, i) => {
            const code = /```/.test(s.prompt)
            const first = s.prompt.split('\n')[0]
            return (
              <motion.li key={s.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.3, ease: EASE }}>
                <button
                  onClick={() => onAsk(s.prompt)}
                  disabled={busy || docCount === 0}
                  className="card group flex h-full w-full flex-col items-start gap-2 p-4 text-left transition-colors hover:border-hairline-strong hover:bg-surface-elevated disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    <span className="badge !h-5 !bg-canvas !px-2 !text-[11px] !text-muted group-hover:!text-primary">{s.label}</span>
                    {code && <span className="font-mono text-[11px] text-muted-soft">python</span>}
                  </span>
                  <span lang={langOf(first)} className="text-[14px] font-medium text-ink">{first}</span>
                </button>
              </motion.li>
            )
          })}
        </ul>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------------- domain expert */

function DomainPicker({ domains, onPick }: { domains: Domain[]; onPick: (id: string) => void }) {
  return (
    <div className="h-full overflow-y-auto" data-testid="domain-picker">
      <motion.div className="mx-auto flex min-h-full max-w-[920px] flex-col justify-center px-5 py-12 md:px-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-on-primary"><AgentIcon id="expert" size={22} /></span>
          <div>
            <p className="t-title-md text-ink">Domain Expert</p>
            <p className="t-caption text-muted">Pick a domain. Each expert answers from its own knowledge base plus GLM's expertise.</p>
          </div>
        </div>
        <h1 className="t-display-lg mt-8 text-ink">Which expert do you need?</h1>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {domains.map((d, i) => (
            <motion.li key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i, duration: 0.3, ease: EASE }}>
              <button onClick={() => onPick(d.id)} className="card group flex h-full w-full flex-col items-start gap-2 p-5 text-left transition-colors hover:border-primary/60 hover:bg-surface-elevated" data-testid={`pick-${d.id}`}>
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="text-[17px] font-bold tracking-[-0.3px] text-ink">{d.name}</span>
                  <span className={`badge !h-5 !px-2 !text-[11px] ${d.documents.length ? '!bg-primary/15 !text-primary' : '!text-muted'}`}>{d.documents.length ? `${d.documents.length} docs` : 'no docs yet'}</span>
                </span>
                <span className="text-[13.5px] text-muted">{d.tagline}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      </motion.div>
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
      <motion.div key={domain.id} className="mx-auto flex min-h-full max-w-[860px] flex-col justify-center px-5 py-12 md:px-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-on-primary"><AgentIcon id="expert" size={22} /></span>
          <div>
            <p className="t-title-md text-ink">{domain.name} expert</p>
            <p className="t-caption text-muted">{domain.tagline}</p>
          </div>
        </div>
        <h1 className="t-display-lg mt-8 max-w-[15em] text-ink">Ask the {domain.name} expert.</h1>
        <p className="t-body-md mt-4 max-w-[40em] text-body">
          Answers draw on this domain's documents, with citations, and on GLM-5.3-Flash's own expertise where the documents stop. It never refuses just because a topic is not in the documents.
        </p>

        <div className="card mt-6 p-4" data-testid="domain-docs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="t-label !text-[11px] text-muted">Knowledge base · {domain.documents.length} document{domain.documents.length === 1 ? '' : 's'}</p>
            <span className="flex gap-2">
              {missing && (
                <button className="btn btn-primary btn-sm" onClick={() => onLoadSamples(domain.id)} disabled={loading} data-testid="load-samples">
                  {loading ? 'Indexing…' : `Load sample documents (${domain.samples.length})`}
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={onOpenDocuments}>Upload your own</button>
            </span>
          </div>
          {domain.documents.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {domain.documents.map((t) => <li key={t} className="badge !h-6 !bg-surface-elevated"><DocIcon size={12} />{t}</li>)}
            </ul>
          ) : (
            <p className="t-body-sm mt-2 text-muted">No documents yet. Load the samples or upload your own; the expert still answers from GLM's knowledge meanwhile.</p>
          )}
          {sampleLoad?.domain === domain.id && (sampleLoad.indexed.length > 0 || sampleLoad.errors.length > 0) && (
            <p className="mt-3 font-mono text-[12px]" data-testid="sample-progress">
              <span className="text-emerald">{sampleLoad.indexed.length} indexed</span>
              {sampleLoad.running && <span className="text-primary"> · working<span className="animate-blink">▌</span></span>}
              {sampleLoad.errors.map((e) => <span key={e} className="block text-rose">{e}</span>)}
            </p>
          )}
        </div>

        <div className="mt-6"><Composer agent={agent} busy={busy} onAsk={onAsk} big {...lang} /></div>

        <ul className="mt-6 grid gap-2.5 sm:grid-cols-2" aria-label="Suggested prompts">
          {domain.suggestions.map((q, i) => (
            <motion.li key={q} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + i * 0.05, duration: 0.3, ease: EASE }}>
              <button onClick={() => onAsk(q)} disabled={busy} className="card flex h-full w-full items-start p-4 text-left text-[14px] font-medium text-ink transition-colors hover:border-hairline-strong hover:bg-surface-elevated disabled:opacity-40">
                {q}
              </button>
            </motion.li>
          ))}
        </ul>
      </motion.div>
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
    <form onSubmit={(e) => { e.preventDefault(); send() }} className="card flex flex-col gap-2 p-2 transition-colors focus-within:border-primary" data-testid="composer"
      onDragOver={(e) => agent.reads_diagram && e.preventDefault()}
      onDrop={(e) => { if (agent.reads_diagram) { e.preventDefault(); attach(e.dataTransfer.files[0]) } }}>
      {image && (
        <div className="flex items-center gap-3 rounded-md bg-surface-elevated p-2" data-testid="attached-image">
          <img src={image.url} alt="" className="h-14 w-20 rounded-xs bg-ink object-contain" />
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
          <span className="badge !h-6 !gap-1.5 !bg-surface-elevated"><AgentIcon id={agent.id} size={13} />{agent.name}</span>
          <label className="relative">
            <span className="sr-only">Answer language</span>
            <select value={language} onChange={(e) => onLanguage(e.target.value)} disabled={busy}
              className="h-6 cursor-pointer appearance-none rounded-full bg-surface-elevated pl-2.5 pr-6 text-[12px] font-medium text-ink outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          <span className="hidden xl:inline">Enter to send · Shift+Enter for a new line</span>
        </span>
        <button type="submit" className="btn btn-primary btn-sm !h-9 !px-4" disabled={busy || (!q.trim() && !image && !exercise)}>
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
      <div className={`rounded-lg rounded-tr-xs bg-surface-elevated px-4 py-3 text-ink ${hasCode || image ? 'w-full max-w-[92%]' : 'max-w-[80%]'}`}>
        {image && <img src={image} alt="Attached diagram" className="mb-3 max-h-80 w-full rounded-md bg-ink object-contain" data-testid="message-image" />}
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
    <motion.li initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} data-testid="turn">
      <UserMessage text={turn.question} image={turn.image} />
      <div className="mt-5 flex gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary text-on-primary"><AgentIcon id={shown.id} size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[13px]">
            <span className="font-semibold text-ink">{shown.name}</span>
            <span className="text-muted">GLM-5.3-Flash{r && !r.error ? ` · ${r.endpoint_label}` : ''}</span>
            {r && !r.error && r.lang !== 'en' && <span className="badge !h-5 !bg-primary/15 !px-2 !text-[11px] !text-primary" data-testid="answer-language">{nativeName(r.lang)}</span>}
          </p>
          {turn.redteam ? (
            <>
              <RedTeamView state={turn.redteam} />
              {turn.status === 'error' && <div className="card mt-3 border-rose/40 p-4"><p className="t-body-md text-body">The exercise stopped: {turn.error}</p></div>}
            </>
          ) : (
          <AnimatePresence initial={false}>
            {turn.status === 'pending' && <Pipeline key={`p-${turn.attempt}`} agent={shown} />}
            {turn.status === 'error' && (
              <motion.div key={`e-${turn.attempt}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="card mt-3 overflow-hidden border-rose/40 p-4">
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
        <div className="card border-rose/40 p-4">
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
        className={`mx-0.5 inline-flex h-[20px] -translate-y-[1px] items-center rounded-full px-1.5 align-middle font-mono text-[10.5px] font-semibold transition-colors ${on ? 'bg-primary text-on-primary' : 'bg-surface-elevated text-body hover:bg-primary hover:text-on-primary'}`}
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
        <div lang={r.lang} className="t-body-md space-y-3 text-body-strong" data-testid="answer">
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
            <li key={s.chunk_id} className={`card overflow-hidden transition-colors ${on ? '!border-primary/60' : ''}`}>
              <button onClick={() => onToggle(s.label!)} aria-expanded={on} className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left">
                <span className={`rounded-full px-1.5 font-mono text-[10.5px] font-semibold ${on ? 'bg-primary text-on-primary' : 'bg-surface-elevated text-body'}`}>{s.label}</span>
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
    <motion.div className="card mt-2 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} aria-live="polite" data-testid="pipeline">
      <div className="t-code px-4 py-3">
        {steps.slice(0, step + 1).map(([k, v], i) => (
          <motion.div key={k} className="grid grid-cols-[4.5rem_1fr_auto] gap-3" initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}>
            <span className="text-primary">{k}</span>
            <span className={i === step ? 'text-ink' : 'text-muted'}>{v}{i === step && <span className="animate-blink ml-1 text-primary">▌</span>}</span>
            <span>{i < step ? <Ok /> : null}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

