import { useMemo } from 'react'
import { deriveSpans, type Span } from '../engine/derive'
import { getScenario, nodeKindLookup, nodeLabelLookup } from '../scenarios'
import { selectedRun, useStore } from '../store/useStore'
import { XIcon } from './icons'

function fmtMs(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`
}

const KIND_COLOR: Record<string, string> = {
  llm: 'var(--accent)',
  tool: 'var(--tool)',
  toolcall: 'var(--tool)',
  guardrail: 'var(--ok)',
  approval: 'var(--accent)',
  gate: 'var(--accent)',
  trigger: 'var(--dim)',
  router: 'var(--dim)',
  output: 'var(--ok)',
}

function useSpans(): Span[] {
  const run = useStore(selectedRun)
  const scenario = getScenario(run.scenarioId)
  return useMemo(
    () => deriveSpans(run.events, nodeKindLookup(scenario), nodeLabelLookup(scenario)),
    [run, scenario],
  )
}

function TraceWaterfall() {
  const run = useStore(selectedRun)
  const coarseT = useStore((s) => s.coarseT)
  const selectSpan = useStore((s) => s.selectSpan)
  const setHoverNode = useStore((s) => s.setHoverNode)
  const requestFocusNode = useStore((s) => s.requestFocusNode)
  const spans = useSpans()
  const visible = spans.filter((s) => s.start <= coarseT)
  const pct = (t: number) => (run.duration > 0 ? (t / run.duration) * 100 : 0)

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mono-nums sticky top-0 z-10 grid grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_44px_52px_44px] gap-2 border-b border-line bg-s1 px-3 py-1.5 text-[8.5px] tracking-[0.14em] text-faint uppercase">
        <span>span</span>
        <span>waterfall</span>
        <span className="text-right">tok</span>
        <span className="text-right">cost</span>
        <span className="text-right">ms</span>
      </div>
      {visible.map((span) => {
        const clampedEnd = Math.min(span.end, coarseT)
        return (
          <button
            key={span.id}
            onClick={() => {
              selectSpan(span.id)
              if (span.node) requestFocusNode(span.node)
            }}
            onMouseEnter={() => span.node && setHoverNode(span.node)}
            onMouseLeave={() => setHoverNode(null)}
            className="grid w-full grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_44px_52px_44px] items-center gap-2 border-b border-line/50 px-3 py-[5px] text-left transition-colors hover:bg-s2"
          >
            <span
              className={`flex min-w-0 items-center gap-1.5 ${span.parentId ? 'pl-3.5' : ''}`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: span.status === 'error' ? 'var(--err)' : KIND_COLOR[span.kind] }}
              />
              <span className="truncate text-[10.5px] text-text">{span.name}</span>
              {span.attempt && span.attempt > 1 && (
                <span className="mono-nums shrink-0 rounded-sm bg-accent-dim px-1 text-[8px] text-accent">
                  ×{span.attempt}
                </span>
              )}
            </span>
            <span className="relative h-[7px] rounded-sm bg-s2">
              <span
                className="absolute top-0 h-full rounded-sm"
                style={{
                  left: `${pct(span.start)}%`,
                  width: `${Math.max(0.5, pct(clampedEnd) - pct(span.start))}%`,
                  background: span.status === 'error' ? 'var(--err)' : KIND_COLOR[span.kind],
                  opacity: span.status === 'skipped' ? 0.4 : 0.9,
                }}
              />
            </span>
            <span className="mono-nums text-right text-[9.5px] text-dim">
              {span.tokens > 0 ? span.tokens.toLocaleString() : '—'}
            </span>
            <span className="mono-nums text-right text-[9.5px] text-dim">
              {span.costUsd > 0 ? `$${span.costUsd.toFixed(4)}` : '—'}
            </span>
            <span className="mono-nums text-right text-[9.5px] text-dim">
              {fmtMs(clampedEnd - span.start)}
            </span>
          </button>
        )
      })}
      {visible.length === 0 && (
        <p className="px-4 py-8 text-center text-[11px] text-faint">
          Press play — spans appear as the run progresses.
        </p>
      )}
    </div>
  )
}

function Inspector() {
  const selectedSpanId = useStore((s) => s.selectedSpanId)
  const spans = useSpans()
  const span = spans.find((s) => s.id === selectedSpanId) ?? null

  if (!span) {
    return (
      <p className="px-4 py-8 text-center text-[11px] text-faint">
        Select a node or a trace span to inspect its payload.
      </p>
    )
  }

  const rows: [string, string][] = [
    ['span', span.name],
    ['kind', span.kind],
    ['status', span.status],
    ['start', `${(span.start / 1000).toFixed(2)}s`],
    ['duration', fmtMs(span.end - span.start)],
    ...(span.tokens > 0 ? ([['tokens', span.tokens.toLocaleString()]] as [string, string][]) : []),
    ...(span.costUsd > 0 ? ([['cost', `$${span.costUsd.toFixed(4)}`]] as [string, string][]) : []),
    ...(span.attempt && span.attempt > 1
      ? ([['attempts', String(span.attempt)]] as [string, string][])
      : []),
  ]

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-3">
      <dl className="mono-nums grid grid-cols-[72px_1fr] gap-x-2 gap-y-1.5 text-[10.5px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-faint">{k}</dt>
            <dd className="truncate text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {span.detail !== undefined && (
        <>
          <p className="mt-4 mb-1.5 text-[8.5px] tracking-[0.16em] text-faint uppercase">payload</p>
          <pre className="mono-nums overflow-x-auto rounded-lg border border-line bg-s2 p-2.5 text-[10px] leading-relaxed whitespace-pre-wrap text-dim">
            {JSON.stringify(span.detail, null, 2)}
          </pre>
        </>
      )}
    </div>
  )
}

export function RightPanel() {
  const rightOpen = useStore((s) => s.rightOpen)
  const rightTab = useStore((s) => s.rightTab)
  const setRightTab = useStore((s) => s.setRightTab)
  const setRightOpen = useStore((s) => s.setRightOpen)

  if (!rightOpen) return null

  return (
    <aside
      className="fixed top-12 right-0 bottom-0 z-40 flex w-full max-w-[360px] flex-col border-l border-line bg-s1 xl:static xl:z-auto xl:w-[340px]"
      aria-label="Trace"
    >
      <div className="flex items-center gap-1 border-b border-line px-2 py-1.5">
        {(['trace', 'inspector'] as const).map((tab) => (
          <button
            key={tab}
            aria-pressed={rightTab === tab}
            data-active={rightTab === tab}
            onClick={() => setRightTab(tab)}
            className="ctl rounded-[7px] px-2.5 py-1 text-[10.5px] font-medium text-dim capitalize data-[active=true]:bg-s3 data-[active=true]:text-text"
          >
            {tab}
          </button>
        ))}
        <button
          onClick={() => setRightOpen(false)}
          aria-label="Close panel"
          className="ctl ml-auto flex h-6 w-6 items-center justify-center rounded-[6px] text-faint hover:text-text"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
      {rightTab === 'trace' ? <TraceWaterfall /> : <Inspector />}
    </aside>
  )
}
