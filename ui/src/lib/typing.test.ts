import { charsPerFrame, typedSlice } from './typing'

it('cuts at a word boundary', () => {
  expect(typedSlice('Reranking reorders passages', 4)).toBe('Reranking')
  expect(typedSlice('short', 99)).toBe('short')
})

it('closes open bold and code so partial markdown renders cleanly', () => {
  expect(typedSlice('A **very important point** here', 10)).toBe('A **very important**')
  const code = 'Run:\n```bash\npip install qdrant-client\nmore\n```\ndone'
  expect(typedSlice(code, 20)).toMatch(/```$/)
  expect((typedSlice(code, 20).match(/```/g) ?? []).length % 2).toBe(0)
})

it('holds back a half-typed citation', () => {
  expect(typedSlice('It is stateless [S1 · p4] and fast', 18)).toBe('It is stateless')
})

it('types long answers faster', () => {
  expect(charsPerFrame(100)).toBe(2)
  expect(charsPerFrame(3000)).toBe(10)
})

it('keeps bold closed when a citation is held back', () => {
  expect(typedSlice('A **key point [S1 · p4] here** end', 16)).toBe('A **key point**')
})

it('holds back a half-typed formula but not a price', () => {
  expect(typedSlice('Score:\n\n$$s(q, d) = \\cos(E_q, E_d)$$\n\nthen sort.', 14)).toBe('Score:')
  expect(typedSlice('Keep passages with $s \\geq \\tau$ only.', 22)).toBe('Keep passages with')
  expect(typedSlice('It costs $5 per hour and $10 per day.', 12)).toBe('It costs $5 per')
})
