export type User = { id: string; name: string; title: string; groups: string[] }

export type Source = {
  label: string | null
  chunk_id: string
  doc_id: string
  title: string
  page: number
  text: string
  bboxes: number[][]
  lines?: { b: number[]; t: string }[]
  source_type: string
  quarantined: boolean
  flags: string[]
  score: number
}

export type Flag = { type: string; value: string }

export type AskResponse = {
  answer: string
  refused: boolean
  lang: string
  citations: Source[]
  retrieved: Source[]
  flags: Flag[]
  invalid_citations: string[]
  endpoint_label: string
  model: string
  latency_ms: number
  llm_latency_ms: number | null
  injection_defence: boolean
  audit_id: number | null
  error: string | null
  agent: AgentId
  checks: Check[]
  diagram?: string | null
  search_query?: string | null
}

export type RedTeamAttack = { technique: string; prompt: string; markers: string[]; origin: 'seed' | 'generated' }
export type RedTeamRun = { succeeded: boolean; refused: boolean; answer: string; flags: Flag[]; latency_ms: number }
export type RedTeamResult = { index: number; blocked_by: string | null; off: RedTeamRun; on: RedTeamRun }
export type RedTeamSummary = { attacks: number; succeeded_off: number; succeeded_on: number; llm_calls: number }
export type RedTeamEvent =
  | { step: 'planning' }
  | { step: 'plan'; attacks: RedTeamAttack[] }
  | { step: 'attack'; index: number }
  | ({ step: 'result' } & RedTeamResult)
  | ({ step: 'summary' } & RedTeamSummary)
  | { step: 'error'; message: string }

export type AgentId = 'expert' | 'code_review' | 'security' | 'threat_model' | 'compliance' | 'red_team'
export type Agent = { id: AgentId; name: string; tagline: string; kind?: 'chat' | 'exercise'; reads_diagram?: boolean }
export type Check = { rule: string; severity: 'High' | 'Medium' | 'Low'; line: number; snippet: string; message: string }
export type Document = { doc_id: string; title: string; rel_path: string; pages: number; source_types: string[]; chunks: number; domain: string; quarantined: QuarantineSpan[] }
export type Domain = { id: string; name: string; tagline: string; suggestions: string[]; documents: string[]; samples: string[] }

export type Settings = { injection_defence: boolean; endpoint_label: string; model: string; reasoning_effort: string | null }
export type Health = { ok: boolean; qdrant: boolean; chunks: number; models_loaded: boolean; endpoint_label: string; model: string }
export type DocSummary = { doc_id: string; title: string; rel_path: string; pages: number; source_types: string[]; acl_groups: string[]; chunks: number; quarantined: number }
export type QuarantineSpan = { chunk_id: string; page: number; text: string; bboxes: number[][]; flags: string[] }
export type About = Record<string, string | null>

export type AuditRow = {
  id: number
  ts: string
  user_id: string
  user_name: string
  groups: string[]
  question: string
  lang: string
  retrieved: string[]
  cited: string[]
  invalid_citations: string[]
  refused: boolean
  answer: string
  endpoint_label: string
  endpoint_url: string
  model: string
  injection_defence: boolean
  flags: Flag[]
  latency_ms: number
  llm_latency_ms: number | null
  error: string | null
  agent: string | null
}

export type IngestEvent = { step: string; [k: string]: unknown }

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`)
  }
  return res.json() as Promise<T>
}

const post = (url: string, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  users: () => fetch('/api/users').then(json<User[]>),
  health: () => fetch('/api/health').then(json<Health>),
  settings: () => fetch('/api/settings').then(json<Settings>),
  setDefence: (enabled: boolean) => post('/api/settings/injection-defence', { enabled }).then(json<{ injection_defence: boolean }>),
  ask: (user_id: string, question: string, agent: AgentId, image?: string, domain?: string, language?: string) =>
    post('/api/ask', { user_id, question, agent, ...(image ? { image } : {}), ...(domain ? { domain } : {}),
      ...(language && language !== 'auto' ? { language } : {}) }).then(json<AskResponse>),
  domains: () => fetch('/api/domains').then(json<Domain[]>),
  loadSamples: (domain: string, onEvent: (e: IngestEvent) => void) =>
    streamJson(`/api/domains/${domain}/load-samples`, { method: 'POST' }, onEvent as (e: unknown) => void),
  redTeam: (user_id: string, focus: string, onEvent: (e: RedTeamEvent) => void) =>
    streamJson('/api/redteam', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user_id, focus }) }, onEvent as (e: unknown) => void),
  agents: () => fetch('/api/agents').then(json<Agent[]>),
  documents: () => fetch('/api/documents').then(json<Document[]>),
  deleteDocument: (doc_id: string) => fetch(`/api/documents/${doc_id}`, { method: 'DELETE' }).then(json<{ deleted: string }>),
  docs: (user_id: string) => fetch(`/api/docs?user_id=${encodeURIComponent(user_id)}`).then(json<DocSummary[]>),
  quarantine: (doc_id: string, user_id: string) =>
    fetch(`/api/docs/${doc_id}/quarantine?user_id=${encodeURIComponent(user_id)}`).then(json<QuarantineSpan[]>),
  audit: (limit = 200) => fetch(`/api/audit?limit=${limit}`).then(json<AuditRow[]>),
  about: () => fetch('/api/about').then(json<About>),
  pageUrl: (doc_id: string, page: number, user_id: string) =>
    `/api/docs/${doc_id}/page/${page}?user_id=${encodeURIComponent(user_id)}`,

  /** Live ingest streams NDJSON progress events. */
  ingest(file: File, onEvent: (e: IngestEvent) => void, domain?: string): Promise<void> {
    const form = new FormData()
    form.append('file', file)
    if (domain) form.append('domain', domain)
    return streamJson('/api/ingest', { method: 'POST', body: form }, onEvent as (e: unknown) => void)
  },
}

/** POST and read an NDJSON progress stream. */
async function streamJson(url: string, init: RequestInit, onEvent: (e: unknown) => void): Promise<void> {
    const res = await fetch(url, init)
    if (!res.ok || !res.body) throw new Error(`${res.status} ${await res.text().catch(() => res.statusText)}`)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (line) onEvent(JSON.parse(line))
      }
    }
    if (buf.trim()) onEvent(JSON.parse(buf))
}
