import { useEffect } from 'react'
import { playhead } from '../store/playhead'
import { selectedRun, useStore } from '../store/useStore'

const FLUSH_MS = 80

/** The only writer of playhead.t during playback. Renders nothing. */
export function PlaybackClock() {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastFlush = 0

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const s = useStore.getState()

      if (s.playing) {
        playhead.t = Math.min(playhead.t + dt * s.speed * 1000, playhead.duration)
        const run = selectedRun(s)

        if (
          run.status === 'waiting' &&
          run.pendingGate &&
          playhead.t >= run.pendingGate.t &&
          !s.approvalOpen
        ) {
          playhead.t = run.pendingGate.t
          s.pauseAtGate()
        } else if (playhead.t >= playhead.duration) {
          useStore.setState({ playing: false, coarseT: playhead.t })
        } else if (now - lastFlush > FLUSH_MS) {
          lastFlush = now
          s.flushCoarse(playhead.t)
        }
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return null
}
