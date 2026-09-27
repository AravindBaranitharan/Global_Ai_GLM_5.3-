import { motion } from 'motion/react'
import { useEffect } from 'react'
import { Mark } from './ui'

const EASE = [0.25, 0.46, 0.45, 0.94] as const

/** A short opening: a green band rises, the community name and the speaker, then out of the way. */
export function Intro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2600)
    const skip = () => onDone()
    window.addEventListener('keydown', skip)
    return () => { clearTimeout(id); window.removeEventListener('keydown', skip) }
  }, [onDone])

  const words = 'Global AI Community'.split(' ')
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-house"
      onClick={onDone}
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)', transition: { duration: 0.9, ease: EASE } }}
      exit={{ y: '-100%', transition: { duration: 0.6, ease: [0.7, 0, 0.3, 1] } }}
      data-testid="intro"
    >
      <motion.div className="absolute h-[140vmax] w-[140vmax] rounded-full border border-white/5" initial={{ scale: 0.2 }} animate={{ scale: 1 }} transition={{ duration: 2.4, ease: EASE }} aria-hidden />
      <motion.div className="absolute h-[90vmax] w-[90vmax] rounded-full border border-white/5" initial={{ scale: 0.2 }} animate={{ scale: 1 }} transition={{ duration: 2.4, delay: 0.1, ease: EASE }} aria-hidden />
      <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.3 }}>
        <Mark size={64} className="text-primary" />
      </motion.div>
      <p className="t-display-xl mt-7 flex flex-wrap justify-center gap-x-[0.25em] px-6 text-center text-white">
        {words.map((w, i) => (
          <span key={w} className="inline-block overflow-hidden pb-2">
            <motion.span className="inline-block" initial={{ y: '110%' }} animate={{ y: 0 }} transition={{ duration: 0.7, delay: 0.55 + i * 0.1, ease: EASE }}>{w}</motion.span>
          </span>
        ))}
      </p>
      <motion.p className="t-title-md mt-4 text-white/70" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 1.1 }}>
        by <span className="text-mint">Aravind Baranitharan</span>
      </motion.p>
    </motion.div>
  )
}
