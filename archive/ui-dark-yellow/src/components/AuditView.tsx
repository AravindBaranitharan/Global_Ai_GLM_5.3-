import { motion } from 'motion/react'
import { Fragment, useEffect, useRef, useState } from 'react'
import { api, type AuditRow } from '../api'
import { flagLabel, formatMs } from '../lib/answer'
import { AgentIcon } from './ui'
import type { AgentId } from '../api'
import { langOf } from '../lib/lang'

const AGENT_NAME: Record<string, string> = { expert: 'Domain Expert', code_review: 'Code Reviewer', security: 'Security Agent' }

export function AuditView() {
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const seen = useRef<Set<number> | null>(null)

  useEffect(() => {
    let live = true
    const load = () => api.audit().then((r) => {
      if (!live) return
      // Rows that arrive while the tab is open get a brief highlight.
      if (seen.current) setFresh(new Set(r.filter((x) => !seen.current!.has(x.id)).map((x) => x.id)))
      seen.current = new Set(r.map((x) => x.id))
      setRows(r)
      setError(null)
    }).catch((e) => live && setError(String(e.message ?? e)))
    load()
    const id = setInterval(load, 3000)
    return () => { live = false; clearInterval(id) }
  }, [])

  const refused = rows?.filter((r) => r.refused && !r.error).length ?? 0
  const flagged = rows?.filter((r) => r.flags.length).length ?? 0
  const reviews = rows?.filter((r) => r.agent === 'code_review' || r.agent === 'security').length ?? 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[1280px] px-5 py-12 md:px-8">
        <h1 className="t-display-md text-ink">Audit trail</h1>
        <p className="t-body-md mt-3 max-w-[40em] text-body">
          Every question is recorded with the agent that handled it, which passages were retrieved and cited, any security flags, and which model answered.
        </p>

        <dl className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            [rows?.length ?? 0, 'questions logged'],
            [reviews, 'code and security reviews'],
            [refused, 'refused for lack of sources'],
            [flagged, 'answers with security flags'],
          ].map(([v, l]) => (
            <div key={l as string}>
              <dd className="t-stat">{v}</dd>
              <dt className="t-caption mt-2 text-muted">{l}</dt>
            </div>
          ))}
        </dl>

        {error && <p className="t-caption mt-10 text-rose">Could not load the audit log: {error}</p>}
        {rows && rows.length === 0 && <div className="card mt-10 p-8 text-center"><p className="t-body-md text-muted">No questions yet. Ask one in Chat and it appears here.</p></div>}

        {rows && rows.length > 0 && (
          <div className="card mt-10 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left" data-testid="audit-table">
              <thead>
                <tr className="t-label text-muted">
                  {['Time', 'Agent', 'Question', 'Retrieved', 'Cited', 'Result', 'Answered by', 'Time taken'].map((h) => (
                    <th key={h} className="border-b border-hairline px-4 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Fragment key={r.id}>
                    <motion.tr
                      initial={fresh.has(r.id) ? { backgroundColor: 'rgba(250,255,105,.16)' } : false}
                      animate={{ backgroundColor: 'rgba(250,255,105,0)' }}
                      transition={{ duration: 1.8 }}
                      onClick={() => setOpen(open === r.id ? null : r.id)}
                      aria-expanded={open === r.id}
                      className={`cursor-pointer border-b border-hairline align-top transition-colors hover:bg-surface-elevated ${open === r.id ? 'bg-surface-elevated' : ''}`}
                      data-testid="audit-row"
                    >
                      <td className="t-code whitespace-nowrap px-4 py-3.5 !text-[12.5px] text-muted">{new Date(r.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                      <td className="px-4 py-3.5">
                        <span className="flex items-center gap-2 whitespace-nowrap text-ink"><span className="text-primary"><AgentIcon id={(r.agent ?? 'expert') as AgentId} size={15} /></span><span className="text-[13.5px] font-semibold">{AGENT_NAME[r.agent ?? 'expert']}</span></span>
                        <span className="mt-1 block text-[12px] text-muted">{r.user_name}</span>
                      </td>
                      <td lang={langOf(r.question)} className="t-body-sm max-w-[26em] px-4 py-3.5 text-body-strong"><span className="line-clamp-3 whitespace-pre-line">{r.question}</span></td>
                      <td className="t-title-sm px-4 py-3.5 tabular-nums text-body">{r.retrieved.length}</td>
                      <td className="t-title-sm px-4 py-3.5 tabular-nums text-body">{r.cited.length}</td>
                      <td className="px-4 py-3.5">
                        <span className="flex flex-col items-start gap-1">
                          {r.error ? <span className="badge !bg-rose/15 !text-rose">Endpoint error</span>
                            : r.refused ? <span className="badge !text-muted">Refused</span>
                            : <span className="badge !bg-emerald/15 !text-emerald">Answered</span>}
                          {!r.injection_defence && <span className="badge !bg-warning/15 !text-warning">Defence off</span>}
                          {r.flags.length > 0 && <span className="badge !bg-warning/15 !text-warning">{r.flags.length} flag{r.flags.length > 1 ? 's' : ''}</span>}
                        </span>
                      </td>
                      <td className="t-caption whitespace-nowrap px-4 py-3.5 text-body">{r.endpoint_label}</td>
                      <td className="t-code whitespace-nowrap px-4 py-3.5 !text-[12.5px] text-ink">{formatMs(r.latency_ms)}</td>
                    </motion.tr>
                    {open === r.id && (
                      <tr className="border-b border-hairline bg-surface-soft">
                        <td colSpan={8} className="px-4 py-5">
                          <div className="grid gap-6 md:grid-cols-2">
                            <div>
                              <p className="t-label text-muted">Answer</p>
                              <p lang={langOf(r.answer)} className="t-body-sm mt-2 whitespace-pre-line text-body">{r.answer}</p>
                            </div>
                            <div className="space-y-4">
                              <div>
                                <p className="t-label text-muted">Retrieved passages</p>
                                {r.retrieved.length === 0 ? <p className="t-body-sm mt-2 text-muted">None. Nothing this user can read matched.</p> : (
                                  <ul className="mt-2 space-y-1">
                                    {r.retrieved.map((id) => (
                                      <li key={id} className={`t-code flex items-center gap-2 !text-[12.5px] ${r.cited.includes(id) ? 'text-ink' : 'text-muted'}`}>
                                        {id}{r.cited.includes(id) && <span className="badge badge-yellow !h-5">cited</span>}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                              {r.flags.length > 0 && (
                                <div>
                                  <p className="t-label text-muted">Flags</p>
                                  {r.flags.map((f, i) => <p key={i} className="t-caption mt-1 text-warning">{flagLabel(f.type)} <span className="t-code !text-[12px] text-muted">{f.value}</span></p>)}
                                </div>
                              )}
                              <p className="t-code !text-[12px] text-muted-soft">{r.model} at {r.endpoint_url}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
