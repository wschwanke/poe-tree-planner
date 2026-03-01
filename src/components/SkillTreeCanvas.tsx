import { useCallback, useEffect, useRef } from 'react'
import { render } from '@/canvas/renderer'
import { useAllocation } from '@/hooks/useAllocation'
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction'
import type { SkillTreeContext } from '@/hooks/useSkillTree'
import { useViewport } from '@/hooks/useViewport'
import { ClassSelectionDialog } from './ClassSelectionDialog'
import { NodeTooltip } from './NodeTooltip'
import { PointCounter } from './PointCounter'
import { StatSummaryPanel } from './StatSummaryPanel'

interface SkillTreeCanvasProps {
  context: SkillTreeContext
}

export function SkillTreeCanvas({ context }: SkillTreeCanvasProps) {
  const { data, processedNodes, adjacency, spatialIndex, sprites } = context
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { viewport, handlePan, handleCenterOn } = useViewport(canvasRef)
  const totalPoints = data.points.totalPoints

  const { state, canAllocateNodes, pointsUsed, selectClass, handleNodeClick, setHovered, reset } =
    useAllocation(processedNodes, adjacency, totalPoints)

  const interaction = useCanvasInteraction({
    processedNodes,
    spatialIndex,
    viewport,
    onPan: handlePan,
    onNodeClick: handleNodeClick,
    onHover: setHovered,
  })

  const handleClassSelect = useCallback(
    (classIndex: number, startNodeId: string) => {
      selectClass(classIndex, startNodeId)
      const pn = processedNodes.get(startNodeId)
      if (pn) {
        handleCenterOn(pn.worldX, pn.worldY, 0.35)
      }
    },
    [selectClass, processedNodes, handleCenterOn],
  )

  const handleReset = useCallback(() => {
    reset()
  }, [reset])

  // Preload sprites when zoom changes
  useEffect(() => {
    sprites.preloadAllCategories(viewport.zoom)
  }, [sprites, viewport.zoom])

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size for DPR
    const dpr = window.devicePixelRatio || 1
    canvas.width = viewport.width * dpr
    canvas.height = viewport.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    let animId: number
    const frame = () => {
      render(ctx, viewport, {
        data,
        processedNodes,
        adjacency,
        spatialIndex,
        sprites,
        allocatedNodes: state.allocatedNodes,
        canAllocateNodes,
        hoveredNodeId: state.hoveredNodeId,
      })
      animId = requestAnimationFrame(frame)
    }
    animId = requestAnimationFrame(frame)

    return () => cancelAnimationFrame(animId)
  }, [viewport, data, processedNodes, adjacency, spatialIndex, sprites, state, canAllocateNodes])

  const hoveredNode = state.hoveredNodeId ? processedNodes.get(state.hoveredNodeId) : null

  return (
    <div className="relative w-full h-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        style={{ width: viewport.width, height: viewport.height }}
        onMouseDown={interaction.handleMouseDown}
        onMouseMove={interaction.handleMouseMove}
        onMouseUp={interaction.handleMouseUp}
        onMouseLeave={interaction.handleMouseLeave}
      />

      {/* Class selection dialog */}
      <ClassSelectionDialog
        open={state.selectedClass === null}
        data={data}
        processedNodes={processedNodes}
        onSelect={handleClassSelect}
      />

      {/* Point counter */}
      {state.selectedClass !== null && <PointCounter used={pointsUsed} total={totalPoints} />}

      {/* Node tooltip */}
      {hoveredNode?.node.name && (
        <div className="absolute inset-0 pointer-events-none">
          <NodeTooltip
            node={hoveredNode}
            viewport={viewport}
            allocated={state.allocatedNodes.has(hoveredNode.id)}
          />
        </div>
      )}

      {/* Stat summary panel */}
      {state.selectedClass !== null && (
        <StatSummaryPanel
          allocatedNodes={state.allocatedNodes}
          processedNodes={processedNodes}
          pointsUsed={pointsUsed}
          totalPoints={totalPoints}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
