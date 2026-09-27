import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Mark } from './ui'

const EASE = [0.2, 0.8, 0.2, 1] as const

/** A short opening: the mark, the community name and the speaker, then out of the way. */
export function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2200)
    const skip = () => onDone()
    window.addEventListener('keydown', skip)
    return () => { clearTimeout(id); window.removeEventListener('keydown', skip) }
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-canvas"
      onClick={onDone}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
      data-testid="intro"
    >
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }}>
        <Mark size={56} />
      </motion.div>
      <motion.p className="t-display-lg mt-6 text-ink" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2, ease: EASE }}>
        Global AI Community
      </motion.p>
      <motion.p className="t-title-md mt-3 text-muted" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }}>
        by <span className="text-primary">Aravind Baranitharan</span>
      </motion.p>
    </motion.div>
  )
}
