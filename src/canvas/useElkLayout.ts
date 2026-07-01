import { useEffect, useState } from 'react'
import type ELKType from 'elkjs'
import type { Scenario } from '../engine/types'

export interface NodePosition {
  x: number
  y: number
}

export const NODE_WIDTH = 236
export function nodeHeight(kind: string): number {
  return kind === 'llm' ? 118 : kind === 'trigger' || kind === 'output' ? 66 : 84
}

const cache = new Map<string, Record<string, NodePosition>>()

// elkjs is ~1.4MB minified — keep it out of the entry chunk
let elkPromise: Promise<InstanceType<typeof ELKType>> | null = null
function getElk() {
  elkPromise ??= import('elkjs/lib/elk.bundled.js').then((m) => new m.default())
  return elkPromise
}

async function layout(scenario: Scenario): Promise<Record<string, NodePosition>> {
  const elk = await getElk()
  const res = await elk.layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '84',
      'elk.spacing.nodeNode': '46',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: scenario.nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: nodeHeight(n.kind),
    })),
    edges: scenario.edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  })
  const out: Record<string, NodePosition> = {}
  for (const child of res.children ?? []) {
    out[child.id] = { x: child.x ?? 0, y: child.y ?? 0 }
  }
  cache.set(scenario.id, out)
  return out
}

export function useElkLayout(scenario: Scenario): Record<string, NodePosition> | null {
  const [positions, setPositions] = useState<Record<string, NodePosition> | null>(
    () => cache.get(scenario.id) ?? null,
  )

  useEffect(() => {
    const cached = cache.get(scenario.id)
    if (cached) {
      setPositions(cached)
      return
    }
    let cancelled = false
    layout(scenario).then((pos) => {
      if (!cancelled) setPositions(pos)
    })
    return () => {
      cancelled = true
    }
  }, [scenario])

  return positions
}
