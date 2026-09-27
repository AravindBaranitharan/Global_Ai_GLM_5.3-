import { focusTransform, parseAnswer, parseInline, pickLines, unionBox } from './answer'

describe('parseInline', () => {
  it('pulls citations out and trims the space before them', () => {
    expect(parseInline('Casual leave is 12 days [S1].')).toEqual([
      { kind: 'text', text: 'Casual leave is 12 days' },
      { kind: 'cite', label: 'S1' },
      { kind: 'text', text: '.' },
    ])
  })

  it('expands grouped citations', () => {
    const cites = parseInline('Both apply [S2, S4][S5].').filter((x) => x.kind === 'cite')
    expect(cites.map((c) => (c as { label: string }).label)).toEqual(['S2', 'S4', 'S5'])
  })

  it('reads annotated citations such as [S1 §2] and [S2: DP-04]', () => {
    const cites = parseInline('Rule one [S1 §2]. Rule two [S2: DP-04]. Both [S1, 3].').filter((x) => x.kind === 'cite')
    expect(cites.map((c) => (c as { label: string }).label)).toEqual(['S1', 'S2', 'S1', 'S3'])
    expect(parseInline('Use an S3 bucket').every((x) => x.kind !== 'cite')).toBe(true)
  })

  it('turns **emphasis** into em, never bold', () => {
    expect(parseInline('The **total** is due')).toContainEqual({ kind: 'em', text: 'total' })
  })
})

describe('parseAnswer', () => {
  it('splits paragraphs, bullets and numbered lists', () => {
    const blocks = parseAnswer('Intro line.\n\n- one [S1]\n- two\n\n1. first\n2. second\n\nOutro.')
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'ul', 'ol', 'p'])
  })

  it('parses a markdown table', () => {
    const [t] = parseAnswer('| Item | Amount |\n|---|---|\n| Boxes | 76,000 |\n| Total | 1,65,200 [S1] |')
    expect(t.kind).toBe('table')
    if (t.kind === 'table') {
      expect(t.rows).toHaveLength(2)
      expect(t.rows[1][1]).toContainEqual({ kind: 'cite', label: 'S1' })
    }
  })

  it('keeps Tamil text intact', () => {
    const [p] = parseAnswer('அலுவலகம் ஜனவரி 19 அன்று செயல்படும் [S1].')
    expect(p.kind === 'p' && p.inlines[0]).toEqual({ kind: 'text', text: 'அலுவலகம் ஜனவரி 19 அன்று செயல்படும்' })
  })
})

describe('geometry', () => {
  it('unions boxes', () => {
    expect(unionBox([[0.1, 0.2, 0.3, 0.4], [0.2, 0.1, 0.5, 0.3]])).toEqual([0.1, 0.1, 0.5, 0.4])
    expect(unionBox([])).toBeNull()
  })

  it('does not zoom without a region', () => {
    expect(focusTransform(null)).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('zooms into a small region and keeps the page edge in view', () => {
    const f = focusTransform([0.7, 0.45, 0.95, 0.5])
    expect(f.scale).toBeGreaterThan(1.5)
    expect(f.scale).toBeLessThanOrEqual(2.2)
    expect(f.x).toBeLessThan(0) // region is right of centre, so the page moves left
    expect(Math.abs(f.x)).toBeLessThanOrEqual(((f.scale - 1) / 2) * 100 + 1e-9)
  })

  it('uses spare frame width to zoom into a wide row', () => {
    // Page fitted by height: 280px wide inside an 800px frame.
    const view = { pageW: 280, pageH: 386, frameW: 800, frameH: 418 }
    const f = focusTransform([0.15, 0.42, 0.88, 0.45], 2.4, view)
    expect(f.scale).toBeGreaterThan(2)
    const rowCentreAfter = (0.5 - 0.435) * f.scale * view.pageH + (f.y / 100) * view.pageH
    expect(Math.abs(rowCentreAfter)).toBeLessThan(view.frameH * 0.3) // row ends up near the middle
  })
})

describe('pickLines', () => {
  const invoice = [
    { b: [0.1, 0.20, 0.9, 0.22], t: 'Invoice No: SMP/2025/1043 Invoice Date: 14 October 2025' },
    { b: [0.1, 0.30, 0.9, 0.32], t: '1 Corrugated boxes, 5-ply 2,000 38.00 76,000.00' },
    { b: [0.1, 0.40, 0.9, 0.42], t: 'CGST 9% 12,600.00' },
    { b: [0.1, 0.44, 0.9, 0.46], t: 'TOTAL 1,65,200.00' },
  ]

  it('finds the line holding the answer figure', () => {
    const got = pickLines('The invoice total is ₹1,65,200.00 [S1].', invoice)
    expect(got).toEqual([[0.1, 0.44, 0.9, 0.46]])
  })

  it('returns null when the answer shares no strong facts with the lines', () => {
    expect(pickLines('It is a packaging supplier [S1].', invoice)).toBeNull()
  })

  it('matches Tamil words and dates', () => {
    const lines = [
      { b: [0, 0.1, 1, 0.12], t: 'அனைத்து ஊழியர்களுக்கும் வணக்கம்.' },
      { b: [0, 0.3, 1, 0.32], t: 'அலுவலகம் ஜனவரி 19 (திங்கள்) அன்று மீண்டும் வழக்கம் போல் செயல்படும்.' },
    ]
    expect(pickLines('அலுவலகம் ஜனவரி 19 (திங்கள்) அன்று மீண்டும் செயல்படும் [S1].', lines)).toEqual([[0, 0.3, 1, 0.32]])
  })
})

it('ignores words from the document title when picking lines', () => {
  const lines = [
    { b: [0.1, 0.1, 0.5, 0.12], t: 'Sri Murugan Packaging Industries' },
    { b: [0.1, 0.44, 0.9, 0.46], t: 'TOTAL 1,65,200.00' },
  ]
  const answer = 'The October invoice from Sri Murugan Packaging Industries totals ₹1,65,200.00 [S1].'
  expect(pickLines(answer, lines, 4, 'Sri Murugan Packaging Invoice, Oct 2025')).toEqual([[0.1, 0.44, 0.9, 0.46]])
})

describe('code in answers', () => {
  it('parses fenced code blocks and inline code', () => {
    const blocks = parseAnswer('**Verdict:** Request changes.\n\n```python\ncur.execute(q, (uid,))\n```\nUse `secrets` instead [S1].')
    expect(blocks.map((b) => b.kind)).toEqual(['p', 'code', 'p'])
    expect(blocks[1]).toEqual({ kind: 'code', lang: 'python', code: 'cur.execute(q, (uid,))' })
    expect(blocks[2].kind === 'p' && blocks[2].inlines).toContainEqual({ kind: 'code', text: 'secrets' })
  })

  it('reads markdown headings', () => {
    expect(parseAnswer('### Findings\n1. one')[0].kind).toBe('h')
  })
})
