import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { RedTeamAttack, RedTeamResult, RedTeamSummary } from '../api'
import { flagLabel, formatMs } from '../lib/answer'

export type RedTeamState = {
  planning: boolean
  attacks: RedTeamAttack[]
  results: RedTeamResult[]
  current: number | null
  summary: RedTeamSummary | null
}

export const emptyRedTeam = (): RedTeamState => ({ planning: true, attacks: [], results: [], current: null, summary: null })

const EASE = [0.2, 0.8, 0.2, 1] as const

function Verdict({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`badge !h-6 !px-2.5 !text-[11.5px] ${ok ? '!bg-rose/15 !text-rose' : '!bg-emerald/15 !text-emerald'}`}>{label}</span>
}

/** Live scorecard: every attack, what happened with the defence off and on, and which layer stopped it. */
export function RedTeamView({ state }: { state: RedTeamState }) {
  const [open, setOpen] = useState<number | null>(null)
  const byIndex = new Map(state.results.map((r) => [r.index, r]))
  const s = state.summary
  const doneCount = state.results.length
  const blockedOn = s ? s.attacks - s.succeeded_on : state.results.filter((r) => !r.on.succeeded).length

  return (
    <div className="mt-2 space-y-4" data-testid="redteam">
      <div className="grid grid-cols-3 gap-3">
        {[
          [s ? s.attacks : state.attacks.length || '…', 'attacks'],
          [s ? s.succeeded_off : state.results.filter((r) => r.off.succeeded).length, 'got through with defence off'],
          [s ? s.succeeded_on : state.results.filter((r) => r.on.succeeded).length, 'got through with defence on'],
        ].map(([v, l], i) => (
          <div key={l as string} className="card p-4">
            <p className={`font-serif text-[40px] font-medium leading-none tracking-[-0.02em] tabular-nums ${i === 0 ? 'text-brand' : i === 1 ? 'text-warning' : Number(v) > 0 ? 'text-rose' : 'text-primary'}`}>{v}</p>
            <p className="mt-2 text-[12.5px] text-muted">{l}</p>
          </div>
        ))}
      </div>

      {state.planning && (
        <div className="card t-code px-4 py-3" data-testid="redteam-planning">
          <span className="text-primary">plan</span> <span className="text-ink">GLM-5.3-Flash is writing attacks for your documents</span><span className="animate-blink ml-1 text-primary">▌</span>
        </div>
      )}

      {state.attacks.length > 0 && (
        <ol className="card divide-y divide-hairline overflow-hidden" data-testid="redteam-attacks">
          {state.attacks.map((a, i) => {
            const r = byIndex.get(i)
            const running = state.current === i && !r
            return (
              <li key={i}>
                <button onClick={() => r && setOpen(open === i ? null : i)} className="grid w-full grid-cols-[1.6rem_1fr_auto] items-start gap-3 px-4 py-3 text-left" aria-expanded={open === i} disabled={!r}>
                  <span className="pt-0.5 font-mono text-[12px] text-muted">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold text-ink">{a.technique}</span>
                      <span className="badge !h-5 !bg-canvas !px-2 !text-[10.5px] !text-muted">{a.origin === 'seed' ? 'built-in' : 'written by GLM'}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] text-body">{a.prompt}</span>
                    {r?.blocked_by && <span className="mt-1.5 block text-[12.5px] text-emerald">Stopped by: {r.blocked_by}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    {r ? (
                      <>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted">off <Verdict ok={r.off.succeeded} label={r.off.succeeded ? 'got through' : 'held'} /></span>
                        <span className="flex items-center gap-1.5 text-[11px] text-muted">on <Verdict ok={r.on.succeeded} label={r.on.succeeded ? 'got through' : 'blocked'} /></span>
                      </>
                    ) : running ? (
                      <span className="flex items-center gap-2 font-mono text-[12px] text-primary"><span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-dot" />attacking</span>
                    ) : (
                      <span className="font-mono text-[12px] text-muted-soft">queued</span>
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {open === i && r && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
                      <div className="grid gap-3 border-t border-hairline bg-canvas px-4 py-3 md:grid-cols-2">
                        {(['off', 'on'] as const).map((m) => (
                          <div key={m}>
                            <p className="t-label !text-[10.5px] text-muted">Defence {m} · {formatMs(r[m].latency_ms)}</p>
                            <p className="mt-1 whitespace-pre-line text-[13px] text-body">{r[m].answer || '(empty)'}</p>
                            {r[m].flags.map((f, j) => <p key={j} className="mt-1 text-[12px] text-warning">{flagLabel(f.type)}</p>)}
                          </div>
                        ))}
                        <p className="font-mono text-[11.5px] text-muted-soft md:col-span-2">success markers: {a.markers.join(', ')}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            )
          })}
        </ol>
      )}

      {s && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`rounded-[12px] p-6 ${s.succeeded_on === 0 ? 'relative overflow-hidden bg-house text-white ring-2 ring-gold' : 'border border-rose/40 bg-rose/10 text-ink'}`} data-testid="redteam-summary">
          {s.succeeded_on === 0 && (
            <motion.span className="badge-gold badge mb-3" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>★ Defence held</motion.span>
          )}
          <p className="font-serif text-[26px] font-medium leading-snug">
            {s.succeeded_on === 0 ? `All ${s.attacks} attacks blocked with the defence on.` : `${s.succeeded_on} of ${s.attacks} attacks still got through with the defence on.`}
          </p>
          <p className="mt-1 text-[14px] opacity-75">
            {s.succeeded_off} got through with the defence off. {blockedOn} blocked with it on. {s.llm_calls} model calls. Every run is in the audit trail.
          </p>
        </motion.div>
      )}
      {!s && doneCount > 0 && <p className="font-mono text-[12px] text-muted">{doneCount} of {state.attacks.length} attacks run</p>}
    </div>
  )
}
