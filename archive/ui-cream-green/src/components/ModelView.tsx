import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, type About } from '../api'

const EASE = [0.2, 0.8, 0.2, 1] as const

export function ModelView() {
  const [about, setAbout] = useState<About | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.about().then(setAbout).catch((e) => setError(String(e.message ?? e))) }, [])

  if (error) return <p className="t-caption p-10 text-rose">Could not load model details: {error}</p>
  if (!about) return null

  const stats: [string, string][] = [
    ['320B', 'parameters, mixture of experts'],
    [about.licence ?? 'MIT', 'licence'],
    ['Open', 'weights anyone can download'],
    ['1', 'line to move it on-premises'],
  ]
  const stack: [string, string][] = [
    ['Running on', about.running_on ?? '—'],
    ['Quantization', about.quantization ?? '—'],
    ['Embeddings', about.embeddings ?? '—'],
    ['Reranker', about.reranker ?? '—'],
    ['Vector store', about.vector_store ?? '—'],
    ['Reasoning effort', about.reasoning_effort ?? '—'],
  ]
  const cloud = about.endpoint ?? ''

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] px-5 py-12 md:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[7fr_5fr]">
          <div>
            <span className="badge badge-gold">★ Open weights</span>
            <motion.h1 className="t-display-xl mt-5 text-brand" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
              {about.family}
            </motion.h1>
            <p className="t-body-md mt-5 max-w-[36em] text-body">
              The model answering every question here. Its weights are public, so it can run on a managed endpoint today and on a single GPU the company owns tomorrow, with no change to this application.
            </p>
          </div>

          <motion.div className="card overflow-hidden" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1, ease: EASE }}>
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
              <span className="flex gap-1.5" aria-hidden><span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" /><span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" /><span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" /></span>
              <span className="t-code !text-[12px] text-muted">.env</span>
            </div>
            <pre className="t-code overflow-x-auto px-4 py-4 text-body">
<span className="text-muted-soft"># cloud today</span>{'\n'}
<span className="text-primary">LLM_BASE_URL</span>=<span className="text-ink">{cloud}</span>{'\n'}
<span className="text-muted-soft"># self-hosted: llama-server on one H200</span>{'\n'}
<span className="text-muted-soft"># LLM_BASE_URL=http://localhost:8080/v1</span>{'\n'}
<span className="text-primary">LLM_MODEL</span>=<span className="text-ink">{about.model}</span>{'\n'}
<span className="text-primary">LLM_MODE_LABEL</span>=<span className="text-ink">{about.running_on}</span>
            </pre>
          </motion.div>
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-6 border-t border-hairline pt-10 lg:grid-cols-4">
          {stats.map(([v, l], i) => (
            <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.07 }}>
              <dd className="t-stat">{v}</dd>
              <dt className="t-caption mt-2 text-muted">{l}</dt>
            </motion.div>
          ))}
        </dl>

        <div className="mt-16 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stack.map(([l, v]) => (
            <div key={l} className="card card-lift p-6">
              <p className="t-label text-muted">{l}</p>
              <p className="t-title-md mt-2 break-words text-ink">{v}</p>
            </div>
          ))}
        </div>

        <div className="relative mt-16 overflow-hidden rounded-[12px] bg-house px-8 py-14 text-white md:px-12">
          <svg className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-uplift" viewBox="0 0 200 200" aria-hidden><circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" /><circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" /></svg>
          <p className="t-display-md relative max-w-[20em]">Same app. Same answers. Your own GPU.</p>
          <p className="t-body-md relative mt-3 max-w-[40em] text-white/70">Point LLM_BASE_URL at llama-server and block outbound traffic. Retrieval, reranking, the vector store and the audit log already run locally.</p>
        </div>
      </div>
    </div>
  )
}
