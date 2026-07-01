import { memo } from 'react'
import { BaseEdge, getBezierPath, type EdgeProps, type Edge } from '@xyflow/react'

export type PacketEdgeType = Edge<{ progress: number | null }, 'packet'>

/**
 * Bezier edge with "data packets" riding the path while a flow event is
 * active. Packet position comes from the event log (progress 0..1), so
 * pausing and scrubbing move packets correctly — nothing is a fire-and-forget
 * CSS animation.
 */
export const PacketEdge = memo(function PacketEdge(props: EdgeProps<PacketEdgeType>) {
  const [path] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  })
  const progress = props.data?.progress ?? null

  return (
    <>
      <BaseEdge id={props.id} path={path} />
      {progress !== null &&
        [0, 1].map((i) => {
          const p = Math.max(0, Math.min(1, progress - i * 0.13))
          return (
            <circle
              key={i}
              r={i === 0 ? 3.2 : 2}
              className="edge-packet"
              style={{
                offsetPath: `path('${path}')`,
                offsetDistance: `${p * 100}%`,
                opacity: i === 0 ? 1 : 0.55,
              }}
            />
          )
        })}
    </>
  )
})
