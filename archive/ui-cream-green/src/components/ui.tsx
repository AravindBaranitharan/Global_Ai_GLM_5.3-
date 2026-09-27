import type { AgentId } from '../api'

export function Mark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className}>
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <path d="M7 15.5c1.4-3.8 3-5.8 5-5.8s3.6 2 5 5.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="7" r="1.6" fill="#fff" />
    </svg>
  )
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('')
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-mint font-bold text-house" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden>
      {initials}
    </span>
  )
}

export function AgentIcon({ id, size = 18 }: { id: AgentId; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (id === 'code_review') return <svg {...common}><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4l-3 16" /></svg>
  if (id === 'threat_model') return <svg {...common}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="0.8" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></svg>
  if (id === 'compliance') return <svg {...common}><rect x="4.5" y="3.5" width="15" height="17" rx="1.5" /><path d="M8 8.5l1.5 1.5L12.5 7M8 14.5l1.5 1.5 3-3M14.5 9h2.5M14.5 15h2.5" /></svg>
  if (id === 'red_team') return <svg {...common}><path d="M12 3c3 3 5 5.5 5 9a5 5 0 01-10 0c0-1.6.6-3 1.5-4 .3 1.5 1 2.5 2 3 0-3 .5-5.5 1.5-8z" /></svg>
  if (id === 'security') return <svg {...common}><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>
  return <svg {...common}><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5v-15z" /><path d="M4 20.5A2.5 2.5 0 016.5 18H20v3H6.5" /><path d="M9 8h7M9 11.5h5" /></svg>
}

export const Lock = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden><rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M5.5 7V5a2.5 2.5 0 015 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
)

export const DocIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M6 2.5h8l5 5V21a.5.5 0 01-.5.5h-12A.5.5 0 016 21V2.5z" /><path d="M14 2.5V8h5" /><path d="M9 13h7M9 16.5h5" /></svg>
)
