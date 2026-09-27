import { useState, type ReactNode } from 'react'
import { parseAnswer, type Inline } from '../lib/answer'
import { TeX } from './TeX'

type Props = {
  text: string
  /** Renders a citation label; omit to drop citations. */
  cite?: (label: string, key: number) => ReactNode
  /** Wraps each block, e.g. for staggered reveal. */
  wrap?: (block: ReactNode, key: number) => ReactNode
}

/** Paragraphs, headings, lists, tables and code from model output. */
export function RichText({ text, cite, wrap = (b) => b }: Props) {
  const inl = (xs: Inline[]) => xs.map((x, i) => {
    if (x.kind === 'text') return <span key={i}>{x.text}</span>
    if (x.kind === 'em') return <strong key={i} className="font-semibold text-ink">{x.text}</strong>
    if (x.kind === 'i') return <em key={i} className="italic">{x.text}</em>
    if (x.kind === 'math') return <TeX key={i} tex={x.tex} display={x.display} />
    if (x.kind === 'code') return <code key={i} className="rounded-[5px] border border-hairline bg-surface-soft px-1.5 py-0.5 font-mono text-[0.84em] text-twilight">{x.text}</code>
    return cite ? cite(x.label, i) : null
  })
  return (
    <>
      {parseAnswer(text).map((b, i) => (
        <div key={i}>
          {wrap(
            <>
              {b.kind === 'p' && <p>{inl(b.inlines)}</p>}
              {b.kind === 'h' && <p className="t-title-sm pt-2 text-ink">{inl(b.inlines)}</p>}
              {(b.kind === 'ul' || b.kind === 'ol') && (
                <ol className="space-y-2">
                  {b.items.map((it, j) => (
                    <li key={j} className="grid grid-cols-[1.8em_1fr]">
                      <span className="pt-[3px] font-mono text-[12px] text-muted">{b.kind === 'ol' ? `${j + 1}.` : '•'}</span>
                      <span>{inl(it)}</span>
                    </li>
                  ))}
                </ol>
              )}
              {b.kind === 'table' && (
                <div className="overflow-x-auto rounded-md border border-hairline">
                  <table className="t-body-sm w-full border-collapse">
                    <thead><tr>{b.header.map((h, j) => <th key={j} className="t-label border-b border-hairline bg-surface-soft px-3 py-2 text-left text-muted">{inl(h)}</th>)}</tr></thead>
                    <tbody>{b.rows.map((row, j) => <tr key={j} className="border-b border-hairline last:border-b-0">{row.map((c, k) => <td key={k} className="px-3 py-2 align-top">{statusBadge(c) ?? inl(c)}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {b.kind === 'code' && <CodeBlock lang={b.lang} code={b.code} />}
              {b.kind === 'math' && <TeX tex={b.tex} display />}
            </>,
            i,
          )}
        </div>
      ))}
    </>
  )
}

const STATUS: Record<string, string> = {
  pass: 'bg-emerald/15 text-emerald', fail: 'bg-rose/15 text-rose', partial: 'bg-warning/15 text-warning',
  'not applicable': 'bg-surface-elevated text-muted', 'n/a': 'bg-surface-elevated text-muted',
  critical: 'bg-rose text-canvas', high: 'bg-rose/15 text-rose', medium: 'bg-warning/15 text-warning', low: 'bg-blue/15 text-blue',
}

/** Table cells that hold only a status or severity render as a coloured badge. */
function statusBadge(cell: Inline[]): ReactNode | null {
  const t = cell.map((x) => ('text' in x ? x.text : '')).join('').replace(/\*/g, '').trim()
  const cls = STATUS[t.toLowerCase()]
  return cls ? <span className={`badge !h-6 !px-2.5 !text-[11.5px] ${cls}`} data-testid="status-badge">{t}</span> : null
}

export function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }).catch(() => {})
  }
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-[#111214]" data-testid="code-block">
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2">
        <span className="font-mono text-[11px] uppercase tracking-[1.2px] text-muted">{lang || 'code'}</span>
        <button onClick={copy} className="rounded-full px-2 font-mono text-[11.5px] text-white/60 transition-colors hover:bg-white/10 hover:text-white">{copied ? 'copied' : 'copy'}</button>
      </div>
      <pre className="t-code overflow-x-auto px-4 py-3 text-body">{code}</pre>
    </div>
  )
}
