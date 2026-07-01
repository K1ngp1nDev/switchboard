/**
 * The event log is the single source of truth. Every view — canvas node
 * states, timeline bars, trace waterfall, HUD totals, approval modal,
 * replay scrubber — is a pure function over (RunEvent[], playheadMs).
 * Nothing else holds run state.
 */

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

export type NodeKind =
  | 'trigger'
  | 'llm'
  | 'tool'
  | 'router'
  | 'guardrail'
  | 'approval'
  | 'output'

export interface ScenarioNode {
  id: string
  kind: NodeKind
  label: string
  /** secondary line: model id for llm, tool id for tool, condition for router */
  sub?: string
}

export interface ScenarioEdge {
  id: string
  source: string
  target: string
  label?: string
}

export type GateDecision = 'approved' | 'edited' | 'rejected'

export interface ApprovalDecision {
  gateId: string
  decision: GateDecision
  /** present when decision === 'edited' */
  editedState?: Json
  /** who decided — purely cosmetic in run history */
  actor?: string
}

/** All timestamps are ms offsets from run start. */
export type RunEvent =
  | { kind: 'run.start'; t: number; trigger: string }
  | { kind: 'node.start'; t: number; node: string; attempt: number; inputPreview?: string }
  | { kind: 'llm.chunk'; t: number; node: string; text: string; tokens: number }
  | { kind: 'tool.call'; t: number; node: string; span: string; tool: string; args: Json }
  | {
      kind: 'tool.result'
      t: number
      node: string
      span: string
      ok: boolean
      ms: number
      result: Json
    }
  | { kind: 'node.retry'; t: number; node: string; attempt: number; reason: string; backoffMs: number }
  | {
      kind: 'node.end'
      t: number
      node: string
      status: 'ok' | 'error' | 'skipped'
      ms: number
      tokensIn: number
      tokensOut: number
      costUsd: number
      output?: Json
      outputPreview?: string
      error?: string
    }
  | { kind: 'edge.flow'; t: number; edge: string; ms: number }
  | {
      kind: 'gate.open'
      t: number
      node: string
      gate: string
      title: string
      reason: string
      current: Json
      proposed: Json
    }
  | {
      kind: 'gate.close'
      t: number
      node: string
      gate: string
      decision: GateDecision
      actor: string
      finalState?: Json
    }
  | { kind: 'run.end'; t: number; status: 'success' | 'failed' | 'rejected' }

export type RunFinal = 'success' | 'failed' | 'rejected' | 'waiting'

export interface SimResult {
  events: RunEvent[]
  /** final status; 'waiting' when the script stopped at an unanswered gate */
  status: RunFinal
  /** ms of the last event */
  duration: number
  /** open gate if status === 'waiting' */
  pendingGate: Extract<RunEvent, { kind: 'gate.open' }> | null
}

export interface Scenario {
  id: string
  name: string
  /** short product-style descriptor shown in the switcher */
  tagline: string
  /** one-line trigger description template; builder receives concrete label per run */
  nodes: ScenarioNode[]
  edges: ScenarioEdge[]
  /** number of content variants the script supports (variant = 0..variants-1) */
  variants: number
  script: (b: RunBuilderApi, ctx: ScriptContext) => void
}

export interface ScriptContext {
  /** deterministic PRNG — the only randomness allowed in a script */
  rng: Rng
  /** picks canned content branch */
  variant: number
  /** recorded gate decisions (replay continues through them) */
  decisions: ApprovalDecision[]
}

export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [min, max] inclusive */
  int(min: number, max: number): number
  /** float in [min, max) */
  range(min: number, max: number): number
  pick<T>(arr: readonly T[]): T
}

/** High-level ops scenarios use; the builder turns them into low-level events. */
export interface RunBuilderApi {
  trigger(node: string, opts: { label: string; payload?: Json }): void
  llm(
    node: string,
    opts: {
      /** canned completion, streamed in chunks */
      text: string
      promptTokens: number
      model: string
      /** default ~55 tok/s with jitter */
      tokensPerSec?: number
      /** "thinking" latency before the first token */
      firstTokenMs?: number
      output?: Json
    },
  ): void
  tool(
    node: string,
    opts: {
      tool: string
      args: Json
      result: Json
      ms?: number
      /** scripted failures before success; if attempts exceed maxAttempts the node errors */
      failures?: { count: number; reason: string; result?: Json }
      maxAttempts?: number
    },
  ): boolean // false when the node ended in error
  router(node: string, opts: { decision: string; ms?: number }): void
  guardrail(node: string, opts: { checks: { name: string; pass: boolean }[]; ms?: number }): void
  /**
   * Human gate. Returns the decision when one is recorded; otherwise emits
   * gate.open, stops the script (throws StopScript) and the run is 'waiting'.
   */
  approval(
    node: string,
    opts: { gate: string; title: string; reason: string; current: Json; proposed: Json },
  ): { decision: GateDecision; finalState: Json }
  output(node: string, opts: { label: string; payload?: Json }): void
  skip(node: string, reason?: string): void
  /** run branches with overlapping time windows; time resumes at the latest branch end */
  parallel(branches: Array<() => void>): void
  /** idle gap, e.g. queue wait */
  wait(ms: number): void
  /** terminate the run; 'rejected' is for human gate rejections */
  fail(reason: string, as?: 'failed' | 'rejected'): void
}
