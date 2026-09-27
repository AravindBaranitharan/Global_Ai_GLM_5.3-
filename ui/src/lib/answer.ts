/**
 * Turns a model answer into render blocks. Handles paragraphs, bullet and
 * numbered lists, simple Markdown tables, **bold**, *italics*, LaTeX math
 * ($…$, $$…$$, \(…\), \[…\]) and [S1] citations.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'em'; text: string }
  | { kind: 'i'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'math'; tex: string; display: boolean }
  | { kind: 'cite'; label: string }

export type Block =
  | { kind: 'p'; inlines: Inline[] }
  | { kind: 'ul' | 'ol'; items: Inline[][] }
  | { kind: 'table'; header: Inline[][]; rows: Inline[][][] }
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'h'; inlines: Inline[] }
  | { kind: 'math'; tex: string }

// [S1]  [S1, S3]  and annotated forms such as [S1 §2] or [S2: DP-04]
const CITE_GROUP = /\[\s*S\d+\b[^\]\n]{0,60}\]/gi
// $$display$$, \[display\], $inline$, \(inline\). Inline $…$ must hug its content ("$x$", not "$ 5 and $")
// so prices such as "$5 and $10" stay text.
const MATH_INLINE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(?<![\\$\w])\$(?![\s$])([^$\n]{1,300}?)(?<![\s\\])\$(?![\d$])|\\\(([\s\S]+?)\\\)/g
const CURRENCY = /^[\d.,\s\-–]+$/
// *italics*, not bullets, not **bold**, not a * b arithmetic
const ITALIC = /(?<![\w*\\])\*(?![\s*])([^*\n]+?)(?<![\s\\])\*(?![\w*])/g

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  const pushText = (t: string) => {
    // `code` first, then math, then **bold** and *italics*
    t.split(/`([^`]+)`/g).forEach((seg, j) => {
      if (!seg) return
      if (j % 2) { out.push({ kind: 'code', text: seg }); return }
      let at = 0
      for (const m of seg.matchAll(MATH_INLINE)) {
        const tex = m[1] ?? m[2] ?? m[3] ?? m[4]
        if (m[3] !== undefined && CURRENCY.test(tex)) continue    // "$5-$10" is money, not math
        pushStyled(seg.slice(at, m.index))
        out.push({ kind: 'math', tex: tex.trim(), display: m[1] !== undefined || m[2] !== undefined })
        at = (m.index ?? 0) + m[0].length
      }
      pushStyled(seg.slice(at))
    })
  }
  const pushStyled = (t: string) => {
    t.split(/\*\*(.+?)\*\*/g).forEach((part, i) => {
      if (!part) return
      if (i % 2) { out.push({ kind: 'em', text: part }); return }
      part.split(ITALIC).forEach((p, k) => {
        if (p) out.push(k % 2 ? { kind: 'i', text: p } : { kind: 'text', text: p })
      })
    })
  }
  for (const m of text.matchAll(CITE_GROUP)) {
    pushText(text.slice(last, m.index))
    for (const lm of m[0].matchAll(/\bS(\d+)\b|[,;]\s*(\d+)\b/gi)) out.push({ kind: 'cite', label: `S${lm[1] ?? lm[2]}` })
    last = (m.index ?? 0) + m[0].length
  }
  pushText(text.slice(last))
  // Tidy spaces left before punctuation once citations are pulled out
  return out.map((t, i) => {
    if (t.kind !== 'text') return t
    const next = out[i + 1]
    return next?.kind === 'cite' ? { ...t, text: t.text.replace(/\s+$/, '') } : t
  })
}

const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l)
const isDivider = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l)
const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim()))

export function parseAnswer(answer: string): Block[] {
  const blocks: Block[] = []
  const lines = answer.replace(/\r/g, '').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const fence = /^\s*```\s*([\w+-]*)\s*$/.exec(line)
    if (fence) {
      const code: string[] = []
      i++
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++])
      i++ // closing fence (or end of text)
      blocks.push({ kind: 'code', lang: fence[1] || '', code: code.join('\n') })
      continue
    }
    // $$ … $$ or \[ … \] on their own lines: a display formula block
    const open = /^\s*(\$\$|\\\[)/.exec(line)
    if (open) {
      const close = open[1] === '$$' ? '$$' : '\\]'
      const first = line.trim().slice(2)
      const tex: string[] = []
      if (first.includes(close)) {
        const end = first.indexOf(close)
        const rest = first.slice(end + 2).trim()
        tex.push(first.slice(0, end))
        i++
        blocks.push({ kind: 'math', tex: tex.join('\n').trim() })
        if (rest) blocks.push({ kind: 'p', inlines: parseInline(rest) })
        continue
      }
      if (first) tex.push(first)
      i++
      while (i < lines.length && !lines[i].includes(close)) tex.push(lines[i++])
      if (i < lines.length) tex.push(lines[i].slice(0, lines[i].indexOf(close)))
      i++
      blocks.push({ kind: 'math', tex: tex.join('\n').trim() })
      continue
    }
    const heading = /^\s*#{1,4}\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ kind: 'h', inlines: parseInline(heading[1]) })
      i++
      continue
    }

    if (isRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const header = cells(line)
      const rows: Inline[][][] = []
      i += 2
      while (i < lines.length && isRow(lines[i])) rows.push(cells(lines[i++]))
      blocks.push({ kind: 'table', header, rows })
      continue
    }

    const bullet = /^\s*[-*•]\s+(.*)$/
    const numbered = /^\s*\d+[.)]\s+(.*)$/
    for (const [re, kind] of [[bullet, 'ul'], [numbered, 'ol']] as const) {
      if (re.test(line)) {
        const items: Inline[][] = []
        while (i < lines.length && re.test(lines[i])) items.push(parseInline(lines[i++].replace(re, '$1')))
        blocks.push({ kind, items })
        break
      }
    }
    if (i < lines.length && lines[i] === line) {
      const para: string[] = []
      while (i < lines.length && lines[i].trim() && !bullet.test(lines[i]) && !numbered.test(lines[i]) && !isRow(lines[i]) && !/^\s*(```|#{1,4}\s|\$\$|\\\[)/.test(lines[i])) {
        para.push(lines[i++].trim())
      }
      if (!para.length) para.push(lines[i++].trim())
      blocks.push({ kind: 'p', inlines: parseInline(para.join(' ')) })
    }
  }
  return blocks
}

/** Union box of several normalised [x0,y0,x1,y1] boxes. */
export function unionBox(boxes: number[][]): number[] | null {
  if (!boxes.length) return null
  return [
    Math.min(...boxes.map((b) => b[0])),
    Math.min(...boxes.map((b) => b[1])),
    Math.max(...boxes.map((b) => b[2])),
    Math.max(...boxes.map((b) => b[3])),
  ]
}

export type View = { pageW: number; pageH: number; frameW: number; frameH: number }

/**
 * Zoom that frames a region of the page inside the viewing frame. Works in pixels:
 * the fitted page is usually narrower than the frame, so there is room to grow.
 * Returns a scale and a translate in % of the page element (transform origin: centre).
 */
export function focusTransform(box: number[] | null, maxScale = 2.2, view?: View): { scale: number; x: number; y: number } {
  if (!box) return { scale: 1, x: 0, y: 0 }
  const v = view ?? { pageW: 1, pageH: 1, frameW: 1, frameH: 1 }
  const [x0, y0, x1, y1] = box
  const rw = Math.max(x1 - x0, 0.05) * v.pageW
  const rh = Math.max(y1 - y0, 0.02) * v.pageH
  const scale = Math.max(1, Math.min(maxScale, (0.9 * v.frameW) / rw, (0.45 * v.frameH) / rh))
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  // Move the region to the frame centre, but never pull a page edge further in than needed.
  const shift = (c: number, page: number, frame: number) => {
    const want = (0.5 - c) * scale * page
    const limit = Math.abs(scale * page - frame) / 2
    return (Math.max(-limit, Math.min(limit, want)) / page) * 100
  }
  return { scale, x: shift(cx, v.pageW, v.frameW), y: shift(cy, v.pageH, v.frameH) }
}

export const isTamil = (s: string) => /[஀-௿]/.test(s)

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—'
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`
}

const FLAG_TEXT: Record<string, string> = {
  quarantined_chunk_used: 'Hidden text reached the model',
  invalid_citations: 'Invented citation removed',
  unexpected_url: 'Unrequested link',
  unexpected_email: 'Unrequested email address',
  unexpected_phone: 'Unrequested phone number',
}
export const flagLabel = (type: string) => FLAG_TEXT[type] ?? type.replace(/_/g, ' ')

const STOP = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that', 'are', 'was', 'were', 'has', 'have', 'our', 'your', 'you', 'its', 'per', 'all', 'any', 'can', 'will', 'not', 'but', 'into', 'including', 'which', 'what', 'when'])

/** Word and number tokens; numbers lose their separators so 1,65,200.00 matches 165200.00. */
export function factTokens(text: string): { words: Set<string>; numbers: Set<string> } {
  const clean = text.replace(CITE_GROUP, ' ')
  const numbers = new Set<string>()
  for (const m of clean.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = m[0].replace(/,/g, '').replace(/\.0+$/, '')
    if (n.length >= 2) numbers.add(n)
  }
  const words = new Set<string>()
  for (const m of clean.toLowerCase().matchAll(/[a-z\u0B80-\u0BFF]{3,}/g)) {
    if (STOP.has(m[0])) continue
    words.add(/^[a-z]{4,}s$/.test(m[0]) ? m[0].slice(0, -1) : m[0]) // totals -> total
  }
  return { words, numbers }
}

/**
 * The lines of a cited passage that carry the answer's facts. Numbers weigh most
 * (totals, dates, limits). Falls back to null when nothing stands out, so the
 * caller can highlight the whole passage instead.
 */
export function pickLines(answer: string, lines: { b: number[]; t: string }[], max = 4, context = ''): number[][] | null {
  if (!lines.length) return null
  const a = factTokens(answer)
  // Words already in the document title (vendor, policy name) locate the document, not the fact.
  factTokens(context).words.forEach((w) => a.words.delete(w))
  const scored = lines.map((l) => {
    const t = factTokens(l.t)
    let score = 0
    t.numbers.forEach((n) => { if (a.numbers.has(n)) score += 3 })
    t.words.forEach((w) => { if (a.words.has(w)) score += 1 })
    return { b: l.b, score }
  })
  const best = Math.max(...scored.map((x) => x.score))
  if (best < 3) return null
  return scored.filter((x) => x.score >= best * 0.6).sort((x, y) => y.score - x.score).slice(0, max).map((x) => x.b)
}
