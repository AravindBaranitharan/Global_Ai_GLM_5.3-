import { expect, test, type Page } from '@playwright/test'

// Runs against the real API on :8010 with the two sample PDFs from test_docs/ uploaded.
// Only /api/ask is intercepted, so no paid LLM call is ever made.
const SHOTS = process.env.SHOTS_DIR
const shot = async (page: Page, name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }) }

const STD = 'uploads-secure-python-service-standard'
const source = (label: string, text: string, page = 2) => ({
  label, chunk_id: `${STD}:p${page}:c1`, doc_id: STD, title: 'Secure Python Service Standard', page, text,
  bboxes: [], lines: [], source_type: 'digital', quarantined: false, flags: [], score: 0.96,
})
const reply = (over: Record<string, unknown>) => ({
  refused: false, lang: 'en', flags: [], invalid_citations: [], endpoint_label: 'Cloud endpoint', model: 'glm-5.3-flash',
  latency_ms: 2140, llm_latency_ms: 1820, injection_defence: true, audit_id: null, error: null, agent: 'expert', checks: [],
  citations: [], retrieved: [], ...over,
})
async function mockAsk(page: Page, body: object, delay = 900) {
  await page.route('**/api/ask', async (route) => { await new Promise((r) => setTimeout(r, delay)); await route.fulfill({ json: body }) })
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLEERR', m.text().slice(0, 300)))
  await page.request.post('/api/settings/injection-defence', { data: { enabled: true } })
})

test('hero chat with the documents drawer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('domain-picker')).toBeVisible()
  await expect(page.getByTestId('user-card')).toContainText('Aravind Baranitharan')
  await page.waitForTimeout(500)
  await shot(page, '00-domain-picker')
  await page.getByTestId('domain-aws').click()
  await expect(page.getByTestId('domain-docs')).toContainText('AWS Security and Identity')
  await page.waitForTimeout(500)
  await shot(page, '00b-domain-hero')
  await expect(page.getByTestId('documents-button')).toContainText(/\d+/)
  await page.waitForTimeout(600)
  await shot(page, '01-hero')

  await page.getByTestId('documents-button').click()
  await expect(page.getByTestId('document-row').first()).toBeVisible()
  expect(await page.getByTestId('document-row').count()).toBeGreaterThanOrEqual(2)
  await page.getByTestId('quarantine-badge').first().click()
  await expect(page.getByTestId('quarantine-text').first()).toContainText(/ignore all previous instructions|system override/i)
  await page.waitForTimeout(500)
  await shot(page, '02-documents')
})

test('domain expert answer with sources', async ({ page }) => {
  const s1 = source('S1', 'CR-01 Retries use exponential backoff with jitter: at most 3 attempts, base delay 200 milliseconds, maximum delay 5 seconds. Only idempotent operations may be retried automatically.')
  const s2 = source('S2', 'SEC-31 Every outbound network call sets an explicit timeout. The default is 10 seconds for HTTP calls and 5 seconds for database connections.', 3)
  await mockAsk(page, reply({
    answer: 'Retries must use exponential backoff with jitter, with **at most 3 attempts**, a 200 ms base delay and a 5 s maximum delay [S1]. Only idempotent operations may be retried automatically [S1].\n\nEvery outbound call also needs an explicit timeout: 10 s for HTTP and 5 s for database connections [S2].',
    citations: [s1, s2], retrieved: [s1, s2],
  }))
  await page.goto('/')
  await page.getByTestId('domain-software_engineering').click()
  await page.getByTestId('question-input').fill('What does the standard say about retries and backoff?')
  await expect(page.getByRole('button', { name: /Send/ })).toBeEnabled()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('pipeline')).toBeVisible()
  await shot(page, '03-pending')
  await expect(page.getByTestId('answer')).toContainText('at most 3 attempts')
  await page.getByRole('button', { name: /Source S1:/ }).first().click()
  await expect(page.getByTestId('source-text')).toContainText('CR-01')
  await page.waitForTimeout(500)
  await shot(page, '04-expert-answer')
})

test('code reviewer on the refund function', async ({ page }) => {
  const s1 = source('S1', 'SEC-10 All SQL must use parameterised queries or the ORM. Building SQL with f-strings ... is forbidden.')
  const s2 = source('S2', 'SEC-01 Secrets ... must never appear in source code ... Load them at runtime from the secrets manager.', 1)
  const s3 = source('S3', 'SEC-30 ... Certificate verification must never be disabled (verify=False), including in staging.', 3)
  await mockAsk(page, reply({
    agent: 'code_review', citations: [s1, s2, s3], retrieved: [s1, s2, s3],
    answer: '**Verdict:** Request changes. The function has three blocking security violations.\n\n**Findings**\n1. **High** · line 3 · API key hard-coded in source; load it from the secrets manager [S2].\n2. **High** · line 6 · SQL built with an f-string; use a parameterised query [S1].\n3. **High** · line 10 · `verify=False` disables TLS verification [S3].\n4. **High** · line 14 · `shell=True` with user input allows command injection (general practice).\n5. **Medium** · line 11 · bare `except: pass` hides failures and leaves `r` undefined (general practice).\n\n**Suggested change**\n```python\nrow = db.execute("SELECT * FROM orders WHERE id = %s", (order_id,)).fetchone()\nr = requests.post(REFUNDS_URL, json=body, headers=auth_headers(), timeout=10)\nsubprocess.run(["notify-team", str(order_id)], check=True)\n```',
  }))
  await page.goto('/')
  await page.getByTestId('agent-code_review').click()
  await page.getByRole('button', { name: /Review this function/ }).click()
  await expect(page.getByTestId('answer')).toContainText('Request changes')
  await expect(page.getByTestId('code-block')).toHaveCount(2)
  await page.waitForTimeout(700)
  await shot(page, '05-code-review')
})

test('security agent with static scan', async ({ page }) => {
  await mockAsk(page, reply({
    agent: 'security',
    checks: [{ rule: 'pickle-load', severity: 'High', line: 3, snippet: 'payload = pickle.loads(req.body)', message: 'Unpickling untrusted data allows code execution.' }],
    answer: '**Risk:** High. The handler deserialises attacker-controlled data before checking the signature.\n\n**Findings**\n1. **High** · line 3 · `pickle.loads` on the request body allows remote code execution; parse JSON instead (general practice).\n2. **High** · line 5 · signature compared with `==`; use `hmac.compare_digest` (general practice).\n3. **Medium** · handler never checks `X-Timestamp`, so old webhooks can be replayed (general practice).',
  }))
  await page.goto('/')
  await page.getByTestId('agent-security').click()
  await page.getByRole('button', { name: /Check this webhook handler/ }).click()
  await expect(page.getByTestId('scan')).toContainText('pickle-load')
  await page.waitForTimeout(700)
  await shot(page, '06-security')
})

test('audit and model views', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Audit trail' }).click()
  await expect(page.getByRole('heading', { name: 'Audit trail' })).toBeVisible()
  await shot(page, '07-audit')
  await page.getByRole('button', { name: 'Model', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'GLM-5.3-Flash' })).toBeVisible()
})

test('works at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByTestId('domain-picker')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false)
  await page.getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByTestId('agent-security')).toBeVisible()
  await shot(page, '08-mobile-menu')
})
