import { create } from 'zustand'
import type { ApprovalDecision, GateDecision, Json, RunEvent, SimResult } from '../engine/types'
import { simulate } from '../engine/builder'
import { mulberry32 } from '../engine/prng'
import { getScenario, SCENARIOS } from '../scenarios'
import { RUN_HISTORY } from './history'
import { playhead } from './playhead'

export interface RunInstance extends SimResult {
  id: string
  scenarioId: string
  seed: number
  variant: number
  decisions: ApprovalDecision[]
  /** minutes ago the run "started" (fake wall-clock for the list) */
  agoMin: number
  /** trigger label from run.start */
  label: string
  live: boolean
}

function makeRun(
  id: string,
  scenarioId: string,
  seed: number,
  variant: number,
  decisions: ApprovalDecision[],
  agoMin: number,
  live = false,
): RunInstance {
  const scenario = getScenario(scenarioId)
  const sim = simulate(scenario, seed, variant, decisions, mulberry32)
  const first = sim.events.find((e) => e.kind === 'run.start')
  return {
    ...sim,
    id,
    scenarioId,
    seed,
    variant,
    decisions,
    agoMin,
    label: first && first.kind === 'run.start' ? first.trigger : id,
    live,
  }
}

export type RightTab = 'trace' | 'inspector'
export type Theme = 'dark' | 'light'

interface AppState {
  theme: Theme
  scenarioId: string
  runs: RunInstance[]
  selectedRunId: string
  /** quantized playhead time that drives React re-renders (~12Hz while playing) */
  coarseT: number
  playing: boolean
  speed: number
  follow: boolean
  rightTab: RightTab
  rightOpen: boolean
  dockExpanded: boolean
  sidebarOpen: boolean // mobile sheet
  selectedSpanId: string | null
  hoverNodeId: string | null
  focusNodeId: string | null // one-shot camera fly-to request
  cmdkOpen: boolean
  approvalOpen: boolean
  liveSeq: number

  setTheme: (t: Theme) => void
  setScenario: (id: string) => void
  selectRun: (id: string) => void
  startRun: () => void
  playPause: () => void
  replay: () => void
  seek: (t: number) => void
  setSpeed: (s: number) => void
  setFollow: (v: boolean) => void
  setRightTab: (t: RightTab) => void
  setRightOpen: (v: boolean) => void
  setDockExpanded: (v: boolean) => void
  setSidebarOpen: (v: boolean) => void
  selectSpan: (id: string | null) => void
  setHoverNode: (id: string | null) => void
  requestFocusNode: (id: string | null) => void
  setCmdkOpen: (v: boolean) => void
  setApprovalOpen: (v: boolean) => void
  decideGate: (decision: GateDecision, editedState?: Json) => void
  /** called by the rAF clock to flush the coarse tick into React */
  flushCoarse: (t: number) => void
  pauseAtGate: () => void
}

const initialRuns = RUN_HISTORY.map((r) =>
  makeRun(r.id, r.scenarioId, r.seed, r.variant, r.decisions, r.agoMin),
)

function readStoredTheme(): Theme {
  try {
    const t = localStorage.getItem('sb-theme')
    return t === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}
const initialTheme: Theme = readStoredTheme()

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
const forcedScenario = params?.get('scenario')
const initialScenario =
  forcedScenario && SCENARIOS.some((s) => s.id === forcedScenario)
    ? forcedScenario
    : SCENARIOS[0].id

const firstRun = initialRuns.find((r) => r.scenarioId === initialScenario) ?? initialRuns[0]
playhead.t = firstRun.status === 'waiting' && firstRun.pendingGate ? firstRun.pendingGate.t : firstRun.duration
playhead.duration = firstRun.duration

export const useStore = create<AppState>()((set, get) => ({
  theme: initialTheme,
  scenarioId: initialScenario,
  runs: initialRuns,
  selectedRunId: firstRun.id,
  coarseT: playhead.t,
  playing: false,
  speed: 1,
  follow: true,
  rightTab: 'trace',
  rightOpen: window.innerWidth >= 1280,
  dockExpanded: window.innerWidth >= 768,
  sidebarOpen: false,
  selectedSpanId: null,
  hoverNodeId: null,
  focusNodeId: null,
  cmdkOpen: false,
  approvalOpen: false,
  liveSeq: 0,

  setTheme: (theme) => {
    try {
      localStorage.setItem('sb-theme', theme)
    } catch {
      /* private mode — theme just won't persist */
    }
    document.documentElement.dataset.theme = theme
    set({ theme })
  },

  setScenario: (scenarioId) => {
    const run = get().runs.find((r) => r.scenarioId === scenarioId)
    set({ scenarioId })
    if (run) get().selectRun(run.id)
  },

  selectRun: (id) => {
    const run = get().runs.find((r) => r.id === id)
    if (!run) return
    const t = run.status === 'waiting' && run.pendingGate ? run.pendingGate.t : run.duration
    playhead.t = t
    playhead.duration = run.duration
    set({
      selectedRunId: id,
      scenarioId: run.scenarioId,
      coarseT: t,
      playing: false,
      approvalOpen: false,
      selectedSpanId: null,
      sidebarOpen: false,
    })
  },

  startRun: () => {
    const { scenarioId, runs, liveSeq } = get()
    const scenario = getScenario(scenarioId)
    const seq = liveSeq + 1
    const seed = 9000 + seq * 17
    const variant = seq % scenario.variants
    const id = `live-${String(seq).padStart(2, '0')}`
    const run = makeRun(id, scenarioId, seed, variant, [], 0, true)
    playhead.t = 0
    playhead.duration = run.duration
    set({
      runs: [run, ...runs],
      selectedRunId: id,
      liveSeq: seq,
      coarseT: 0,
      playing: true,
      approvalOpen: false,
      selectedSpanId: null,
      sidebarOpen: false,
    })
  },

  playPause: () => {
    const { playing } = get()
    if (!playing && playhead.t >= playhead.duration - 1) playhead.t = 0
    set({ playing: !playing, coarseT: playhead.t })
  },

  replay: () => {
    playhead.t = 0
    set({ playing: true, coarseT: 0, approvalOpen: false })
  },

  seek: (t) => {
    playhead.t = Math.max(0, Math.min(t, playhead.duration))
    set({ coarseT: playhead.t })
  },

  setSpeed: (speed) => set({ speed }),
  setFollow: (follow) => set({ follow }),
  setRightTab: (rightTab) => set({ rightTab, rightOpen: true }),
  setRightOpen: (rightOpen) => set({ rightOpen }),
  setDockExpanded: (dockExpanded) => set({ dockExpanded }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  selectSpan: (selectedSpanId) =>
    set(selectedSpanId ? { selectedSpanId, rightTab: 'inspector', rightOpen: true } : { selectedSpanId }),
  setHoverNode: (hoverNodeId) => set({ hoverNodeId }),
  requestFocusNode: (focusNodeId) => set({ focusNodeId }),
  setCmdkOpen: (cmdkOpen) => set({ cmdkOpen }),
  setApprovalOpen: (approvalOpen) => set({ approvalOpen }),

  decideGate: (decision, editedState) => {
    const { runs, selectedRunId } = get()
    const run = runs.find((r) => r.id === selectedRunId)
    if (!run || !run.pendingGate) return
    const newDecision: ApprovalDecision = {
      gateId: run.pendingGate.gate,
      decision,
      editedState: decision === 'edited' ? editedState : undefined,
      actor: 'you',
    }
    const decisions = [...run.decisions, newDecision]
    const updated = makeRun(run.id, run.scenarioId, run.seed, run.variant, decisions, run.agoMin, run.live)
    const close = updated.events.find(
      (e): e is Extract<RunEvent, { kind: 'gate.close' }> =>
        e.kind === 'gate.close' && e.gate === newDecision.gateId,
    )
    playhead.duration = updated.duration
    playhead.t = close ? Math.max(0, close.t - 400) : playhead.t
    set({
      runs: runs.map((r) => (r.id === run.id ? updated : r)),
      approvalOpen: false,
      playing: true,
      coarseT: playhead.t,
    })
  },

  flushCoarse: (t) => set({ coarseT: t }),

  pauseAtGate: () => set({ playing: false, approvalOpen: true, coarseT: playhead.t }),
}))

export function selectedRun(state: AppState): RunInstance {
  return state.runs.find((r) => r.id === state.selectedRunId) ?? state.runs[0]
}
