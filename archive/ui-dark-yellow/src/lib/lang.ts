/** Languages the assistant answers in. Detection for display only; the server decides the answer language. */
export type LangCode = 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn' | 'fr' | 'es'

export const LANGUAGES: { code: LangCode; name: string; native: string }[] = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
]

const SCRIPTS: [LangCode, number, number][] = [
  ['hi', 0x0900, 0x097f], ['bn', 0x0980, 0x09ff], ['ta', 0x0b80, 0x0bff],
  ['te', 0x0c00, 0x0c7f], ['kn', 0x0c80, 0x0cff], ['ml', 0x0d00, 0x0d7f],
]

/** The lang attribute for a piece of text: the dominant Indian script, else English. */
export function langOf(text: string): string {
  const counts = new Map<LangCode, number>()
  let letters = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    const hit = SCRIPTS.find(([, lo, hi]) => cp >= lo && cp <= hi)
    if (hit) { counts.set(hit[0], (counts.get(hit[0]) ?? 0) + 1); letters++ }
    else if (/\p{L}/u.test(ch)) letters++
  }
  let best: LangCode | null = null
  for (const [k, v] of counts) if (!best || v > (counts.get(best) ?? 0)) best = k
  return best && (counts.get(best) ?? 0) / Math.max(letters, 1) > 0.3 ? best : 'en'
}

export const nativeName = (code: string) => LANGUAGES.find((l) => l.code === code)?.native ?? code
