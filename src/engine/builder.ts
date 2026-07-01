import type {
  ApprovalDecision,
  GateDecision,
  Json,
  Rng,
  RunBuilderApi,
  RunEvent,
  Scenario,
  ScriptContext,
  SimResult,
} from './types'
import { estimateTokens, llmCost } from './pricing'

/** thrown when a script reaches an unanswered approval gate */
class StopScript extends Error {
  constructor() {
    super('waiting-for-approval')
  }
}

class EndRun extends Error {
  constructor(public status: 'failed' | 'rejected') {
    super('run-ended')
  }
}

const FLOW_MS = 460

function preview(value: Json, max = 96): string {
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

class RunBuilder implements RunBuilderApi {
  private events: RunEvent[] = []
  private now = 0
  private done = new Set<string>()
  private spanSeq = 0
  private rng: Rng
  private decisions: ApprovalDecision[]
  private scenario: Scenario
  pendingGate: Extract<RunEvent, { kind: 'gate.open' }> | null = null
  finalStatus: 'success' | 'failed' | 'rejected' | 'waiting' | null = null

  constructor(scenario: Scenario, rng: Rng, decisions: ApprovalDecision[]) {
    this.scenario = scenario
    this.rng = rng
    this.decisions = decisions
  }

  private emit(e: RunEvent) {
    this.events.push(e)
  }

  /** animate packets on every edge whose completed source feeds this node */
  private flowsInto(node: string, startT: number) {
    for (const edge of this.scenario.edges) {
      if (edge.target === node && this.done.has(edge.source)) {
        const t = Math.max(0, startT - FLOW_MS)
        this.emit({ kind: 'edge.flow', t, edge: edge.id, ms: startT - t })
      }
    }
  }

  private startNode(node: string, attempt = 1, inputPreview?: string) {
    this.flowsInto(node, this.now)
    this.emit({ kind: 'node.start', t: this.now, node, attempt, inputPreview })
  }

  trigger(node: string, opts: { label: string; payload?: Json }) {
    this.emit({ kind: 'run.start', t: 0, trigger: opts.label })
    this.startNode(node, 1, opts.label)
    const ms = this.rng.int(90, 220)
    this.now += ms
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: 'ok',
      ms,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      output: opts.payload,
      outputPreview: preview(opts.payload ?? opts.label),
    })
    this.done.add(node)
  }

  llm(
    node: string,
    opts: {
      text: string
      promptTokens: number
      model: string
      tokensPerSec?: number
      firstTokenMs?: number
      output?: Json
    },
  ) {
    const start = this.now
    this.startNode(node)
    const firstToken = opts.firstTokenMs ?? this.rng.int(520, 1500)
    const tps = opts.tokensPerSec ?? this.rng.range(38, 68)
    this.now = start + firstToken

    // stream in word-group chunks — one event per ~3-8 words
    const words = opts.text.split(/\s+/)
    let totalTokens = 0
    let i = 0
    while (i < words.length) {
      const n = Math.min(this.rng.int(3, 8), words.length - i)
      const chunkText = (i === 0 ? '' : ' ') + words.slice(i, i + n).join(' ')
      const tokens = estimateTokens(chunkText)
      totalTokens += tokens
      this.emit({ kind: 'llm.chunk', t: this.now, node, text: chunkText, tokens })
      this.now += Math.round((tokens / tps) * 1000 * this.rng.range(0.75, 1.35))
      i += n
    }

    const ms = this.now - start
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: 'ok',
      ms,
      tokensIn: opts.promptTokens,
      tokensOut: totalTokens,
      costUsd: llmCost(opts.model, opts.promptTokens, totalTokens),
      output: opts.output,
      outputPreview: preview(opts.text, 110),
    })
    this.done.add(node)
  }

  tool(
    node: string,
    opts: {
      tool: string
      args: Json
      result: Json
      ms?: number
      failures?: { count: number; reason: string; result?: Json }
      maxAttempts?: number
    },
  ): boolean {
    const start = this.now
    const maxAttempts = opts.maxAttempts ?? 3
    const failures = opts.failures?.count ?? 0
    this.startNode(node, 1, preview(opts.args))

    let attempt = 1
    while (true) {
      const span = `${node}#${++this.spanSeq}`
      const callMs = Math.round((opts.ms ?? this.rng.int(180, 650)) * this.rng.range(0.8, 1.3))
      this.emit({ kind: 'tool.call', t: this.now, node, span, tool: opts.tool, args: opts.args })
      this.now += callMs
      const failing = attempt <= failures
      this.emit({
        kind: 'tool.result',
        t: this.now,
        node,
        span,
        ok: !failing,
        ms: callMs,
        result: failing
          ? (opts.failures?.result ?? { error: opts.failures?.reason ?? 'transient error' })
          : opts.result,
      })

      if (!failing) {
        const ms = this.now - start
        this.emit({
          kind: 'node.end',
          t: this.now,
          node,
          status: 'ok',
          ms,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          output: opts.result,
          outputPreview: preview(opts.result),
        })
        this.done.add(node)
        return true
      }

      if (attempt >= maxAttempts) {
        const ms = this.now - start
        this.emit({
          kind: 'node.end',
          t: this.now,
          node,
          status: 'error',
          ms,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          error: opts.failures?.reason ?? 'tool failed',
        })
        return false
      }

      const backoffMs = Math.round(800 * Math.pow(2, attempt - 1) * this.rng.range(0.85, 1.25))
      attempt += 1
      this.emit({
        kind: 'node.retry',
        t: this.now,
        node,
        attempt,
        reason: opts.failures?.reason ?? 'transient error',
        backoffMs,
      })
      this.now += backoffMs
    }
  }

  router(node: string, opts: { decision: string; ms?: number }) {
    this.startNode(node)
    const ms = opts.ms ?? this.rng.int(40, 130)
    this.now += ms
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: 'ok',
      ms,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      outputPreview: `→ ${opts.decision}`,
      output: { decision: opts.decision },
    })
    this.done.add(node)
  }

  guardrail(node: string, opts: { checks: { name: string; pass: boolean }[]; ms?: number }) {
    this.startNode(node)
    const ms = opts.ms ?? this.rng.int(160, 420)
    this.now += ms
    const failed = opts.checks.filter((c) => !c.pass)
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: 'ok',
      ms,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      output: opts.checks as unknown as Json,
      outputPreview:
        failed.length === 0
          ? `${opts.checks.length}/${opts.checks.length} checks passed`
          : `flagged: ${failed.map((f) => f.name).join(', ')}`,
    })
    this.done.add(node)
  }

  approval(
    node: string,
    opts: { gate: string; title: string; reason: string; current: Json; proposed: Json },
  ): { decision: GateDecision; finalState: Json } {
    this.startNode(node)
    const open: Extract<RunEvent, { kind: 'gate.open' }> = {
      kind: 'gate.open',
      t: this.now,
      node,
      gate: opts.gate,
      title: opts.title,
      reason: opts.reason,
      current: opts.current,
      proposed: opts.proposed,
    }
    this.emit(open)

    const decision = this.decisions.find((d) => d.gateId === opts.gate)
    if (!decision) {
      this.pendingGate = open
      throw new StopScript()
    }

    const humanMs = this.rng.int(6500, 16000)
    this.now += humanMs
    const finalState =
      decision.decision === 'edited' ? (decision.editedState ?? opts.proposed) : opts.proposed
    this.emit({
      kind: 'gate.close',
      t: this.now,
      node,
      gate: opts.gate,
      decision: decision.decision,
      actor: decision.actor ?? 'you',
      finalState: decision.decision === 'rejected' ? undefined : finalState,
    })
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: decision.decision === 'rejected' ? 'error' : 'ok',
      ms: humanMs,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      outputPreview:
        decision.decision === 'rejected'
          ? 'rejected by reviewer'
          : decision.decision === 'edited'
            ? 'approved with edits'
            : 'approved',
      error: decision.decision === 'rejected' ? 'rejected by reviewer' : undefined,
    })
    if (decision.decision !== 'rejected') this.done.add(node)
    return { decision: decision.decision, finalState }
  }

  output(node: string, opts: { label: string; payload?: Json }) {
    this.startNode(node)
    const ms = this.rng.int(60, 160)
    this.now += ms
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: 'ok',
      ms,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      output: opts.payload,
      outputPreview: opts.label,
    })
    this.done.add(node)
    this.emit({ kind: 'run.end', t: this.now, status: 'success' })
    this.finalStatus = 'success'
  }

  skip(node: string, reason = 'branch not taken') {
    this.emit({ kind: 'node.start', t: this.now, node, attempt: 1 })
    this.emit({
      kind: 'node.end',
      t: this.now,
      node,
      status: 'skipped',
      ms: 0,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      outputPreview: reason,
    })
  }

  parallel(branches: Array<() => void>) {
    const t0 = this.now
    const ends: number[] = []
    for (const branch of branches) {
      this.now = t0
      branch()
      ends.push(this.now)
    }
    this.now = Math.max(t0, ...ends)
  }

  wait(ms: number) {
    this.now += ms
  }

  fail(_reason: string, as: 'failed' | 'rejected' = 'failed') {
    this.emit({ kind: 'run.end', t: this.now, status: as === 'rejected' ? 'rejected' : 'failed' })
    this.finalStatus = as
    throw new EndRun(as)
  }

  finish(): SimResult {
    // stable order: by time, insertion order breaks ties
    const events = this.events
      .map((e, i) => [e, i] as const)
      .sort((a, b) => a[0].t - b[0].t || a[1] - b[1])
      .map(([e]) => e)
    const status = this.finalStatus ?? (this.pendingGate ? 'waiting' : 'failed')
    const duration = events.length ? events[events.length - 1].t : 0
    return { events, status, duration, pendingGate: this.pendingGate }
  }
}

export function simulate(
  scenario: Scenario,
  seed: number,
  variant: number,
  decisions: ApprovalDecision[],
  rngFactory: (seed: number) => Rng,
): SimResult {
  const rng = rngFactory(seed)
  const builder = new RunBuilder(scenario, rng, decisions)
  const ctx: ScriptContext = { rng, variant: variant % scenario.variants, decisions }
  try {
    scenario.script(builder, ctx)
    // scripts must end with output() or fail(); guard anyway
    if (builder.finalStatus === null && builder.pendingGate === null) {
      builder.fail('script ended without terminal node')
    }
  } catch (e) {
    if (!(e instanceof StopScript) && !(e instanceof EndRun)) throw e
  }
  return builder.finish()
}
