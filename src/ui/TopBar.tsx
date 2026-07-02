import { useEffect, useRef } from 'react'
import { deriveHud } from '../engine/derive'
import { playhead } from '../store/playhead'
import { selectedRun, useStore } from '../store/useStore'
import { SCENARIOS } from '../scenarios'
import { ListIcon, MoonIcon, PlayIcon, SunIcon } from './icons'

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)

function StatusChip() {
  const run = useStore(selectedRun)
  const coarseT = useStore((s) => s.coarseT)
  const hud = deriveHud(run.events, coarseT)
  const map = {
    idle: { label: 'idle', cls: 'text-dim border-line' },
    running: { label: 'running', cls: 'text-accent border-accent/40 bg-accent-dim' },
    waiting: { label: 'needs approval', cls: 'text-accent border-accent/50 bg-accent-dim pulse-soft' },
    success: { label: 'success', cls: 'text-ok border-ok/40 bg-ok-dim' },
    failed: { label: 'failed', cls: 'text-err border-err/40 bg-err-dim' },
    rejected: { label: 'rejected', cls: 'text-err border-err/40 bg-err-dim' },
  } as const
  const m = map[hud.status]
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-medium tracking-[0.12em] whitespace-nowrap uppercase max-sm:text-[8.5px] ${m.cls}`}
    >
      {m.label}
    </span>
  )
}

/** token / cost / elapsed counters — written straight to the DOM from rAF */
function HudNumbers() {
  const run = useStore(selectedRun)
  const tokRef = useRef<HTMLSpanElement>(null)
  const costRef = useRef<HTMLSpanElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let raf = 0
    let last = { tok: -1, cost: -1, time: -1 }
    const loop = () => {
      const hud = deriveHud(run.events, playhead.t)
      const tok = hud.tokensIn + hud.tokensOut
      if (tok !== last.tok && tokRef.current) {
        tokRef.current.textContent = tok.toLocaleString()
        last = { ...last, tok }
      }
      const cost = Math.round(hud.costUsd * 10000)
      if (cost !== last.cost && costRef.current) {
        costRef.current.textContent = `$${hud.costUsd.toFixed(4)}`
        last = { ...last, cost }
      }
      const time = Math.floor(hud.elapsed / 100)
      if (time !== last.time && timeRef.current) {
        timeRef.current.textContent = `${(hud.elapsed / 1000).toFixed(1)}s`
        last = { ...last, time }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [run])

  return (
    <div className="mono-nums hidden items-center gap-4 text-[11px] text-dim md:flex">
      <span>
        tok&nbsp;<span ref={tokRef} className="text-text">0</span>
      </span>
      <span>
        cost&nbsp;<span ref={costRef} className="text-text">$0.0000</span>
      </span>
      <span>
        t&nbsp;<span ref={timeRef} className="text-text">0.0s</span>
      </span>
    </div>
  )
}

export function TopBar() {
  const scenarioId = useStore((s) => s.scenarioId)
  const setScenario = useStore((s) => s.setScenario)
  const startRun = useStore((s) => s.startRun)
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const setCmdkOpen = useStore((s) => s.setCmdkOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const sidebarOpen = useStore((s) => s.sidebarOpen)

  return (
    <header className="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-line bg-s1 px-3 md:px-4">
      <button
        className="ctl -ml-1 flex h-8 w-8 items-center justify-center rounded-[7px] border border-line text-dim lg:hidden"
        aria-label="Toggle runs panel"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <ListIcon className="h-4 w-4" />
      </button>

      <div className="flex items-baseline gap-1.5 select-none">
        <span className="text-accent">◆</span>
        <span className="font-display text-[11px] font-extrabold tracking-[0.18em] sm:text-[13px] sm:tracking-[0.22em]">
          SWITCHBOARD
        </span>
        <span className="mono-nums hidden pl-1 text-[9px] tracking-[0.14em] text-faint uppercase lg:inline">
          agent ops
        </span>
      </div>

      <div className="mx-1 hidden h-5 w-px bg-line md:block" />

      {/* scenario tabs live in the executions sheet on mobile */}
      <nav className="hidden min-w-0 items-center gap-1 md:flex" aria-label="Scenario">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            aria-pressed={scenarioId === s.id}
            data-active={scenarioId === s.id}
            onClick={() => setScenario(s.id)}
            className="ctl truncate rounded-full border border-transparent px-2.5 py-1 text-[11px] text-dim data-[active=true]:text-text"
            title={s.tagline}
          >
            {s.name}
          </button>
        ))}
      </nav>

      <div className="flex-1" />

      <HudNumbers />
      <StatusChip />

      <button
        onClick={startRun}
        className="ctl flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-accent-ink"
      >
        <PlayIcon className="h-3 w-3" />
        Run
      </button>

      <button
        onClick={() => setCmdkOpen(true)}
        className="ctl hidden items-center gap-1.5 rounded-[7px] border border-line px-2 py-1.5 text-[10px] text-dim md:flex"
        aria-label="Open command palette"
      >
        <span className="kbd">{IS_MAC ? '⌘K' : 'Ctrl K'}</span>
      </button>

      <button
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        className="ctl flex h-8 w-8 items-center justify-center rounded-[7px] border border-line text-dim"
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        {theme === 'dark' ? <SunIcon className="h-3.5 w-3.5" /> : <MoonIcon className="h-3.5 w-3.5" />}
      </button>
    </header>
  )
}
