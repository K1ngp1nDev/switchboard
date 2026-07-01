import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import { NODE_WIDTH as NW } from './useElkLayout'
import { deriveFlows, deriveNodes, deriveUsedEdges } from '../engine/derive'
import { getScenario } from '../scenarios'
import { selectedRun, useStore } from '../store/useStore'
import { AgentNode } from './AgentNode'
import { PacketEdge } from './PacketEdge'
import { useElkLayout, NODE_WIDTH } from './useElkLayout'

const nodeTypes = { agent: AgentNode }
const edgeTypes = { packet: PacketEdge }

/** flies the viewport to whichever node just became active */
function useCameraDirector(activeNodeIds: string[], positions: ReturnType<typeof useElkLayout>) {
  const follow = useStore((s) => s.follow)
  const playing = useStore((s) => s.playing)
  const focusNodeId = useStore((s) => s.focusNodeId)
  const requestFocusNode = useStore((s) => s.requestFocusNode)
  const { setCenter, getZoom } = useReactFlow()
  const lastCentered = useRef<string | null>(null)

  const target = activeNodeIds[activeNodeIds.length - 1] ?? null

  useEffect(() => {
    if (!follow || !playing || !target || !positions) return
    if (lastCentered.current === target) return
    lastCentered.current = target
    const pos = positions[target]
    if (!pos) return
    void setCenter(pos.x + NODE_WIDTH / 2, pos.y + 40, {
      duration: 620,
      zoom: Math.max(getZoom(), 0.85),
    })
  }, [target, follow, playing, positions, setCenter, getZoom])

  // one-shot fly-to from cmd-k / trace clicks
  useEffect(() => {
    if (!focusNodeId || !positions) return
    const pos = positions[focusNodeId]
    if (pos) {
      void setCenter(pos.x + NODE_WIDTH / 2, pos.y + 40, { duration: 550, zoom: 1.05 })
    }
    requestFocusNode(null)
  }, [focusNodeId, positions, setCenter, requestFocusNode])
}

export function FlowCanvas() {
  const run = useStore(selectedRun)
  const coarseT = useStore((s) => s.coarseT)
  const theme = useStore((s) => s.theme)
  const hoverNodeId = useStore((s) => s.hoverNodeId)
  const selectSpan = useStore((s) => s.selectSpan)
  const scenario = getScenario(run.scenarioId)
  const positions = useElkLayout(scenario)
  const { fitView } = useReactFlow()

  const runtimes = useMemo(() => deriveNodes(run.events, coarseT), [run, coarseT])
  const flows = useMemo(() => deriveFlows(run.events, coarseT), [run, coarseT])
  const usedEdges = useMemo(() => deriveUsedEdges(run.events, coarseT), [run, coarseT])

  const activeNodeIds = useMemo(
    () =>
      Object.entries(runtimes)
        .filter(([, rt]) => rt.status === 'active' || rt.status === 'retrying' || rt.status === 'waiting')
        .sort((a, b) => (a[1].startedAt ?? 0) - (b[1].startedAt ?? 0))
        .map(([id]) => id),
    [runtimes],
  )

  useCameraDirector(activeNodeIds, positions)

  const nodes: Node[] = useMemo(() => {
    if (!positions) return []
    return scenario.nodes.map((def) => ({
      id: def.id,
      type: 'agent' as const,
      position: positions[def.id] ?? { x: 0, y: 0 },
      data: {
        def,
        rt: runtimes[def.id] ?? {
          status: 'idle' as const,
          attempt: 1,
          streamText: '',
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
        },
      },
      draggable: false,
      connectable: false,
      className: hoverNodeId === def.id ? 'node-hovered' : undefined,
    }))
  }, [scenario, positions, runtimes, hoverNodeId])

  const edges: Edge[] = useMemo(() => {
    const flowByEdge = new Map(flows.map((f) => [f.edge, f.progress]))
    return scenario.edges.map((e) => {
      const progress = flowByEdge.get(e.id) ?? null
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'packet' as const,
        data: { progress },
        className:
          progress !== null ? 'edge-flowing' : usedEdges.has(e.id) ? 'edge-done' : undefined,
      }
    })
  }, [scenario, flows, usedEdges])

  // Frame the graph at a readable zoom: fit when it fits, otherwise center at
  // a fixed zoom and let the graph flow off both edges (camera-follow and the
  // minimap carry the rest).
  const { setViewport } = useReactFlow()
  const frameGraph = useCallback(
    (animate: boolean) => {
      if (!positions) return
      const xs = Object.values(positions)
      const minX = Math.min(...xs.map((p) => p.x))
      const maxX = Math.max(...xs.map((p) => p.x)) + NW
      const minY = Math.min(...xs.map((p) => p.y))
      const maxY = Math.max(...xs.map((p) => p.y)) + 120
      const el = document.querySelector('.react-flow') as HTMLElement | null
      const vw = el?.clientWidth ?? 1200
      const vh = el?.clientHeight ?? 700
      const fitZoom = Math.min((vw * 0.88) / (maxX - minX), (vh * 0.8) / (maxY - minY))
      if (fitZoom >= 0.62) {
        void fitView({ padding: 0.15, duration: animate ? 500 : 0 })
      } else {
        const zoom = vw < 520 ? 0.52 : 0.68
        void setViewport(
          {
            x: vw / 2 - ((minX + maxX) / 2) * zoom,
            y: vh / 2 - ((minY + maxY) / 2) * zoom,
            zoom,
          },
          { duration: animate ? 500 : 0 },
        )
      }
    },
    [positions, fitView, setViewport],
  )

  useEffect(() => {
    if (!positions) return
    const id = window.setTimeout(() => frameGraph(true), 50)
    return () => window.clearTimeout(id)
  }, [scenario.id, positions, frameGraph])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.3}
      maxZoom={1.6}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      proOptions={{ hideAttribution: false }}
      onNodeClick={(_, node) => selectSpan(`n:${node.id}`)}
      colorMode={theme}
      className="canvas-dots"
    >
      <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="transparent" />
      <Controls showInteractive={false} position="bottom-right" />
      <MiniMap
        position="top-right"
        pannable
        zoomable
        className="minimap-panel !hidden xl:!block"
        style={{ width: 148, height: 88 }}
        bgColor="transparent"
        maskColor="color-mix(in srgb, var(--bg) 45%, transparent)"
        nodeColor="var(--faint)"
        nodeStrokeColor="transparent"
        nodeBorderRadius={3}
      />
    </ReactFlow>
  )
}
