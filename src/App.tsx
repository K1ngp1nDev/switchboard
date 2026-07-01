import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Toaster } from 'sonner'
import { FlowCanvas } from './canvas/FlowCanvas'
import { PlaybackClock } from './canvas/PlaybackClock'
import { ApprovalModal } from './ui/ApprovalModal'
import { CommandPalette } from './ui/CommandPalette'
import { ExecutionsPanel } from './ui/ExecutionsPanel'
import { RightPanel } from './ui/RightPanel'
import { TimelineDock } from './ui/TimelineDock'
import { TopBar } from './ui/TopBar'
import { UserCheckIcon } from './ui/icons'
import { playhead } from './store/playhead'
import { selectedRun, useStore } from './store/useStore'
import { audit } from './qa/audit'

function WaitingBanner() {
  const run = useStore(selectedRun)
  const coarseT = useStore((s) => s.coarseT)
  const approvalOpen = useStore((s) => s.approvalOpen)
  const setApprovalOpen = useStore((s) => s.setApprovalOpen)

  if (approvalOpen || run.status !== 'waiting' || !run.pendingGate) return null
  if (coarseT < run.pendingGate.t - 1) return null

  return (
    <button
      onClick={() => setApprovalOpen(true)}
      className="ctl floating absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-full py-2 pr-4 pl-2.5"
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-dim text-accent">
        <UserCheckIcon className="h-3.5 w-3.5" />
      </span>
      <span className="text-[11.5px] font-medium">
        Waiting for approval — <span className="text-accent">review</span>
      </span>
    </button>
  )
}

/** keyboard: space = play/pause, r = run (unless typing) */
function useHotkeys() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return
      if (e.key === ' ') {
        e.preventDefault()
        useStore.getState().playPause()
      }
      if (e.key === 'r' && !e.metaKey && !e.ctrlKey) {
        useStore.getState().startRun()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

/** QA/screenshot hooks: ?run=<id>&t=<ms>&play=1&modal=1&theme=light */
function useUrlDirectives() {
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = useStore.getState()
    const theme = p.get('theme')
    if (theme === 'light' || theme === 'dark') s.setTheme(theme)
    const runId = p.get('run')
    if (runId && s.runs.some((r) => r.id === runId)) s.selectRun(runId)
    const t = p.get('t')
    if (t !== null) s.seek(Number(t))
    if (p.get('modal') === '1') {
      const run = selectedRun(useStore.getState())
      if (run.pendingGate) {
        s.seek(run.pendingGate.t)
        s.setApprovalOpen(true)
      }
    }
    if (p.get('play') === '1') {
      if (playhead.t >= playhead.duration - 1) playhead.t = 0
      useStore.setState({ playing: true })
    }
  }, [])
}

export default function App() {
  const theme = useStore((s) => s.theme)
  useHotkeys()
  useUrlDirectives()

  useEffect(() => {
    ;(window as unknown as Record<string, unknown>).__switchboard = { store: useStore, playhead, audit }
  }, [])

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <ExecutionsPanel />
        <main className="relative min-w-0 flex-1 bg-bg">
          {/* one restrained accent wash behind the canvas */}
          <div
            className="pointer-events-none absolute inset-0 z-0 opacity-60"
            style={{
              background:
                'radial-gradient(60% 45% at 62% 0%, color-mix(in srgb, var(--accent) 7%, transparent) 0%, transparent 70%)',
            }}
          />
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
          <WaitingBanner />
        </main>
        <RightPanel />
      </div>
      <TimelineDock />
      <PlaybackClock />
      <ApprovalModal />
      <CommandPalette />
      <Toaster
        theme={theme}
        position="bottom-center"
        offset={64}
        toastOptions={{
          style: {
            background: 'var(--s2)',
            border: '1px solid var(--line-strong)',
            color: 'var(--text)',
            fontSize: '12px',
          },
        }}
      />
    </div>
  )
}
