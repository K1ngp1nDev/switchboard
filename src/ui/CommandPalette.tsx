import { useEffect } from 'react'
import { Command } from 'cmdk'
import { deriveMarkers } from '../engine/derive'
import { getScenario, SCENARIOS } from '../scenarios'
import { playhead } from '../store/playhead'
import { selectedRun, useStore } from '../store/useStore'

export function CommandPalette() {
  const open = useStore((s) => s.cmdkOpen)
  const setOpen = useStore((s) => s.setCmdkOpen)
  const run = useStore(selectedRun)
  const scenario = getScenario(run.scenarioId)
  const s = useStore.getState

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(!useStore.getState().cmdkOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  const act = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }

  const markers = deriveMarkers(run.events)
  const nextOf = (type: 'error' | 'retry' | 'gate') => {
    const m =
      markers.find((m) => m.type === type && m.t > playhead.t + 10) ??
      markers.find((m) => m.type === type)
    if (m) {
      s().seek(Math.max(0, m.t - 600))
      if (m.node) s().requestFocusNode(m.node)
    }
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="floating fixed top-[18vh] left-1/2 z-[60] w-[min(560px,92vw)] -translate-x-1/2 overflow-hidden rounded-2xl"
    >
      <Command.Input
        placeholder="Type a command…"
        className="w-full border-b border-line bg-transparent px-4 py-3 text-[13px] text-text outline-none placeholder:text-faint"
      />
      <Command.List className="max-h-[46vh] overflow-y-auto overscroll-contain p-1.5">
        <Command.Empty className="px-3 py-6 text-center text-[11.5px] text-faint">
          No results.
        </Command.Empty>

        <Command.Group heading="Playback" className="cmdk-group">
          <Command.Item className="cmdk-item" onSelect={act(() => s().startRun())}>
            Run scenario
            <span className="kbd ml-auto">R</span>
          </Command.Item>
          <Command.Item className="cmdk-item" onSelect={act(() => s().playPause())}>
            Play / pause
            <span className="kbd ml-auto">Space</span>
          </Command.Item>
          <Command.Item className="cmdk-item" onSelect={act(() => s().replay())}>
            Replay from start
          </Command.Item>
          {[0.5, 1, 2, 4].map((sp) => (
            <Command.Item key={sp} className="cmdk-item" onSelect={act(() => s().setSpeed(sp))}>
              Speed {sp}×
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Jump" className="cmdk-group">
          <Command.Item className="cmdk-item" onSelect={act(() => nextOf('gate'))}>
            Next approval gate
          </Command.Item>
          <Command.Item className="cmdk-item" onSelect={act(() => nextOf('retry'))}>
            Next retry
          </Command.Item>
          <Command.Item className="cmdk-item" onSelect={act(() => nextOf('error'))}>
            Next error
          </Command.Item>
          {run.status === 'waiting' && (
            <Command.Item className="cmdk-item" onSelect={act(() => s().pauseAtGate())}>
              Review pending approval
            </Command.Item>
          )}
        </Command.Group>

        <Command.Group heading="Focus node" className="cmdk-group">
          {scenario.nodes.map((n) => (
            <Command.Item
              key={n.id}
              className="cmdk-item"
              onSelect={act(() => {
                s().requestFocusNode(n.id)
                s().selectSpan(`n:${n.id}`)
              })}
            >
              {n.label}
              <span className="mono-nums ml-auto text-[9px] text-faint">{n.sub}</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Scenario" className="cmdk-group">
          {SCENARIOS.map((sc) => (
            <Command.Item key={sc.id} className="cmdk-item" onSelect={act(() => s().setScenario(sc.id))}>
              {sc.name}
              <span className="mono-nums ml-auto text-[9px] text-faint">{sc.tagline}</span>
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="View" className="cmdk-group">
          <Command.Item
            className="cmdk-item"
            onSelect={act(() => s().setTheme(s().theme === 'dark' ? 'light' : 'dark'))}
          >
            Toggle theme
          </Command.Item>
          <Command.Item className="cmdk-item" onSelect={act(() => s().setRightOpen(!s().rightOpen))}>
            Toggle trace panel
          </Command.Item>
          <Command.Item
            className="cmdk-item"
            onSelect={act(() => s().setDockExpanded(!s().dockExpanded))}
          >
            Toggle timeline lanes
          </Command.Item>
          <Command.Item className="cmdk-item" onSelect={act(() => s().setFollow(!s().follow))}>
            Toggle camera follow
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  )
}
