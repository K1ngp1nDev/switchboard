import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { ScenarioNode } from '../engine/types'
import type { NodeRuntime } from '../engine/derive'
import { NODE_ICONS, CheckIcon, XIcon, SpinnerIcon, ClockIcon } from '../ui/icons'
import { nodeHeight, NODE_WIDTH } from './useElkLayout'

export type AgentNodeType = Node<{ def: ScenarioNode; rt: NodeRuntime }, 'agent'>

function StatusGlyph({ rt }: { rt: NodeRuntime }) {
  switch (rt.status) {
    case 'active':
      return <SpinnerIcon className="h-3.5 w-3.5 text-accent" />
    case 'retrying':
      return (
        <span className="mono-nums pulse-soft rounded px-1 py-px text-[9px] font-medium tracking-wide text-accent">
          RETRY ×{rt.attempt}
        </span>
      )
    case 'waiting':
      return <ClockIcon className="pulse-soft h-3.5 w-3.5 text-accent" />
    case 'done':
      return <CheckIcon className="h-3.5 w-3.5 text-ok" />
    case 'error':
      return <XIcon className="h-3.5 w-3.5 text-err" />
    case 'skipped':
      return <span className="text-[9px] tracking-[0.14em] text-faint uppercase">skip</span>
    default:
      return <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
  }
}

function fmtCost(v: number) {
  return v >= 0.01 ? `$${v.toFixed(3)}` : `$${v.toFixed(4)}`
}

function fmtMs(v: number) {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`
}

export const AgentNode = memo(function AgentNode({ data, selected }: NodeProps<AgentNodeType>) {
  const { def, rt } = data
  const Icon = NODE_ICONS[def.kind]
  const showStream = def.kind === 'llm' && rt.streamText && rt.status !== 'idle' && rt.status !== 'skipped'
  const showPreview =
    def.kind !== 'llm' &&
    rt.status !== 'idle' &&
    rt.status !== 'skipped' &&
    (rt.outputPreview || rt.inputPreview)

  return (
    <div
      className="agent-node"
      data-status={rt.status}
      data-kind={def.kind}
      data-selected={selected || undefined}
      style={{ width: NODE_WIDTH, height: nodeHeight(def.kind) }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className="node-icon">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium tracking-tight">
          {def.label}
        </span>
        <StatusGlyph rt={rt} />
      </div>
      <p className="mono-nums truncate px-3 pt-0.5 text-[10px] text-dim">{def.sub}</p>

      {showStream && (
        <div className="stream-box nodrag">
          <span>{rt.streamText}</span>
          {rt.status === 'active' && <span className="stream-caret" />}
        </div>
      )}
      {showPreview && (
        <p className="mono-nums truncate px-3 pt-1.5 text-[9.5px] text-faint">
          {rt.status === 'error' ? rt.error : (rt.outputPreview ?? rt.inputPreview)}
        </p>
      )}

      {(rt.status === 'done' || rt.status === 'error') && (
        <div className="mono-nums absolute right-2 bottom-1.5 flex gap-1 text-[9px] text-faint">
          {rt.tokensIn + rt.tokensOut > 0 && (
            <span className="node-badge">{(rt.tokensIn + rt.tokensOut).toLocaleString()} tok</span>
          )}
          {rt.costUsd > 0 && <span className="node-badge">{fmtCost(rt.costUsd)}</span>}
          {rt.ms !== undefined && rt.ms > 0 && <span className="node-badge">{fmtMs(rt.ms)}</span>}
        </div>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
})
