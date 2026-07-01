import type { Json, NodeKind, RunEvent } from './types'

/**
 * Pure selectors over (events, playheadMs). Each fold is O(events) — logs are
 * a few hundred entries, so recomputing per UI tick is effectively free.
 */

export type NodeStatus =
  | 'idle'
  | 'active'
  | 'retrying'
  | 'waiting' // open approval gate
  | 'done'
  | 'error'
  | 'skipped'

export interface NodeRuntime {
  status: NodeStatus
  attempt: number
  streamText: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  startedAt?: number
  ms?: number
  error?: string
  outputPreview?: string
  inputPreview?: string
  retryReason?: string
}

const STREAM_TAIL = 220

export function deriveNodes(events: RunEvent[], t: number): Record<string, NodeRuntime> {
  const nodes: Record<string, NodeRuntime> = {}
  const get = (id: string): NodeRuntime =>
    (nodes[id] ??= {
      status: 'idle',
      attempt: 1,
      streamText: '',
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
    })

  for (const e of events) {
    if (e.t > t) break
    switch (e.kind) {
      case 'node.start': {
        const n = get(e.node)
        n.status = 'active'
        n.attempt = e.attempt
        n.startedAt = e.t
        n.inputPreview = e.inputPreview
        break
      }
      case 'llm.chunk': {
        const n = get(e.node)
        n.streamText = (n.streamText + e.text).slice(-STREAM_TAIL)
        n.tokensOut += e.tokens
        break
      }
      case 'node.retry': {
        const n = get(e.node)
        n.status = 'retrying'
        n.attempt = e.attempt
        n.retryReason = e.reason
        break
      }
      case 'tool.result': {
        const n = get(e.node)
        if (e.ok) n.status = 'active'
        break
      }
      case 'gate.open': {
        get(e.node).status = 'waiting'
        break
      }
      case 'gate.close': {
        get(e.node).status = 'active'
        break
      }
      case 'node.end': {
        const n = get(e.node)
        n.status = e.status === 'ok' ? 'done' : e.status === 'skipped' ? 'skipped' : 'error'
        n.ms = e.ms
        n.tokensIn = e.tokensIn
        n.tokensOut = e.tokensOut || n.tokensOut
        n.costUsd = e.costUsd
        n.error = e.error
        n.outputPreview = e.outputPreview
        break
      }
    }
  }
  return nodes
}

export interface EdgeFlow {
  edge: string
  /** 0..1 packet position */
  progress: number
}

export function deriveFlows(events: RunEvent[], t: number): EdgeFlow[] {
  const flows: EdgeFlow[] = []
  for (const e of events) {
    if (e.t > t) break
    if (e.kind === 'edge.flow' && t < e.t + e.ms) {
      flows.push({ edge: e.edge, progress: (t - e.t) / e.ms })
    }
  }
  return flows
}

/** edges whose flow already completed — rendered as "warm" paths */
export function deriveUsedEdges(events: RunEvent[], t: number): Set<string> {
  const used = new Set<string>()
  for (const e of events) {
    if (e.t > t) break
    if (e.kind === 'edge.flow' && t >= e.t + e.ms) used.add(e.edge)
  }
  return used
}

export interface HudTotals {
  tokensIn: number
  tokensOut: number
  costUsd: number
  llmStreamed: number
  toolCalls: number
  retries: number
  errors: number
  elapsed: number
  status: 'idle' | 'running' | 'success' | 'failed' | 'rejected' | 'waiting'
}

export function deriveHud(events: RunEvent[], t: number): HudTotals {
  const hud: HudTotals = {
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    llmStreamed: 0,
    toolCalls: 0,
    retries: 0,
    errors: 0,
    elapsed: 0,
    status: events.length === 0 ? 'idle' : 'running',
  }
  let waiting = false
  for (const e of events) {
    if (e.t > t) break
    hud.elapsed = e.t
    switch (e.kind) {
      case 'llm.chunk':
        hud.tokensOut += e.tokens
        hud.llmStreamed += e.tokens
        break
      case 'tool.call':
        hud.toolCalls += 1
        break
      case 'node.retry':
        hud.retries += 1
        break
      case 'gate.open':
        waiting = true
        break
      case 'gate.close':
        waiting = false
        break
      case 'node.end':
        hud.tokensIn += e.tokensIn
        hud.costUsd += e.costUsd
        if (e.status === 'error') hud.errors += 1
        break
      case 'run.end':
        hud.status = e.status
        break
    }
  }
  if (hud.status === 'running') {
    hud.elapsed = Math.min(
      t,
      events.length ? events[events.length - 1].t : t,
    )
    if (waiting) hud.status = 'waiting'
  }
  return hud
}

export interface Span {
  id: string
  parentId: string | null
  node: string | null
  name: string
  kind: NodeKind | 'toolcall' | 'gate'
  start: number
  end: number
  status: 'ok' | 'error' | 'skipped' | 'open'
  tokens: number
  costUsd: number
  detail?: Json
  attempt?: number
}

/** full-run span tree for the trace waterfall (render clips rows by playhead) */
export function deriveSpans(
  events: RunEvent[],
  nodeKind: (id: string) => NodeKind,
  nodeLabel: (id: string) => string,
): Span[] {
  const spans: Span[] = []
  const openNode: Record<string, Span> = {}
  const openTool: Record<string, Span> = {}
  const openGate: Record<string, Span> = {}
  const endT = events.length ? events[events.length - 1].t : 0

  for (const e of events) {
    switch (e.kind) {
      case 'node.start': {
        if (openNode[e.node]) break // retries stay within one node span
        const span: Span = {
          id: `n:${e.node}`,
          parentId: null,
          node: e.node,
          name: nodeLabel(e.node),
          kind: nodeKind(e.node),
          start: e.t,
          end: endT,
          status: 'open',
          tokens: 0,
          costUsd: 0,
          attempt: e.attempt,
        }
        openNode[e.node] = span
        spans.push(span)
        break
      }
      case 'tool.call': {
        const span: Span = {
          id: `t:${e.span}`,
          parentId: `n:${e.node}`,
          node: e.node,
          name: e.tool,
          kind: 'toolcall',
          start: e.t,
          end: endT,
          status: 'open',
          tokens: 0,
          costUsd: 0,
          detail: e.args,
        }
        openTool[e.span] = span
        spans.push(span)
        break
      }
      case 'tool.result': {
        const span = openTool[e.span]
        if (span) {
          span.end = e.t
          span.status = e.ok ? 'ok' : 'error'
          span.detail = { args: span.detail ?? null, result: e.result }
          delete openTool[e.span]
        }
        break
      }
      case 'node.retry': {
        const span = openNode[e.node]
        if (span) span.attempt = e.attempt
        break
      }
      case 'gate.open': {
        const span: Span = {
          id: `g:${e.gate}`,
          parentId: `n:${e.node}`,
          node: e.node,
          name: e.title,
          kind: 'gate',
          start: e.t,
          end: endT,
          status: 'open',
          tokens: 0,
          costUsd: 0,
          detail: { reason: e.reason, proposed: e.proposed },
        }
        openGate[e.gate] = span
        spans.push(span)
        break
      }
      case 'gate.close': {
        const span = openGate[e.gate]
        if (span) {
          span.end = e.t
          span.status = e.decision === 'rejected' ? 'error' : 'ok'
          delete openGate[e.gate]
        }
        break
      }
      case 'node.end': {
        const span = openNode[e.node]
        if (span) {
          span.end = e.t
          span.status = e.status === 'ok' ? 'ok' : e.status === 'skipped' ? 'skipped' : 'error'
          span.tokens = e.tokensIn + e.tokensOut
          span.costUsd = e.costUsd
          delete openNode[e.node]
        }
        break
      }
    }
  }
  return spans
}

export function deriveOpenGate(events: RunEvent[], t: number) {
  let open: Extract<RunEvent, { kind: 'gate.open' }> | null = null
  for (const e of events) {
    if (e.t > t) break
    if (e.kind === 'gate.open') open = e
    if (e.kind === 'gate.close' && open && e.gate === open.gate) open = null
  }
  return open
}

/** playhead times of "interesting" moments for scrubber markers / cmd-k jumps */
export function deriveMarkers(events: RunEvent[]) {
  return events
    .filter((e) => e.kind === 'node.retry' || e.kind === 'gate.open' || (e.kind === 'node.end' && e.status === 'error'))
    .map((e) => ({
      t: e.t,
      type: e.kind === 'node.retry' ? ('retry' as const) : e.kind === 'gate.open' ? ('gate' as const) : ('error' as const),
      node: 'node' in e ? e.node : '',
    }))
}
