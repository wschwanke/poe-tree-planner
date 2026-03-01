import { useCallback, useEffect, useRef } from 'react'
import { render } from '@/canvas/renderer'
import { useAllocation } from '@/hooks/useAllocation'
import { useCanvasInteraction } from '@/hooks/useCanvasInteraction'
import type { SkillTreeContext } from '@/hooks/useSkillTree'
import { useViewport } from '@/hooks/useViewport'
import { ClassSelector } from './ClassSelectionDialog'
import { MasterySelectionDialog } from './MasterySelectionDialog'
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

  const {
    state,
    canAllocateNodes,
    pointsUsed,
    selectClass,
    handleNodeClick,
    setHovered,
    reset,
    masteryDialogNodeId,
    handleMasterySelect,
    handleMasteryUnallocate,
    closeMasteryDialog,
  } = useAllocation(processedNodes, adjacency, totalPoints)

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
      localStorage.setItem('poe-tree-selected-class', String(classIndex))
      const pn = processedNodes.get(startNodeId)
      if (pn) {
        handleCenterOn(pn.worldX, pn.worldY, 0.35)
      }
    },
    [selectClass, processedNodes, handleCenterOn],
  )

  // Restore class selection from localStorage on mount
  useEffect(() => {
    if (state.selectedClass !== null) return
    const saved = localStorage.getItem('poe-tree-selected-class')
    if (saved === null) return
    const classIndex = Number(saved)
    // Find the start node for this class
    for (const [id, pn] of processedNodes) {
      if (pn.node.classStartIndex === classIndex) {
        selectClass(classIndex, id)
        return
      }
    }
  }, [processedNodes, selectClass, state.selectedClass])

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

  const masteryDialogNode = masteryDialogNodeId
    ? (processedNodes.get(masteryDialogNodeId) ?? null)
    : null
  const currentMasteryEffect = masteryDialogNodeId
    ? (state.selectedMasteryEffects.get(masteryDialogNodeId) ?? null)
    : null

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

      {/* Top bar: class selector + point counter */}
      <div className="absolute top-3 left-3 z-40 flex items-center gap-3">
        <ClassSelector
          data={data}
          processedNodes={processedNodes}
          selectedClass={state.selectedClass}
          onSelect={handleClassSelect}
        />
        {state.selectedClass !== null && <PointCounter used={pointsUsed} total={totalPoints} />}
      </div>

      {/* Mastery selection dialog */}
      <MasterySelectionDialog
        open={masteryDialogNodeId !== null}
        node={masteryDialogNode}
        currentEffectIndex={currentMasteryEffect}
        canAffordPoint={pointsUsed < totalPoints || currentMasteryEffect !== null}
        onSelectEffect={handleMasterySelect}
        onUnallocate={handleMasteryUnallocate}
        onClose={closeMasteryDialog}
      />

      {/* Node tooltip */}
      {hoveredNode?.node.name && (
        <div className="absolute inset-0 pointer-events-none">
          <NodeTooltip
            node={hoveredNode}
            viewport={viewport}
            allocated={state.allocatedNodes.has(hoveredNode.id)}
            selectedMasteryEffects={state.selectedMasteryEffects}
          />
        </div>
      )}

      {/* Stat summary panel */}
      {state.selectedClass !== null && (
        <StatSummaryPanel
          allocatedNodes={state.allocatedNodes}
          processedNodes={processedNodes}
          selectedMasteryEffects={state.selectedMasteryEffects}
          pointsUsed={pointsUsed}
          totalPoints={totalPoints}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
