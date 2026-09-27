import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Mark } from './ui'

const EASE = [0.22, 1, 0.36, 1] as const

/** A short opening on the black canvas: an orbit draws in, the name resolves, then out of the way. */
export function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2600)
    const skip = () => onDone()
    window.addEventListener('keydown', skip)
    return () => { clearTimeout(id); window.removeEventListener('keydown', skip) }
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-canvas"
      onClick={onDone}
      exit={{ opacity: 0, filter: 'blur(8px)', transition: { duration: 0.5 } }}
      data-testid="intro"
    >
      <svg className="absolute h-[120vmin] w-[120vmin] text-hairline-strong" viewBox="0 0 200 200" aria-hidden>
        <motion.ellipse cx="100" cy="100" rx="96" ry="38" fill="none" stroke="currentColor" strokeWidth="0.4" transform="rotate(-24 100 100)"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, ease: EASE }} />
        <motion.circle cx="100" cy="100" r="70" fill="none" stroke="currentColor" strokeWidth="0.3"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, delay: 0.2, ease: EASE }} />
      </svg>
      <motion.div className="text-white" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: EASE }}>
        <Mark size={44} />
      </motion.div>
      <motion.p className="t-display-lg mt-8 px-6 text-center text-ink"
        initial={{ opacity: 0, letterSpacing: '0.1em', filter: 'blur(10px)' }} animate={{ opacity: 1, letterSpacing: '-0.025em', filter: 'blur(0px)' }} transition={{ duration: 1.1, delay: 0.3, ease: EASE }}>
        Global AI Community
      </motion.p>
      <motion.p className="t-eyebrow mt-5 text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 1.1 }}>
        by Aravind Baranitharan
      </motion.p>
    </motion.div>
  )
}
