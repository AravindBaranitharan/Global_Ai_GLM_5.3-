import katex from 'katex'
import 'katex/dist/katex.min.css'
import { memo } from 'react'

/** LaTeX rendered with KaTeX. Bad input shows as the raw source instead of breaking the answer. */
export const TeX = memo(function TeX({ tex, display = false }: { tex: string; display?: boolean }) {
  // KaTeX escapes its input and runs with trust off, so model output cannot inject markup here.
  const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false, output: 'html' })
  return display
    ? <div className="math-block" data-testid="math" dangerouslySetInnerHTML={{ __html: html }} />
    : <span className="math-inline" data-testid="math" dangerouslySetInnerHTML={{ __html: html }} />
})
