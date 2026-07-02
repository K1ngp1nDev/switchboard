import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { deriveMarkers, deriveSpans } from '../engine/derive'
import { getScenario, nodeKindLookup, nodeLabelLookup } from '../scenarios'
import { playhead } from '../store/playhead'
import { selectedRun, useStore } from '../store/useStore'
import { CameraIcon, PauseIcon, PlayIcon, RestartIcon, RowsIcon } from './icons'

const SPEEDS = [0.5, 1, 2, 4]

function fmtClock(ms: number): string {
  const s = Math.max(0, ms) / 1000
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

/** rAF-driven playhead line + clock + slider ARIA, zero React re-renders */
function usePlayheadDom(
  lineRef: React.RefObject<HTMLDivElement | null>,
  clockRef: React.RefObject<HTMLSpanElement | null>,
  sliderRef: React.RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    let raf = 0
    let lastAria = -1
    const loop = () => {
      const pct = playhead.duration > 0 ? (playhead.t / playhead.duration) * 100 : 0
      if (lineRef.current) lineRef.current.style.left = `${pct}%`
      if (clockRef.current) clockRef.current.textContent = fmtClock(playhead.t)
      const rounded = Math.round(playhead.t / 100)
      if (sliderRef.current && rounded !== lastAria) {
        lastAria = rounded
        sliderRef.current.setAttribute('aria-valuenow', String(Math.round(playhead.t)))
        sliderRef.current.setAttribute('aria-valuetext', fmtClock(playhead.t))
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [lineRef, clockRef, sliderRef])
}

const KIND_COLOR: Record<string, string> = {
  llm: 'var(--accent)',
  tool: 'var(--tool)',
  guardrail: 'var(--ok)',
  approval: 'var(--accent)',
  toolcall: 'var(--tool)',
  gate: 'var(--accent)',
  trigger: 'var(--dim)',
  router: 'var(--dim)',
  output: 'var(--ok)',
}

export function TimelineDock() {
  const run = useStore(selectedRun)
  const playing = useStore((s) => s.playing)
  const speed = useStore((s) => s.speed)
  const follow = useStore((s) => s.follow)
  const expanded = useStore((s) => s.dockExpanded)
  const playPause = useStore((s) => s.playPause)
  const replay = useStore((s) => s.replay)
  const seek = useStore((s) => s.seek)
  const setSpeed = useStore((s) => s.setSpeed)
  const setFollow = useStore((s) => s.setFollow)
  const setDockExpanded = useStore((s) => s.setDockExpanded)
  const setHoverNode = useStore((s) => s.setHoverNode)

  const scenario = getScenario(run.scenarioId)
  const spans = useMemo(
    () =>
      deriveSpans(run.events, nodeKindLookup(scenario), nodeLabelLookup(scenario)).filter(
        (s) => !s.parentId && s.end > s.start,
      ),
    [run, scenario],
  )
  const markers = useMemo(() => deriveMarkers(run.events), [run])

  const lineRef = useRef<HTMLDivElement>(null)
  const clockRef = useRef<HTMLSpanElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const sliderRef = useRef<HTMLDivElement>(null)
  usePlayheadDom(lineRef, clockRef, sliderRef)

  const scrub = (e: ReactPointerEvent) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seek(frac * run.duration)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    scrub(e)
  }

  const pct = (t: number) => (run.duration > 0 ? (t / run.duration) * 100 : 0)

  return (
    <section className="relative z-20 shrink-0 border-t border-line bg-s1" aria-label="Timeline">
      {/* transport row */}
      <div className="flex h-11 items-center gap-2 px-3">
        <button
          onClick={playPause}
          aria-label={playing ? 'Pause' : 'Play'}
          className="ctl flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-ink"
        >
          {playing ? <PauseIcon className="h-3 w-3" /> : <PlayIcon className="h-3 w-3" />}
        </button>
        <button
          onClick={replay}
          aria-label="Replay from start"
          className="ctl flex h-7 w-7 items-center justify-center rounded-full border border-line text-dim"
        >
          <RestartIcon className="h-3.5 w-3.5" />
        </button>

        <div className="ml-1 flex items-center rounded-full border border-line p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              aria-pressed={speed === s}
              data-active={speed === s}
              onClick={() => setSpeed(s)}
              className="ctl mono-nums rounded-full px-1.5 py-0.5 text-[9.5px] text-dim data-[active=true]:bg-s3 data-[active=true]:text-text"
            >
              {s}×
            </button>
          ))}
        </div>

        <button
          data-active={follow}
          onClick={() => setFollow(!follow)}
          aria-pressed={follow}
          className="ctl hidden items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[10px] text-dim sm:flex"
          title="Camera follows the active node"
        >
          <CameraIcon className="h-3 w-3" />
          Follow
        </button>

        <span className="mono-nums ml-auto text-[11px] text-dim">
          <span ref={clockRef} className="text-text">00:00.0</span>
          <span className="px-1 text-faint">/</span>
          {fmtClock(run.duration)}
        </span>

        <button
          data-active={expanded}
          onClick={() => setDockExpanded(!expanded)}
          aria-pressed={expanded}
          aria-label="Toggle span lanes"
          className="ctl flex h-7 w-7 items-center justify-center rounded-[7px] border border-line text-dim"
        >
          <RowsIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* scrubber + lanes share one time axis */}
      <div className="px-3 pb-2.5">
        <div ref={trackRef} className="relative">
          {/* ruler / scrub strip */}
          <div
            ref={sliderRef}
            className="relative h-5 cursor-ew-resize touch-none rounded-md bg-s2"
            onPointerDown={onPointerDown}
            onPointerMove={(e) => e.buttons === 1 && scrub(e)}
            role="slider"
            aria-label="Playback position"
            aria-valuemin={0}
            aria-valuemax={Math.round(run.duration)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') seek(playhead.t + run.duration * 0.02)
              if (e.key === 'ArrowLeft') seek(playhead.t - run.duration * 0.02)
              if (e.key === 'Home') seek(0)
              if (e.key === 'End') seek(run.duration)
            }}
          >
            {markers.map((m, i) => (
              <span
                key={i}
                title={`${m.type} · ${m.node}`}
                className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  left: `${pct(m.t)}%`,
                  background:
                    m.type === 'error' ? 'var(--err)' : 'var(--accent)',
                  opacity: m.type === 'retry' ? 0.7 : 1,
                }}
              />
            ))}
          </div>

          {/* span lanes */}
          {expanded && (
            <div className="mt-1.5 max-h-[136px] space-y-px overflow-y-auto overscroll-contain pr-1">
              {spans.map((span) => (
                <div
                  key={span.id}
                  className="group flex h-[18px] items-center gap-2"
                  onMouseEnter={() => span.node && setHoverNode(span.node)}
                  onMouseLeave={() => setHoverNode(null)}
                >
                  <span className="w-[118px] shrink-0 truncate text-right text-[9px] text-faint group-hover:text-dim">
                    {span.name}
                  </span>
                  <div className="relative h-[9px] flex-1 rounded-sm bg-s2">
                    <span
                      className="absolute top-0 h-full rounded-sm"
                      style={{
                        left: `${pct(span.start)}%`,
                        width: `${Math.max(0.4, pct(span.end) - pct(span.start))}%`,
                        background:
                          span.status === 'error'
                            ? 'var(--err)'
                            : span.status === 'skipped'
                              ? 'var(--line-strong)'
                              : KIND_COLOR[span.kind] ?? 'var(--dim)',
                        opacity: span.status === 'skipped' ? 0.5 : 0.85,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* shared playhead */}
          <div
            ref={lineRef}
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent"
            style={{ left: 0, boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)' }}
          >
            <span className="absolute -top-0.5 -left-[3px] h-2 w-[7px] rounded-sm bg-accent" />
          </div>
        </div>
      </div>
    </section>
  )
}
