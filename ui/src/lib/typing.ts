import { useEffect, useRef, useState } from 'react'

/**
 * The first `n` characters of an answer, cut at a word boundary and with any open markdown closed,
 * so a half-typed answer never shows stray `**` or an unterminated code block.
 */
export function typedSlice(text: string, n: number): string {
  if (n >= text.length) return text
  const next = text.slice(n).search(/\s/)
  let out = text.slice(0, next < 0 ? text.length : n + next)
  const fences = (out.match(/^```/gm) ?? []).length
  if (fences % 2 === 1) return `${out}\n\`\`\``
  // A half-typed citation like "[S1" would render as text; hold it back until it closes.
  out = out.replace(/\s*\[[^\]\n]{0,60}$/, '')
  // Half-typed math would show as raw LaTeX; hold it back from its opening delimiter until it closes.
  const display = [...out.matchAll(/\$\$/g)]
  if (display.length % 2) out = out.slice(0, display[display.length - 1].index).trimEnd()
  for (const [open, close] of [['\\[', '\\]'], ['\\(', '\\)']]) {
    const at = out.lastIndexOf(open)
    if (at >= 0 && out.indexOf(close, at) < 0) out = out.slice(0, at).trimEnd()
  }
  // A lone "$" that starts a formula ("$\tau", "$s(q") rather than a price ("$5").
  const lone = [...out.replace(/\$\$/g, '  ').matchAll(/\$/g)]
  if (lone.length % 2) {
    const at = lone[lone.length - 1].index
    if (/^\$[^\d\s]/.test(out.slice(at))) out = out.slice(0, at).trimEnd()
  }
  // Unclosed bold outside code blocks.
  const prose = out.replace(/```[\s\S]*?```/g, '')
  if ((prose.match(/\*\*/g) ?? []).length % 2 === 1) out += '**'
  return out
}

/** Characters revealed per frame: long answers type faster so none takes more than ~5 seconds. */
export const charsPerFrame = (length: number) => Math.max(2, Math.ceil(length / 300))

export function typingAllowed(): boolean {
  try {
    if (navigator.webdriver) return false
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/** Reveals `text` a few characters per animation frame. `skip()` jumps to the end. */
export function useTyping(text: string, active: boolean, onDone?: () => void, onTick?: () => void) {
  const [n, setN] = useState(active ? 0 : text.length)
  const done = n >= text.length
  const cb = useRef({ onDone, onTick })
  useEffect(() => { cb.current = { onDone, onTick } })

  useEffect(() => {
    if (!active) return
    const step = charsPerFrame(text.length)
    let raf = 0
    const tick = () => {
      setN((v) => {
        const next = Math.min(text.length, v + step)
        if (next < text.length) raf = requestAnimationFrame(tick)
        return next
      })
      cb.current.onTick?.()
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, text])

  useEffect(() => {
    if (active && done) cb.current.onDone?.()
  }, [active, done])

  return { shown: done ? text : typedSlice(text, n), done, skip: () => setN(text.length) }
}
