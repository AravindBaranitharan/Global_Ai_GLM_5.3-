import { render } from '@testing-library/react'
import { RichText } from './RichText'

it('renders LaTeX with KaTeX and italics as <em>, with no raw delimiters left', () => {
  const { container } = render(<RichText text={'A cross-encoder reads them *together*:\n\n$$s(q, d) = f_\\theta([q; d])$$\n\nwhere $\\tau$ is a threshold.'} />)
  expect(container.querySelectorAll('.katex').length).toBe(2)
  expect(container.querySelector('.math-block .katex-display')).not.toBeNull()
  expect(container.querySelector('em')?.textContent).toBe('together')
  expect(container.textContent).not.toMatch(/\$|\\theta|\*/)
})

it('shows malformed LaTeX as an error span instead of throwing', () => {
  const { container } = render(<RichText text={'Broken: $\\frac{1}{$ here'} />)
  expect(container.textContent).toContain('Broken')
})
