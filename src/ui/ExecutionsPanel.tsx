import { useMemo } from 'react'
import type { RunInstance } from '../store/useStore'
import { selectedRun, useStore } from '../store/useStore'
import { getScenario, SCENARIOS } from '../scenarios'
import { deriveHud } from '../engine/derive'
import { CheckIcon, ClockIcon, SpinnerIcon, XIcon } from './icons'

function ago(min: number): string {
  if (min <= 0) return 'now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  return `${h}h ${min % 60 ? `${min % 60}m ` : ''}ago`
}

function StatusIcon({ run, active }: { run: RunInstance; active: boolean }) {
  const playing = useStore((s) => s.playing)
  if (active && playing) return <SpinnerIcon className="h-3.5 w-3.5 text-accent" />
  switch (run.status) {
    case 'success':
      return <CheckIcon className="h-3.5 w-3.5 text-ok" />
    case 'failed':
    case 'rejected':
      return <XIcon className="h-3.5 w-3.5 text-err" />
    case 'waiting':
      return <ClockIcon className="pulse-soft h-3.5 w-3.5 text-accent" />
    default:
      return <SpinnerIcon className="h-3.5 w-3.5 text-accent" />
  }
}

function RunRow({ run }: { run: RunInstance }) {
  const selected = useStore((s) => s.selectedRunId === run.id)
  const selectRun = useStore((s) => s.selectRun)
  const cost = useMemo(() => deriveHud(run.events, run.duration).costUsd, [run])

  return (
    <button
      onClick={() => selectRun(run.id)}
      data-active={selected}
      aria-current={selected ? 'true' : undefined}
      className="ctl group w-full rounded-[9px] border border-transparent px-2.5 py-2 text-left hover:bg-s2 data-[active=true]:border-line-strong data-[active=true]:bg-s2"
    >
      <div className="flex items-center gap-2">
        <StatusIcon run={run} active={selected} />
        <span className="mono-nums text-[11px] font-medium text-text">{run.id}</span>
        {run.live && (
          <span className="rounded-sm bg-accent-dim px-1 py-px text-[8px] font-semibold tracking-[0.12em] text-accent uppercase">
            live
          </span>
        )}
        <span className="mono-nums ml-auto shrink-0 text-[9.5px] text-faint">{ago(run.agoMin)}</span>
      </div>
      <p className="mt-1 truncate text-[11px] leading-tight text-dim">{run.label}</p>
      <div className="mono-nums mt-1 flex gap-3 text-[9.5px] text-faint">
        <span>{(run.duration / 1000).toFixed(1)}s</span>
        <span>${cost.toFixed(4)}</span>
        {run.status === 'waiting' && <span className="text-accent">needs approval</span>}
      </div>
    </button>
  )
}

export function ExecutionsPanel() {
  const runs = useStore((s) => s.runs)
  const scenarioId = useStore((s) => s.scenarioId)
  const sidebarOpen = useStore((s) => s.sidebarOpen)
  const setSidebarOpen = useStore((s) => s.setSidebarOpen)
  const setScenarioAction = useStore((s) => s.setScenario)
  const run = useStore(selectedRun)
  const scenario = getScenario(scenarioId)

  const scenarioRuns = runs.filter((r) => r.scenarioId === scenarioId)
  const waiting = scenarioRuns.filter((r) => r.status === 'waiting').length

  return (
    <>
      {/* mobile scrim */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`${
          sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        } fixed top-12 bottom-0 left-0 z-40 flex w-[264px] shrink-0 flex-col border-r border-line bg-s1 transition-[transform,visibility] duration-300 lg:visible lg:static lg:z-auto lg:translate-x-0 lg:transition-none`}
        aria-label="Executions"
      >
        {/* scenario switcher — mobile only (the top bar hides it there) */}
        <nav className="flex gap-1 border-b border-line p-2 md:hidden" aria-label="Scenario">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              aria-pressed={scenarioId === s.id}
              data-active={scenarioId === s.id}
              onClick={() => setScenarioAction(s.id)}
              className="ctl flex-1 truncate rounded-[7px] border border-line px-2 py-1.5 text-[10.5px] text-dim data-[active=true]:text-text"
            >
              {s.name}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
          <div>
            <p className="text-[11px] font-semibold tracking-wide">Executions</p>
            <p className="mono-nums pt-0.5 text-[9.5px] text-faint">{scenario.tagline}</p>
          </div>
          {waiting > 0 && (
            <span className="rounded-full bg-accent-dim px-2 py-0.5 text-[9px] font-semibold text-accent">
              {waiting} pending
            </span>
          )}
        </div>

        <div className="flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-2">
          {scenarioRuns.map((r) => (
            <RunRow key={r.id} run={r} />
          ))}
        </div>

        <div className="mono-nums border-t border-line px-3.5 py-2 text-[9.5px] text-faint">
          run {run.id} · seed {run.seed} · deterministic replay
        </div>
      </aside>
    </>
  )
}
