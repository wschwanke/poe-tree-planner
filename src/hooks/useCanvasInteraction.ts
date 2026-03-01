import { useCallback, useRef } from 'react'
import { hitTest } from '@/canvas/hit-detection'
import type { SpatialIndex } from '@/data/graph'
import type { ProcessedNode, ViewportState } from '@/types/skill-tree'

const CLICK_THRESHOLD = 5

export interface NodeClickEvent {
  nodeId: string
  ctrlKey: boolean
  altKey: boolean
  button: number
}

interface UseCanvasInteractionProps {
  processedNodes: Map<string, ProcessedNode>
  spatialIndex: SpatialIndex
  viewport: ViewportState
  onPan: (dx: number, dy: number) => void
  onNodeClick: (event: NodeClickEvent) => void
  onHover: (nodeId: string | null) => void
}

export function useCanvasInteraction({
  processedNodes,
  spatialIndex,
  viewport,
  onPan,
  onNodeClick,
  onHover,
}: UseCanvasInteractionProps) {
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const totalDrag = useRef(0)
  const mouseButton = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStart.current = { x: e.clientX, y: e.clientY }
    totalDrag.current = 0
    mouseButton.current = e.button
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - dragStart.current.x
        const dy = e.clientY - dragStart.current.y
        totalDrag.current += Math.abs(dx) + Math.abs(dy)
        dragStart.current = { x: e.clientX, y: e.clientY }
        onPan(dx, dy)
      } else {
        // Hover detection
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const hit = hitTest(x, y, viewport, processedNodes, spatialIndex)
        onHover(hit)
      }
    },
    [viewport, processedNodes, spatialIndex, onPan, onHover],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging.current && totalDrag.current < CLICK_THRESHOLD) {
        // This was a click, not a drag
        const rect = (e.target as HTMLCanvasElement).getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const hit = hitTest(x, y, viewport, processedNodes, spatialIndex)
        if (hit) {
          onNodeClick({ nodeId: hit, ctrlKey: e.ctrlKey, altKey: e.altKey, button: mouseButton.current })
        }
      }
      isDragging.current = false
    },
    [viewport, processedNodes, spatialIndex, onNodeClick],
  )

  const handleMouseLeave = useCallback(() => {
    isDragging.current = false
    onHover(null)
  }, [onHover])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
  }
}
