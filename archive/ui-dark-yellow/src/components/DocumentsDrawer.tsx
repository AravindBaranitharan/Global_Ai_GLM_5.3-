import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type DragEvent } from 'react'
import { api, type Document, type Domain, type IngestEvent } from '../api'
import { DocIcon } from './ui'
import { langOf } from '../lib/lang'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp'
const EASE = [0.2, 0.8, 0.2, 1] as const

type Props = { open: boolean; onClose: () => void; documents: Document[]; onChanged: () => void; domains: Domain[]; defaultDomain: string | null }

type Line = { key: string; text: string; tone: 'ok' | 'info' | 'warn' | 'err'; detail?: string }

function describe(e: IngestEvent): Line | null {
  const page = e.page != null ? ` p${e.page}` : ''
  switch (e.step) {
    case 'start': return { key: 'load', text: String(e.title), tone: 'info' }
    case 'rendered': return { key: 'render', text: `${e.pages} page${e.pages === 1 ? '' : 's'}`, tone: 'ok' }
    case 'text_layer': return { key: 'text', text: `text layer${page}`, tone: 'ok' }
    case 'vision_start': return { key: 'vision', text: `GLM-5.3-Flash reading${page}${e.reason ? ` (${e.reason})` : ''}`, tone: 'info' }
    case 'vision_done': return { key: 'vision', text: `${e.chars} chars${page}${e.cached ? ', cached' : ''}`, tone: 'ok', detail: e.preview ? String(e.preview) : undefined }
    case 'chunked': return { key: 'chunk', text: `${e.chunks} passage${e.chunks === 1 ? '' : 's'}${page}`, tone: 'ok' }
    case 'quarantine': return { key: 'guard', text: `hidden text quarantined${page}`, tone: 'warn', detail: String(e.text ?? '') }
    case 'embedding': return { key: 'embed', text: `bge-m3 dense+sparse, ${e.chunks} passages`, tone: 'info' }
    case 'indexed': return { key: 'index', text: `searchable: ${e.chunks} passages${Number(e.quarantined) ? `, ${e.quarantined} quarantined` : ''}`, tone: 'ok' }
    case 'warning': return { key: 'warn', text: String(e.message), tone: 'warn' }
    case 'error': return { key: 'error', text: String(e.message), tone: 'err' }
    default: return null
  }
}
const TONE = { ok: 'text-emerald', info: 'text-body', warn: 'text-warning', err: 'text-rose' }

export function DocumentsDrawer({ open, onClose, documents, onChanged, domains, defaultDomain }: Props) {
  const [target, setTarget] = useState<string>('')
  useEffect(() => { if (open) setTarget(defaultDomain ?? '') }, [open, defaultDomain])
  const domainName = (id: string) => (id === 'general' || !id ? 'General' : domains.find((d) => d.id === id)?.name ?? id)
  const groups = [...new Set(documents.map((d) => d.domain || 'general'))].sort((a, b) => (a === 'general' ? 1 : b === 'general' ? -1 : domainName(a).localeCompare(domainName(b))))
  const [log, setLog] = useState<{ file: string; lines: Line[] }[]>([])
  const [running, setRunning] = useState(false)
  const [drag, setDrag] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const upload = async (files: File[]) => {
    if (!files.length || running) return
    setRunning(true)
    for (const f of files) {
      setLog((l) => [...l, { file: f.name, lines: [] }])
      const push = (line: Line) => setLog((l) => l.map((x, i) => (i === l.length - 1 ? { ...x, lines: [...x.lines, line] } : x)))
      try {
        await api.ingest(f, (e) => { const d = describe(e); if (d) push(d) }, target || undefined)
      } catch (e) {
        push({ key: 'error', text: e instanceof Error ? e.message : String(e), tone: 'err' })
      }
      onChanged()
    }
    setRunning(false)
  }

  const remove = async (id: string) => {
    await api.deleteDocument(id).catch(() => {})
    setConfirm(null)
    onChanged()
  }

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void upload(Array.from(e.dataTransfer.files)) }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-40 bg-canvas/70 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !running && onClose()} />
          <motion.aside
            role="dialog"
            aria-label="Documents"
            className="fixed inset-y-3 right-3 z-50 flex w-[calc(100%-24px)] max-w-[560px] flex-col overflow-hidden rounded-lg border border-hairline bg-surface-card"
            initial={{ x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }}
            transition={{ duration: 0.35, ease: EASE }}
            data-testid="documents-drawer"
          >
            <div className="flex items-start justify-between gap-6 border-b border-hairline px-6 py-5">
              <div>
                <h2 className="t-title-lg text-ink">Documents</h2>
                <p className="t-body-sm mt-1 text-muted">Domain PDFs, scans and images the agents answer from. Scans are read by GLM-5.3-Flash vision; hidden text is quarantined before indexing.</p>
              </div>
              <button className="btn btn-secondary btn-icon shrink-0" aria-label="Close" onClick={onClose} disabled={running}>
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" /></svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <p className="t-label !text-[11px] text-muted">Upload into</p>
              <div className="mb-4 mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Upload into" data-testid="upload-domain">
                {[{ id: '', name: 'General' }, ...domains].map((d) => (
                  <button key={d.id || 'general'} type="button" role="radio" aria-checked={target === d.id} onClick={() => setTarget(d.id)} disabled={running}
                    className={`tab !py-1.5 ${target === d.id ? '!bg-primary !text-on-primary font-semibold' : 'bg-surface-elevated'}`}>
                    {d.name}
                  </button>
                ))}
              </div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors ${drag ? 'border-primary bg-primary/5' : 'border-hairline-strong bg-canvas'}`}
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-primary"><DocIcon size={18} /></span>
                <p className="t-title-sm mt-3 text-ink">{running ? 'Indexing…' : 'Drop PDFs, scans or images'}</p>
                <p className="t-caption mt-1 text-muted">PDF, PNG, JPG or WEBP</p>
                <input ref={input} type="file" accept={ACCEPT} multiple className="sr-only" data-testid="upload-input"
                  onChange={(e) => { void upload(Array.from(e.target.files ?? [])); e.target.value = '' }} />
                <button className="btn btn-primary btn-sm mt-4" onClick={() => input.current?.click()} disabled={running}>Choose files</button>
              </div>

              {log.length > 0 && (
                <div className="card mt-5 overflow-hidden !bg-canvas" data-testid="ingest-log">
                  <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
                    <span className="font-mono text-[12px] text-muted">ingest.log</span>
                    <span className={`font-mono text-[12px] ${running ? 'text-primary' : 'text-emerald'}`}>{running ? 'running' : 'done'}</span>
                  </div>
                  <div className="t-code max-h-64 overflow-y-auto px-4 py-3">
                    {log.map((f, i) => (
                      <div key={i} className="mb-2 last:mb-0">
                        <p className="text-ink">{f.file}</p>
                        {f.lines.map((l, j) => (
                          <div key={j}>
                            <div className="grid grid-cols-[4.5rem_1fr] gap-3"><span className="text-primary">{l.key}</span><span className={TONE[l.tone]}>{l.text}</span></div>
                            {l.detail && <p lang={langOf(l.detail)} className="mb-1 ml-[5.25rem] line-clamp-3 whitespace-pre-line font-sans text-[12px] text-muted">{l.detail}</p>}
                          </div>
                        ))}
                      </div>
                    ))}
                    {running && <span className="animate-blink text-primary">▌</span>}
                  </div>
                </div>
              )}

              <p className="t-label mt-7 !text-[11px] text-muted">{documents.length} indexed</p>
              {documents.length === 0 ? (
                <p className="t-body-sm mt-2 text-muted">Nothing yet. Upload a document above.</p>
              ) : (
                <div className="mt-2 space-y-5" data-testid="document-list">
                  {groups.map((g) => (
                  <section key={g}>
                  <p className="mb-2 text-[12.5px] font-semibold text-body">{domainName(g)} <span className="font-normal text-muted-soft">· {documents.filter((d) => (d.domain || 'general') === g).length}</span></p>
                  <ul className="space-y-2">
                  {documents.filter((d) => (d.domain || 'general') === g).map((d) => (
                    <li key={d.doc_id} className="card p-3.5" data-testid="document-row">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-muted"><DocIcon size={18} /></span>
                        <div className="min-w-0 flex-1">
                          <p lang={langOf(d.title)} className="truncate text-[14px] font-semibold text-ink">{d.title}</p>
                          <p className="mt-1 flex flex-wrap gap-1.5">
                            <span className="badge !h-5 !px-2 !text-[11px]">{d.pages} page{d.pages === 1 ? '' : 's'}</span>
                            <span className="badge !h-5 !px-2 !text-[11px]">{d.chunks} passages</span>
                            {d.source_types.filter((t) => t !== 'digital').map((t) => <span key={t} className="badge !h-5 !px-2 !text-[11px]">{t === 'scan' ? 'read by vision' : t}</span>)}
                            {d.quarantined.length > 0 && (
                              <button onClick={() => setExpanded(expanded === d.doc_id ? null : d.doc_id)} className="badge !h-5 !bg-rose/15 !px-2 !text-[11px] !text-rose" data-testid="quarantine-badge">
                                {d.quarantined.length} hidden text quarantined
                              </button>
                            )}
                          </p>
                        </div>
                        {confirm === d.doc_id ? (
                          <span className="flex shrink-0 gap-1.5">
                            <button className="btn btn-sm !h-7 !bg-rose !px-2.5 !text-[12px] !text-ink" onClick={() => remove(d.doc_id)}>Delete</button>
                            <button className="btn btn-secondary btn-sm !h-7 !px-2.5 !text-[12px]" onClick={() => setConfirm(null)}>Keep</button>
                          </span>
                        ) : (
                          <button className="btn btn-secondary btn-icon !h-7 !w-7 shrink-0 text-muted" aria-label={`Delete ${d.title}`} onClick={() => setConfirm(d.doc_id)}>
                            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M2 3h8M4.5 3V2h3v1M3 3l.5 7h5L9 3" stroke="currentColor" fill="none" strokeWidth="1.2" /></svg>
                          </button>
                        )}
                      </div>
                      <AnimatePresence initial={false}>
                        {expanded === d.doc_id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                            {d.quarantined.map((q) => (
                              <div key={q.chunk_id} className="mt-3 rounded-md border border-rose/40 bg-rose/10 p-3" data-testid="quarantine-text">
                                <p className="text-[12px] font-semibold text-rose">Page {q.page} · {q.flags.map((f) => f.replace(/_/g, ' ')).join(', ')}</p>
                                <p className="t-body-sm mt-1 text-body">“{q.text}”</p>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </li>
                  ))}
                  </ul>
                  </section>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
